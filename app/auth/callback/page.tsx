"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense } from "react";

function AuthCallbackHandler() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [status, setStatus] = useState("Securing session...");

  useEffect(() => {
    let cancelled = false;

    const handleCallback = async () => {
      try {
        // PKCE flow: Supabase sends ?code=xxx in the query string
        const code = searchParams.get("code");
        const errorParam = searchParams.get("error");
        const errorDescription = searchParams.get("error_description");

        // Check for OAuth errors in query params
        if (errorParam) {
          console.error("OAuth error:", errorParam, errorDescription);
          router.push(`/auth?error=${encodeURIComponent(errorDescription || errorParam)}`);
          return;
        }

        if (code) {
          console.log("PKCE code detected, exchanging for session...");
          setStatus("Exchanging authorization code...");
          
          // Exchange the code for a session
          const { data, error } = await supabase.auth.exchangeCodeForSession(code);
          
          if (error) {
            console.error("Code exchange error:", error);
            router.push(`/auth?error=${encodeURIComponent(error.message)}`);
            return;
          }

          if (data.session && !cancelled) {
            console.log("Session established successfully!");
            setStatus("Session established! Redirecting...");
            await redirectUser(data.session.user.id);
            return;
          }
        }

        // Fallback: Check for hash fragment (implicit flow) or existing session
        // The hash fragment (#access_token=...) is automatically handled by Supabase's 
        // detectSessionInUrl when the client initializes
        const hashParams = typeof window !== "undefined" ? window.location.hash : "";
        if (hashParams.includes("access_token")) {
          console.log("Hash fragment detected, waiting for Supabase to process...");
          setStatus("Processing authentication...");
        }

        // Wait for Supabase to process and check session
        const { data: { session } } = await supabase.auth.getSession();
        if (session && !cancelled) {
          console.log("Session found via getSession!");
          setStatus("Session found! Redirecting...");
          await redirectUser(session.user.id);
          return;
        }

        // If no session yet, listen for auth state changes 
        // (Supabase may still be processing the hash fragment)
        const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
          console.log("Auth state change:", event, session ? "has session" : "no session");
          if (session && !cancelled) {
            setStatus("Authenticated! Redirecting...");
            subscription.unsubscribe();
            await redirectUser(session.user.id);
          }
        });

        // Extended timeout: give it 10 seconds before giving up
        setTimeout(() => {
          if (!cancelled) {
            console.warn("Auth callback timed out after 10 seconds");
            subscription.unsubscribe();
            router.push("/auth?error=callback_timeout");
          }
        }, 10000);

      } catch (err) {
        console.error("Auth callback error:", err);
        if (!cancelled) {
          router.push("/auth?error=callback_error");
        }
      }
    };

    const redirectUser = async (userId: string) => {
      try {
        const { data: contacts, error } = await supabase
          .from("contacts")
          .select("id")
          .eq("user_id", userId)
          .limit(1);

        if (!error && (!contacts || contacts.length === 0)) {
          router.push("/onboarding");
        } else {
          router.push("/");
        }
      } catch {
        router.push("/");
      }
    };

    handleCallback();

    return () => {
      cancelled = true;
    };
  }, [router, searchParams]);

  return (
    <div className="min-h-screen bg-[#020617] flex items-center justify-center select-none">
      <div className="text-white flex flex-col items-center gap-3 animate-fadeIn">
        <svg className="animate-spin h-8 w-8 text-cyan-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
        </svg>
        <span className="text-sm font-semibold tracking-wide text-gray-400 font-sans">{status}</span>
      </div>
    </div>
  );
}

export default function AuthCallbackPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-[#020617] flex items-center justify-center select-none">
        <div className="text-white flex flex-col items-center gap-3">
          <svg className="animate-spin h-8 w-8 text-cyan-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
          <span className="text-sm font-semibold tracking-wide text-gray-400 font-sans">Securing session...</span>
        </div>
      </div>
    }>
      <AuthCallbackHandler />
    </Suspense>
  );
}
