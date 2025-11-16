# Slice 1: Database Schema & Authentication Setup

## What's included:
- ✅ Database schema (users, contacts, touchpoints tables)
- ✅ Row Level Security (RLS) policies
- ✅ Authentication page (sign up/sign in)
- ✅ Protected home page
- ✅ Supabase auth integration

## To test this slice:

1. **Run the database schema:**
   - Go to Supabase Dashboard → SQL Editor
   - Copy and paste the contents of `supabase-schema.sql`
   - Click Run

2. **Enable Email Auth in Supabase:**
   - Go to Authentication → Providers
   - Enable "Email" provider
   - (Optional) Disable "Confirm email" for testing

3. **Test the app:**
   - Run `npm run dev`
   - Go to http://localhost:3000
   - You should be redirected to `/auth`
   - Sign up with a test email
   - You should see the home page

## Next slice:
Slice 2 will add the ability to create contacts.

