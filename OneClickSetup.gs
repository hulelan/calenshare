/**
 * ONE-CLICK CALENDAR SHARING
 * 
 * This creates a simple web interface where your boyfriend can:
 * 1. Click a link you send him
 * 2. Enter a cutoff date
 * 3. Click "Start Sharing"
 * 4. His events from that date forward automatically sync to your shared calendar
 * 
 * NO TECHNICAL KNOWLEDGE REQUIRED!
 */

/**
 * Serve the web interface
 */
function doGet(e) {
  const template = HtmlService.createTemplateFromFile('setup');
  
  // Pass any URL parameters to the template
  template.sharedCalendarId = e.parameter.shared || '';
  
  return template.evaluate()
    .setTitle('Calendar Sharing Setup')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

/**
 * Process the setup form when user clicks "Start Sharing"
 */
function setupCalendarSharing(formData) {
  try {
    // Validate the form data
    if (!formData.cutoffDate) {
      throw new Error('Please enter a cutoff date');
    }
    
    if (!formData.sharedCalendarId) {
      throw new Error('Please enter the shared calendar ID');
    }
    
    if (!formData.personalCalendarId) {
      throw new Error('Please select which calendar to share from');
    }
    
    // Test calendar access
    const testResult = testAccess(formData);
    if (!testResult.success) {
      return testResult;
    }
    
    // Save configuration
    saveConfig(formData);
    
    // Setup automatic syncing
    setupTriggers();
    
    // Run initial sync
    const syncResult = performSync();
    
    return {
      success: true,
      message: `✅ Setup complete! Synced ${syncResult.eventsShared} events.`,
      details: syncResult,
      info: 'Events will sync every 4 hours. Deleted events will be automatically removed from the shared calendar.'
    };
    
  } catch (error) {
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Test if we can access both calendars
 */
function testAccess(formData) {
  try {
    // Test personal calendar access - fallback to default if not specified
    const personalCalendar = formData.personalCalendarId ? 
      CalendarApp.getCalendarById(formData.personalCalendarId) : 
      CalendarApp.getDefaultCalendar();
    
    if (!personalCalendar) {
      return { success: false, error: 'Cannot access your personal calendar. Check the calendar ID.' };
    }
    
    // Test shared calendar access
    const sharedCalendar = CalendarApp.getCalendarById(formData.sharedCalendarId);
    if (!sharedCalendar) {
      return { 
        success: false, 
        error: 'Cannot access shared calendar. Make sure the calendar ID is correct and shared with you.' 
      };
    }
    
    // Test if we can create events in shared calendar
    try {
      const testEvent = sharedCalendar.createEvent(
        '🧪 Test Event - Please Delete',
        new Date(),
        new Date(Date.now() + 60000)
      );
      testEvent.deleteEvent(); // Clean up immediately
    } catch (e) {
      return {
        success: false,
        error: 'Cannot create events in shared calendar. You need "Make changes to events" permission.'
      };
    }
    
    return {
      success: true,
      personalCalendar: personalCalendar.getName(),
      sharedCalendar: sharedCalendar.getName()
    };
    
  } catch (error) {
    return { success: false, error: error.message };
  }
}

/**
 * Save user configuration
 */
function saveConfig(formData) {
  const config = {
    cutoffDate: formData.cutoffDate,
    sharedCalendarId: formData.sharedCalendarId,
    personalCalendarId: formData.personalCalendarId || Session.getActiveUser().getEmail(),
    userName: formData.userName || 'Partner',
    setupDate: new Date().toISOString(),
    syncDaysAhead: 90
  };
  
  PropertiesService.getScriptProperties().setProperty('sharingConfig', JSON.stringify(config));
}

/**
 * Get saved configuration
 */
function getConfig() {
  const configStr = PropertiesService.getScriptProperties().getProperty('sharingConfig');
  if (!configStr) {
    throw new Error('No configuration found. Please run setup first.');
  }
  return JSON.parse(configStr);
}

/**
 * Setup automatic triggers for syncing
 */
function setupTriggers() {
  // Delete existing triggers
  const triggers = ScriptApp.getProjectTriggers();
  triggers.forEach(trigger => {
    if (trigger.getHandlerFunction() === 'autoSync') {
      ScriptApp.deleteTrigger(trigger);
    }
  });
  
  // Create new trigger - sync every 4 hours
  ScriptApp.newTrigger('autoSync')
    .timeBased()
    .everyHours(4)
    .create();
    
  console.log('✅ Automatic sync trigger created (every 4 hours)');
}

/**
 * Perform the calendar sync
 */
function performSync() {
  const config = getConfig();
  
  // Use personalCalendarId if available, otherwise fall back to default
  const personalCalendar = config.personalCalendarId ? 
    CalendarApp.getCalendarById(config.personalCalendarId) : 
    CalendarApp.getDefaultCalendar();
    
  const sharedCalendar = CalendarApp.getCalendarById(config.sharedCalendarId);
  
  // Calculate date range - fix timezone issues
  // Parse the date string properly to avoid timezone shifts
  const [year, month, day] = config.cutoffDate.split('-').map(Number);
  const cutoffDate = new Date(year, month - 1, day, 0, 0, 0); // month is 0-indexed
  
  const endDate = new Date();
  endDate.setDate(endDate.getDate() + config.syncDaysAhead);
  
  console.log(`Config cutoff date string: ${config.cutoffDate}`);
  console.log(`Parsed cutoff date: ${cutoffDate.toISOString()}`);
  console.log(`Syncing from calendar: ${personalCalendar.getName()} (${personalCalendar.getId()})`);
  console.log(`Syncing events from ${cutoffDate.toDateString()} to ${endDate.toDateString()}`);
  
  // Get events from personal calendar after cutoff date
  const personalEvents = personalCalendar.getEvents(cutoffDate, endDate);
  console.log(`Found ${personalEvents.length} events in personal calendar`);
  
  // Create a set of personal event IDs that should exist
  const personalEventIds = new Set();
  personalEvents.forEach(event => {
    if (!shouldSkipEvent(event)) {
      personalEventIds.add(event.getId());
    }
  });
  
  let eventsShared = 0;
  let eventsUpdated = 0;
  let eventsSkipped = 0;
  
  // Sync events from personal to shared
  for (const event of personalEvents) {
    try {
      const result = syncEvent(event, sharedCalendar, config);
      if (result.created) eventsShared++;
      if (result.updated) eventsUpdated++;
      if (result.skipped) eventsSkipped++;
    } catch (error) {
      console.error(`Error syncing event "${event.getTitle()}": ${error.message}`);
    }
  }
  
  // Remove events from shared calendar that no longer exist in personal calendar
  const eventsDeleted = removeDeletedEvents(sharedCalendar, personalEventIds, config, cutoffDate, endDate);
  
  const result = {
    eventsShared,
    eventsUpdated,
    eventsSkipped,
    eventsDeleted,
    totalPersonalEvents: personalEvents.length
  };
  
  console.log(`Sync complete: ${JSON.stringify(result)}`);
  return result;
}

/**
 * Sync a single event to the shared calendar
 */
function syncEvent(personalEvent, sharedCalendar, config) {
  const eventTitle = personalEvent.getTitle();
  
  // Skip private events or events with private keywords
  if (shouldSkipEvent(personalEvent)) {
    return { skipped: true };
  }
  
  // Check if already synced
  const existingEvent = findExistingSharedEvent(personalEvent, sharedCalendar, config.userName);
  
  if (existingEvent) {
    // Update if needed
    if (eventNeedsUpdate(personalEvent, existingEvent, config.userName)) {
      updateSharedEvent(personalEvent, existingEvent, config.userName);
      console.log(`Updated: "${eventTitle}"`);
      return { updated: true };
    } else {
      return { unchanged: true };
    }
  } else {
    // Create new shared event
    createSharedEvent(personalEvent, sharedCalendar, config.userName);
    console.log(`Shared: "${eventTitle}"`);
    return { created: true };
  }
}

/**
 * Check if an event should be skipped
 */
function shouldSkipEvent(event) {
  const title = event.getTitle().toLowerCase();
  const originalTitle = event.getTitle();
  
  // Skip if title contains the ignore keyword
  if (title.includes('calignore')) {
    console.log(`Filtering event with 'calignore' tag: "${originalTitle}"`);
    return true;
  }
  
  // Optionally still skip private events - comment this out if you want to share private events
  if (event.getVisibility() === CalendarApp.Visibility.PRIVATE) {
    console.log(`Filtering private event: "${originalTitle}"`);
    return true;
  }
  
  return false;
}

/**
 * Create a new event in the shared calendar
 */
function createSharedEvent(personalEvent, sharedCalendar, userName) {
  const title = `${userName}: ${personalEvent.getTitle()}`;
  const startTime = personalEvent.getStartTime();
  const endTime = personalEvent.getEndTime();
  
  let sharedEvent;
  
  if (personalEvent.isAllDayEvent()) {
    sharedEvent = sharedCalendar.createAllDayEvent(title, startTime, endTime);
  } else {
    sharedEvent = sharedCalendar.createEvent(title, startTime, endTime);
  }
  
  // Copy additional properties
  if (personalEvent.getDescription()) {
    sharedEvent.setDescription(personalEvent.getDescription());
  }
  
  if (personalEvent.getLocation()) {
    sharedEvent.setLocation(personalEvent.getLocation());
  }
  
  // Add tracking metadata
  sharedEvent.setTag('syncedBy', userName);
  sharedEvent.setTag('originalEventId', personalEvent.getId());
  sharedEvent.setTag('syncTimestamp', new Date().toISOString());
  
  return sharedEvent;
}

/**
 * Update an existing shared event
 */
function updateSharedEvent(personalEvent, sharedEvent, userName) {
  const title = `${userName}: ${personalEvent.getTitle()}`;
  
  sharedEvent.setTitle(title);
  sharedEvent.setTime(personalEvent.getStartTime(), personalEvent.getEndTime());
  
  if (personalEvent.getDescription()) {
    sharedEvent.setDescription(personalEvent.getDescription());
  }
  
  if (personalEvent.getLocation()) {
    sharedEvent.setLocation(personalEvent.getLocation());
  }
  
  sharedEvent.setTag('syncTimestamp', new Date().toISOString());
}

/**
 * Find existing shared event
 */
function findExistingSharedEvent(personalEvent, sharedCalendar, userName) {
  // Search in a small time window around the event
  const startTime = personalEvent.getStartTime();
  const endTime = personalEvent.getEndTime();
  const searchStart = new Date(startTime.getTime() - 60 * 60 * 1000); // 1 hour before
  const searchEnd = new Date(endTime.getTime() + 60 * 60 * 1000);     // 1 hour after
  
  const events = sharedCalendar.getEvents(searchStart, searchEnd);
  
  for (const event of events) {
    const syncedBy = event.getTag('syncedBy');
    const originalId = event.getTag('originalEventId');
    
    if (syncedBy === userName && originalId === personalEvent.getId()) {
      return event;
    }
  }
  
  return null;
}

/**
 * Check if an event needs updating
 */
function eventNeedsUpdate(personalEvent, sharedEvent, userName) {
  const expectedTitle = `${userName}: ${personalEvent.getTitle()}`;
  
  // Check title
  if (sharedEvent.getTitle() !== expectedTitle) {
    return true;
  }
  
  // Check times
  if (personalEvent.getStartTime().getTime() !== sharedEvent.getStartTime().getTime() ||
      personalEvent.getEndTime().getTime() !== sharedEvent.getEndTime().getTime()) {
    return true;
  }
  
  // Check location
  if (personalEvent.getLocation() !== sharedEvent.getLocation()) {
    return true;
  }
  
  return false;
}

/**
 * Remove events from shared calendar that no longer exist in personal calendar
 */
function removeDeletedEvents(sharedCalendar, personalEventIds, config, cutoffDate, endDate) {
  // Get all events in shared calendar that were synced by this user
  const sharedEvents = sharedCalendar.getEvents(cutoffDate, endDate);
  let deletedCount = 0;
  
  for (const sharedEvent of sharedEvents) {
    // Check if this event was synced by the current user
    const syncedBy = sharedEvent.getTag('syncedBy');
    const originalEventId = sharedEvent.getTag('originalEventId');
    
    if (syncedBy === config.userName && originalEventId) {
      // Check if this event still exists in the personal calendar
      if (!personalEventIds.has(originalEventId)) {
        // Event no longer exists in personal calendar, so delete from shared
        console.log(`Deleting event that was removed from personal calendar: "${sharedEvent.getTitle()}"`);
        sharedEvent.deleteEvent();
        deletedCount++;
      }
    }
  }
  
  if (deletedCount > 0) {
    console.log(`Deleted ${deletedCount} events that were removed from personal calendar`);
  }
  
  return deletedCount;
}

/**
 * Automatic sync function (called by trigger)
 */
function autoSync() {
  try {
    const result = performSync();
    console.log(`Auto-sync completed: ${JSON.stringify(result)}`);
    
    // Log summary of changes
    const changes = [];
    if (result.eventsShared > 0) changes.push(`${result.eventsShared} added`);
    if (result.eventsUpdated > 0) changes.push(`${result.eventsUpdated} updated`);
    if (result.eventsDeleted > 0) changes.push(`${result.eventsDeleted} deleted`);
    
    if (changes.length > 0) {
      console.log(`📅 Sync changes: ${changes.join(', ')}`);
    } else {
      console.log(`📅 No changes needed`);
    }
    
  } catch (error) {
    console.error(`Auto-sync failed: ${error.message}`);
  }
}

/**
 * Preview what would be shared (for testing)
 */
function previewSharing(formData) {
  try {
    // Use personalCalendarId if provided, otherwise use default
    const personalCalendar = formData.personalCalendarId ? 
      CalendarApp.getCalendarById(formData.personalCalendarId) : 
      CalendarApp.getDefaultCalendar();
      
    // Parse date properly to avoid timezone issues
    const [year, month, day] = formData.cutoffDate.split('-').map(Number);
    const cutoffDate = new Date(year, month - 1, day, 0, 0, 0);
    
    const endDate = new Date();
    endDate.setDate(endDate.getDate() + 30); // Next 30 days for preview
    
    console.log(`Preview - Calendar: ${personalCalendar.getName()}`);
    console.log(`Preview - Cutoff date: ${cutoffDate.toDateString()}`);
    console.log(`Preview - End date: ${endDate.toDateString()}`);
    
    const events = personalCalendar.getEvents(cutoffDate, endDate);
    const eventsToShare = [];
    const filteredEvents = [];
    
    // Separate events into shareable and filtered
    events.forEach(event => {
      if (shouldSkipEvent(event)) {
        filteredEvents.push(event);
      } else {
        eventsToShare.push(event);
      }
    });
    
    console.log(`Preview complete: ${eventsToShare.length} to share, ${filteredEvents.length} filtered`);
    
    return {
      success: true,
      total: events.length,
      toShare: eventsToShare.length,
      filtered: filteredEvents.length,
      examples: eventsToShare.slice(0, 5).map(event => ({
        title: `${formData.userName || 'You'}: ${event.getTitle()}`,
        date: event.getStartTime().toLocaleDateString(),
        time: event.isAllDayEvent() ? 'All day' : event.getStartTime().toLocaleTimeString()
      })),
      filterReasons: filteredEvents.slice(0, 3).map(event => ({
        title: event.getTitle(),
        reason: event.getTitle().toLowerCase().includes('calignore') ? 
          'Contains "calignore" tag' : 
          'Marked as private in Google Calendar'
      }))
    };
    
  } catch (error) {
    return { success: false, error: error.message };
  }
}

/**
 * Get sync status for the web interface
 */
function getSyncStatus() {
  try {
    const config = getConfig();
    
    // Get recent sync info
    const triggers = ScriptApp.getProjectTriggers();
    const syncTrigger = triggers.find(t => t.getHandlerFunction() === 'autoSync');
    
    return {
      success: true,
      config: {
        cutoffDate: config.cutoffDate,
        userName: config.userName,
        setupDate: config.setupDate
      },
      isActive: !!syncTrigger,
      nextSync: syncTrigger ? 'Every 4 hours' : 'Not scheduled'
    };
    
  } catch (error) {
    return { success: false, error: error.message };
  }
}

/**
 * Stop sharing (remove triggers and optionally clean up events)
 */
function stopSharing(removeEvents = false) {
  try {
    // Remove triggers
    const triggers = ScriptApp.getProjectTriggers();
    triggers.forEach(trigger => {
      if (trigger.getHandlerFunction() === 'autoSync') {
        ScriptApp.deleteTrigger(trigger);
      }
    });
    
    let removedEvents = 0;
    
    if (removeEvents) {
      // Remove shared events
      const config = getConfig();
      const sharedCalendar = CalendarApp.getCalendarById(config.sharedCalendarId);
      
      const cutoffDate = new Date(config.cutoffDate);
      const endDate = new Date();
      endDate.setDate(endDate.getDate() + config.syncDaysAhead);
      
      const events = sharedCalendar.getEvents(cutoffDate, endDate);
      
      for (const event of events) {
        if (event.getTag('syncedBy') === config.userName) {
          event.deleteEvent();
          removedEvents++;
        }
      }
    }
    
    return {
      success: true,
      message: `Sharing stopped. ${removeEvents ? `Removed ${removedEvents} shared events.` : 'Shared events kept.'}`
    };
    
  } catch (error) {
    return { success: false, error: error.message };
  }
}

/**
 * Get list of user's calendars for the dropdown
 */
function getMyCalendars() {
  try {
    const calendars = CalendarApp.getAllCalendars();
    console.log(`Found ${calendars.length} calendars`);
    
    const calendarList = calendars.map(cal => ({
      id: cal.getId(),
      name: cal.getName(),
      isOwned: cal.isOwnedByMe(),
      email: Session.getActiveUser().getEmail()
    })).sort((a, b) => {
      // Sort owned calendars first
      if (a.isOwned && !b.isOwned) return -1;
      if (!a.isOwned && b.isOwned) return 1;
      return a.name.localeCompare(b.name);
    });
    
    console.log('Available calendars:', JSON.stringify(calendarList, null, 2));
    return calendarList;
    
  } catch (error) {
    console.error('Error loading calendars:', error);
    return [{ 
      id: Session.getActiveUser().getEmail(), 
      name: 'Primary Calendar', 
      isOwned: true,
      email: Session.getActiveUser().getEmail()
    }];
  }
}

/**
 * Include HTML files in the web app
 */
function include(filename) {
  return HtmlService.createHtmlOutputFromFile(filename).getContent();
}