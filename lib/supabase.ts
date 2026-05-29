import { createClient } from '@supabase/supabase-js';

// Fallback placeholders to prevent the build or module load from throwing a runtime exception
// if environment variables are not loaded/configured correctly in production
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder-url.supabase.co';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'placeholder-anon-key';

if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
  console.error('Supabase credentials not found in environment variables');
  console.error('NEXT_PUBLIC_SUPABASE_URL:', process.env.NEXT_PUBLIC_SUPABASE_URL ? 'Set' : 'Missing');
  console.error('NEXT_PUBLIC_SUPABASE_ANON_KEY:', process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ? 'Set' : 'Missing');
  
  // Throw error in development to catch missing env vars early
  if (typeof window !== 'undefined' && process.env.NODE_ENV === 'development') {
    throw new Error('Missing Supabase environment variables. Please check your .env.local file.');
  }
}

// Client-side Supabase client with auth support
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
});

