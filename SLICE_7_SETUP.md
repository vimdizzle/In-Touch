# Slice 7: Settings Page

## What's included:
- ✅ Settings page at `/settings`
- ✅ Account Information section:
  - Email (read-only, from auth)
  - Name (editable)
- ✅ Preferences section:
  - Daily reminder time (time picker) - for future notifications
  - Default cadence for new contacts (number input in days)
- ✅ Save functionality
- ✅ Success/error messages
- ✅ Back button to Today view
- ✅ Settings button added to Today view header

## Database Migration Required:

Run this SQL in Supabase SQL Editor:
```sql
-- Add settings fields to users table
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS daily_reminder_time TEXT DEFAULT '09:00';

ALTER TABLE users 
ADD COLUMN IF NOT EXISTS default_cadence_days INTEGER DEFAULT 30;
```

Or run the `supabase-settings-migration.sql` file.

## How it works:

1. **User navigates to** `/settings` (via button in header)
2. **Loads user profile** from `users` table
3. **Displays** current settings
4. **Allows editing** name, reminder time, and default cadence
5. **Saves** to database on submit
6. **Shows success/error** feedback

## To test this slice:

1. **Run the database migration** (see above)
2. **Go to Today view**
3. **Click "Settings"** in the header
4. **Verify the page shows:**
   - Your email (read-only)
   - Name field (editable)
   - Daily reminder time picker
   - Default cadence input

5. **Test editing:**
   - Change your name
   - Change reminder time
   - Change default cadence
   - Click "Save Settings"
   - Verify success message appears
   - Refresh page and verify changes persisted

6. **Test navigation:**
   - Click "Back to Today" - should return to home
   - Settings button should be accessible from Today view

## Future enhancements (v1.1):
- Actual email/push notifications based on reminder time
- More granular notification preferences
- Export data functionality

