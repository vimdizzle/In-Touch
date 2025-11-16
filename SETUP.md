# Quick Setup Guide

## Step 1: Get your Supabase Anon Key

1. Go to https://supabase.com/dashboard
2. Select your project (dnjtxrbfrglhekctyhax)
3. Go to **Settings** → **API**
4. Copy the **anon public** key
5. Create `.env.local` file in the root directory with:
   ```
   NEXT_PUBLIC_SUPABASE_URL=https://dnjtxrbfrglhekctyhax.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=paste_your_anon_key_here
   ```

## Step 2: Create the Database Table

Run the SQL in `supabase-setup.sql` in your Supabase SQL Editor:

1. Go to your Supabase dashboard
2. Click on **SQL Editor** in the left sidebar
3. Click **New query**
4. Copy and paste the contents of `supabase-setup.sql`
5. Click **Run**

Alternatively, you can run it via psql using your connection string:
```bash
psql "postgresql://postgres:Flashmira889@db.dnjtxrbfrglhekctyhax.supabase.co:5432/postgres" -f supabase-setup.sql
```

## Step 3: Run the App

```bash
npm run dev
```

Then open http://localhost:3000

