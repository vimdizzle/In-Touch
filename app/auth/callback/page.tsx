"use client";

import { useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { useRouter } from "next/navigation";

export default function AuthCallbackPage() {
  const router = useRouter();

  useEffect(() => {
    // Listen for auth state change which fires when hash token is successfully parsed
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (session) {
        // Logged in! Let's check if they have contacts, redirect to onboarding or home
        try {
          const { data: contacts, error } = await supabase
            .from("contacts")
            .select("id")
            .eq("user_id", session.user.id)
            .limit(1);

          if (!error && (!contacts || contacts.length === 0)) {
            router.push("/onboarding");
          } else {
            router.push("/");
          }
        } catch {
          router.push("/");
        }
      }
    });

    // Also run immediate session check
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (session) {
        try {
          const { data: contacts, error } = await supabase
            .from("contacts")
            .select("id")
            .eq("user_id", session.user.id)
            .limit(1);

          if (!error && (!contacts || contacts.length === 0)) {
            router.push("/onboarding");
          } else {
            router.push("/");
          }
        } catch {
          router.push("/");
        }
      }
    });

    // Fallback: if we stay on this callback page for more than 4 seconds without resolving a session,
    // it means the token is expired/invalid. Redirect cleanly to /auth so we never get stuck!
    const fallbackTimer = setTimeout(() => {
      router.push("/auth?error=OAuthCallbackTimeout");
    }, 4000);

    return () => {
      clearTimeout(fallbackTimer);
      subscription.unsubscribe();
    };
  }, [router]);

  return (
    <div className="min-h-screen bg-[#020617] flex items-center justify-center select-none">
      <div className="text-white flex flex-col items-center gap-3 animate-fadeIn">
        <svg className="animate-spin h-8 w-8 text-cyan-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
        </svg>
        <span className="text-sm font-semibold tracking-wide text-gray-400 font-sans">Securing session...</span>
      </div>
    </div>
  );
}
