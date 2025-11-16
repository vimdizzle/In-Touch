# Slice 3: Today View - Display Contacts List

## What's included:
- ✅ Today view with contact cards
- ✅ "Overdue" section (red indicator) - contacts past their cadence
- ✅ "Coming up" section (yellow indicator) - contacts due within 7 days
- ✅ "On Track" section (green indicator) - contacts not due yet
- ✅ Contact cards showing:
  - Name and relationship
  - Location (if available)
  - Last contact info ("X days ago via channel" or "Never contacted")
  - Cadence badge (Weekly/Monthly/Quarterly/Yearly or custom)
  - Status indicator (overdue by X days, due in X days)
  - "Log touchpoint" button (primary action)
  - "View" button (secondary action)
- ✅ Auto-calculates status based on last touchpoint and cadence
- ✅ Handles contacts with no touchpoints yet

## How it works:

1. **Fetches all contacts** for the logged-in user
2. **For each contact:**
   - Gets the most recent touchpoint
   - Calculates days since last contact
   - Determines status:
     - **Overdue**: Last contact + cadence < today
     - **Coming up**: Days until due ≤ 7
     - **On track**: Days until due > 7
3. **Groups contacts** by status
4. **Displays** in sections with appropriate styling

## To test this slice:

1. **Make sure you have contacts:**
   - Go to `/onboarding` and add a few contacts
   - Add contacts with different cadences (7, 30, 90 days)

2. **Test the status calculation:**
   - Contacts with no touchpoints should show as overdue if created date + cadence < today
   - Add some touchpoints (we'll build this in Slice 4) to see status changes

3. **Verify the sections:**
   - Overdue contacts appear in red section
   - Coming up contacts appear in yellow section
   - On track contacts appear in green section

4. **Test the buttons:**
   - "Log touchpoint" button (will work in Slice 4)
   - "View" button (will work in Slice 5)

## Next slice:
Slice 4 will add the "Log touchpoint" functionality.

