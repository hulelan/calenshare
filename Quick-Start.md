# 📅 One-Click Calendar Sharing - Quick Start

## For Couples Who Want to Share Calendars (Without Full Access)

**The Problem:** Your boyfriend doesn't want to share his whole calendar, but you want to see his events from a certain date forward.

**The Solution:** A simple 2-minute setup that lets him share only events after a cutoff date, automatically.

---

## Setup Steps

### Step 1: You Create the Shared Calendar (2 minutes)

1. **Go to Google Calendar**
2. **Click the "+" next to "Other calendars"**
3. **Choose "Create new calendar"**
4. **Name it something like "Our Plans"**
5. **Click "Create Calendar"**
6. **Share it with your boyfriend:**
   - Go to calendar settings (click the 3 dots next to your new calendar)
   - Click "Settings and sharing"
   - Under "Share with specific people" → Add his email
   - Give him **"Make changes to events"** permission
   - Click "Send"

7. **Get the Calendar ID:**
   - Still in settings, scroll down to "Integrate calendar"
   - Copy the **Calendar ID** (looks like `abc123@group.calendar.google.com`)
   - Send this ID to your boyfriend

### Step 2: Your Boyfriend Sets Up Sharing (2 minutes)

1. **Go to** [script.google.com](https://script.google.com)
2. **Click "New Project"**
3. **Name it "Calendar Sharing"**
4. **Delete the default code** and paste in the contents of `OneClickSetup.gs`
5. **IMPORTANT: Save the file** (Ctrl+S or Cmd+S)
6. **Add the HTML file:**
   - Click the "+" next to "Files"
   - Choose "HTML"
   - Name it exactly `setup` (no .html extension)
   - Delete default content and paste in the contents of `setup.html`
   - Save the file
7. **Test the doGet function:**
   - In the dropdown at the top, select "doGet"
   - Click "Run" to test (it will fail but that's OK)
   - This ensures Google recognizes the function
8. **Deploy the web app:**
   - Click "Deploy" → "New deployment"
   - Choose type: "Web app"
   - Execute as: "Me"
   - Who has access: "Anyone"
   - Click "Deploy"
   - If prompted, review and authorize permissions
   - Copy the web app URL

9. **Use the web interface:**
   - Click the web app URL
   - Fill out the simple form:
     - His name (e.g., "Jamie")
     - **Choose which calendar to share from** (dropdown will show all his calendars)
     - Cutoff date (e.g., "2024-01-01")
     - Your shared calendar ID
   - Click "Preview" to see what will be shared
   - Click "Start Sharing"
   - Done!

---

## What Happens Next

### ✅ **Automatic Sharing**
- His events from the cutoff date forward automatically appear in "Our Plans"
- Events show up as "Jamie: Dinner plans", "Jamie: Weekend trip", etc.
- Syncs every 4 hours automatically
- No more manual work needed

### 🔒 **Privacy Protected**
- You never get access to his full calendar
- His events before the cutoff date stay private
- Events marked "private" are never shared
- Events with "private" in the title are filtered out

### 📱 **For You**
- Open Google Calendar and see "Our Plans"
- All his shared events appear there
- You can see them on phone/computer/anywhere
- No special apps needed

---

## Troubleshooting

### "Script function not found: doGet"
- Make sure you saved the OneClickSetup.gs file (Ctrl+S)
- The HTML file must be named exactly `setup` (not `setup.html`)
- Try running the doGet function once from the dropdown
- Make sure you're deploying a "New deployment" not updating an old one

### "Cannot access shared calendar"
- Make sure you shared the calendar with "Make changes to events" permission
- Double-check the calendar ID is correct
- Wait a few minutes for Google to propagate permissions

### "No events showing up"
- Check that events are after the cutoff date
- Make sure events aren't marked as "private"
- Events with "private" in the title are automatically filtered out

### "Want to change the cutoff date"
- Your boyfriend can re-run the web app setup with a new date
- Or edit the configuration in the Apps Script

---

## Advanced Options

### **Change Sync Frequency**
Default is every 4 hours. To change:
1. In Apps Script, go to "Triggers"
2. Delete existing trigger
3. Create new one with different frequency

### **Stop Sharing**
Your boyfriend can:
1. Go to Apps Script → "Triggers"
2. Delete the sync trigger
3. Optionally run `stopSharing(true)` to remove already-shared events

### **Share Multiple Calendars**
The script now shows all his calendars in a dropdown - he can choose which one to share from (Personal, Work, etc.). To share from multiple calendars, he would need to run the setup multiple times with different calendar selections.

---

## Benefits Over Other Solutions

| Other Approaches | This Solution |
|------------------|---------------|
| ❌ Full calendar access required | ✅ Only cutoff date forward |
| ❌ Complex permission management | ✅ Simple calendar sharing |
| ❌ Manual event copying | ✅ Automatic syncing |
| ❌ Privacy concerns | ✅ Privacy by design |
| ❌ Technical setup | ✅ Simple web form |

---

## Support

**If something goes wrong:**
1. Check the Apps Script "Executions" tab for error logs
2. Verify calendar permissions in Google Calendar settings
3. Make sure the shared calendar ID is correct
4. Try running the preview function to test access

**Common fixes:**
- Re-share the calendar with correct permissions
- Check that cutoff date is in the right format
- Make sure both people are using the same shared calendar ID

The whole setup takes about 4 minutes total, and then everything works automatically forever!