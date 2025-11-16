# Slice 2: Onboarding - Add Contact Form

## What's included:
- ✅ Onboarding page at `/onboarding`
- ✅ Contact creation form with:
  - Name (required)
  - Relationship dropdown
  - Cadence selector (Weekly/Monthly/Quarterly/Yearly + custom days)
  - Optional: Location, Birthday, Notes
- ✅ Live contact list as you add them
- ✅ Auto-redirect to onboarding if user has no contacts
- ✅ "Finish & Go to Dashboard" button

## To test this slice:

1. **Make sure database schema is set up:**
   - Run `supabase-schema.sql` in Supabase SQL Editor if you haven't already

2. **Test locally:**
   - Run `npm run dev`
   - Sign in/up
   - If you have no contacts, you'll be redirected to `/onboarding`
   - Add a few contacts using the form
   - See them appear in the list on the right
   - Click "Finish & Go to Dashboard"

3. **Test the flow:**
   - Add contact with name "John Doe", relationship "Friend", cadence "Monthly"
   - Add another with custom cadence (e.g., 45 days)
   - Verify contacts are saved to database
   - Check that you can navigate back to onboarding from home page

## Next slice:
Slice 3 will display contacts in the Today view with their status.

