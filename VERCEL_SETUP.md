# Vercel Deployment Setup

## Step-by-Step Guide

### 1. Sign up / Login to Vercel
- Go to https://vercel.com
- Click "Sign Up" or "Log In"
- Choose "Continue with GitHub"
- Authorize Vercel to access your GitHub account

### 2. Import Your Project
- After logging in, click **"Add New..."** → **"Project"**
- You'll see a list of your GitHub repositories
- Find **"In-Touch"** (vimdizzle/In-Touch)
- Click **"Import"** next to it

### 3. Configure Project Settings
Vercel will auto-detect Next.js, but verify:
- **Framework Preset:** Next.js (should be auto-detected)
- **Root Directory:** `./` (leave as default)
- **Build Command:** `npm run build` (auto-filled)
- **Output Directory:** `.next` (auto-filled)
- **Install Command:** `npm install` (auto-filled)

### 4. Add Environment Variables
**IMPORTANT:** Before deploying, add these:

Click **"Environment Variables"** section and add:

1. **NEXT_PUBLIC_SUPABASE_URL**
   - Value: `https://dnjtxrbfrglhekctyhax.supabase.co`
   - Environment: Production, Preview, Development (check all)

2. **NEXT_PUBLIC_SUPABASE_ANON_KEY**
   - Value: `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRuanR4cmJmcmdsaGVrY3R5aGF4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjMyNTAwMTYsImV4cCI6MjA3ODgyNjAxNn0.Y-nA9KGJoxUpE6tr_hsVobpYpjwQ7q2Rbo53GZCzOO8`
   - Environment: Production, Preview, Development (check all)

### 5. Deploy
- Click **"Deploy"** button
- Wait 2-3 minutes for the build to complete
- You'll see build logs in real-time

### 6. Get Your Live URL
- After deployment succeeds, you'll get a URL like:
  - `in-touch-xyz123.vercel.app`
- Click it to see your live app!

### 7. Automatic Deployments
- Every time you push to GitHub, Vercel will automatically:
  - Build your app
  - Deploy the new version
  - Update your live site

### 8. Custom Domain (Optional)
- Go to Project Settings → Domains
- Add your custom domain if you have one

## Troubleshooting

### Build Fails?
- Check the build logs in Vercel dashboard
- Make sure environment variables are set correctly
- Verify your Supabase database schema is set up

### App Works Locally But Not on Vercel?
- Double-check environment variables are added
- Make sure RLS policies in Supabase allow your app
- Check browser console for errors

### Need to Redeploy?
- Just push to GitHub again, or
- Go to Vercel dashboard → Deployments → Click "Redeploy"

## Next Steps After Deployment

1. Test the auth flow on the live site
2. Make sure Supabase RLS policies work correctly
3. Continue building Slice 2 (Add Contact Form)

