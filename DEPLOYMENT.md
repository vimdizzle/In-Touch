# Deployment Guide

## Why GitHub Pages doesn't work

GitHub Pages only serves static HTML files. Next.js apps need:
- Server-side rendering
- API routes
- Environment variables
- Node.js runtime

## Recommended: Deploy to Vercel (Free)

Vercel is made by the Next.js team and is the best option for Next.js apps.

### Steps:

1. **Push your code to GitHub** (already done ✅)

2. **Go to https://vercel.com**
   - Sign up/login with your GitHub account
   - Click "Add New Project"
   - Import your `vimdizzle/In-Touch` repository

3. **Configure environment variables:**
   - In Vercel project settings, go to "Environment Variables"
   - Add:
     - `NEXT_PUBLIC_SUPABASE_URL` = your Supabase URL
     - `NEXT_PUBLIC_SUPABASE_ANON_KEY` = your Supabase anon key

4. **Deploy:**
   - Click "Deploy"
   - Vercel will automatically build and deploy your app
   - You'll get a URL like `in-touch.vercel.app`

5. **Custom domain (optional):**
   - You can add your own domain in Vercel settings

## Alternative: Netlify

Netlify also supports Next.js:
- Similar process to Vercel
- Connect GitHub repo
- Add environment variables
- Deploy

## Why Vercel is better:
- Built by Next.js creators
- Zero-config deployment
- Automatic HTTPS
- Free tier is generous
- Automatic deployments on git push

