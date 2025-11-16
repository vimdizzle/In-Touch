# In Touch - Supabase Demo

A simple Next.js app to store data in Supabase.

## Setup

1. Install dependencies:
```bash
npm install
```

2. Create `.env.local` file in the root directory:
```
NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
```

3. Set up your Supabase database:
   - Go to your Supabase project dashboard
   - Navigate to Table Editor
   - Create a new table called `messages`
   - Add the following columns:
     - `id` (uuid, primary key, default: `gen_random_uuid()`)
     - `message` (text, not null)
     - `created_at` (timestamp, default: `now()`)
   - Enable Row Level Security (RLS) and create a policy to allow inserts

4. Run the dev server:
```bash
npm run dev
```

5. Open http://localhost:3000

## What it does

- Connects to your Supabase project
- Allows you to enter a message and save it to the database
- Displays success/error messages

