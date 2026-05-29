"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabase";
import { useRouter } from "next/navigation";

export default function AuthPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isSignUp, setIsSignUp] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const router = useRouter();

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      if (isSignUp) {
        const { data, error: signUpError } = await supabase.auth.signUp({
          email,
          password,
        });

        if (signUpError) throw signUpError;

        // Create user profile
        if (data.user) {
          const { error: profileError } = await supabase
            .from("users")
            .insert([{ id: data.user.id, email: data.user.email }]);

          if (profileError) throw profileError;
        }

        // Check if email confirmation is required
        if (data.user && !data.session) {
          setError("Please check your email to confirm your account!");
          return;
        }
      } else {
        const { error: signInError } = await supabase.auth.signInWithPassword({
          email,
          password,
        });

        if (signInError) throw signInError;
      }

      router.push("/");
    } catch (err: any) {
      // Provide more helpful error messages
      if (err.message?.includes("Failed to fetch") || err.message?.includes("NetworkError")) {
        setError("Unable to connect to the server. Please check your internet connection and try again.");
      } else if (err.message?.includes("Invalid login credentials")) {
        setError("Invalid email or password. Please try again.");
      } else if (err.message) {
        setError(err.message);
      } else {
        setError("An error occurred. Please try again.");
      }
      console.error("Auth error:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setLoading(true);
    setError("");
    try {
      const { error: googleError } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: window.location.origin,
        },
      });

      if (googleError) throw googleError;
    } catch (err: any) {
      setError(err.message || "Failed to sign in with Google.");
      console.error("Google Auth Error:", err);
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#020617] flex items-start sm:items-center justify-center p-4 pt-16 sm:pt-4 relative overflow-hidden select-none">
      {/* Premium floating ambient backdrop glows */}
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-cyan-500/5 rounded-full blur-3xl -z-10 animate-pulse" style={{ animationDuration: '8s' }} />
      <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-indigo-500/5 rounded-full blur-3xl -z-10 animate-pulse" style={{ animationDuration: '12s' }} />

      <div className="max-w-md w-full bg-[#0b1120]/45 border border-gray-800/80 backdrop-blur-md rounded-3xl p-6 sm:p-10 shadow-2xl flex flex-col justify-between animate-scaleUp">
        <div className="text-center mb-8">
          <div className="w-16 h-16 mx-auto rounded-full bg-gradient-to-tr from-cyan-500 to-indigo-500 flex items-center justify-center p-[2px] mb-6 shadow-[0_0_25px_rgba(6,182,212,0.18)]">
            <div className="w-full h-full bg-[#020617] rounded-full flex items-center justify-center">
              <svg className="w-8 h-8 text-cyan-400" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M18 18.72a9.094 9.094 0 003.741-.479 3 3 0 00-4.682-2.72m.94 3.198.001.031c0 .225-.012.447-.037.666A11.944 11.944 0 0112 21c-2.17 0-4.207-.576-5.963-1.584A6.062 6.062 0 016 18.719m12 0a5.971 5.971 0 00-.941-3.197m0 0A5.995 5.995 0 0012 12.75a5.995 5.995 0 00-5.058 2.772m0 0a3 3 0 00-4.681 2.72 8.986 8.986 0 003.74.477m.94-3.197a5.971 5.971 0 00-.94-3.197M15 6.75a3 3 0 11-6 0 3 3 0 016 0zm6 3a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0zm-13.5 0a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0z" />
              </svg>
            </div>
          </div>
          <h1 
            onClick={() => {
              window.location.href = "/";
            }}
            className="text-xs uppercase tracking-widest text-slate-400 hover:text-cyan-400 transition-all duration-200 cursor-pointer select-none font-bold font-sans mb-2 tracking-[0.2em] active:scale-95"
          >
            IN TOUCH
          </h1>
          <h2 className="text-xl sm:text-2xl font-bold text-white mb-2 leading-tight">
            Stay in touch with the people who <span className="bg-gradient-to-r from-cyan-400 to-indigo-400 bg-clip-text text-transparent">matter</span>.
          </h2>
        </div>

        <form onSubmit={handleAuth} className="space-y-4">
          <div>
            <label htmlFor="email" className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
              Email
            </label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="w-full px-4 py-2.5 bg-[#111827] border border-gray-700/80 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-cyan-500/50 focus:border-cyan-500 transition-all duration-200 text-sm"
              placeholder="your@email.com"
            />
          </div>

          <div>
            <label htmlFor="password" className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
              Password
            </label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={6}
              className="w-full px-4 py-2.5 bg-[#111827] border border-gray-700/80 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-cyan-500/50 focus:border-cyan-500 transition-all duration-200 text-sm"
              placeholder="••••••••"
            />
          </div>

          {error && (
            <div className="p-3 bg-red-900/20 border border-red-800/60 text-red-400 rounded-xl text-xs leading-relaxed animate-fadeIn">
              {error}
            </div>
          )}

          {/* Spaced container for submit button */}
          <div className="pt-3 mt-8">
            <button
              type="submit"
              disabled={loading}
              className="w-full py-3.5 px-4 bg-gradient-to-r from-cyan-500 to-indigo-500 hover:from-cyan-600 hover:to-indigo-600 text-white rounded-full font-bold text-sm shadow-md shadow-cyan-950/20 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 flex items-center justify-center gap-2 group cursor-pointer"
            >
              {loading ? (
                <>
                  <svg className="animate-spin h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  <span>Loading...</span>
                </>
              ) : (
                <>
                  <span>{isSignUp ? "Sign Up" : "Sign In"}</span>
                </>
              )}
            </button>
          </div>
        </form>

        {/* Separator */}
        <div className="flex items-center gap-4 my-6 text-slate-500">
          <div className="h-[1px] flex-1 bg-gray-800/80"></div>
          <span className="text-[10px] uppercase tracking-wider font-semibold text-slate-500">Or continue with</span>
          <div className="h-[1px] flex-1 bg-gray-800/80"></div>
        </div>

        {/* Google Authentication Button */}
        <button
          type="button"
          onClick={handleGoogleSignIn}
          disabled={loading}
          className="w-full py-3.5 px-4 bg-white hover:bg-gray-100 text-gray-900 rounded-full font-bold text-sm shadow-md transition-all duration-200 flex items-center justify-center gap-2.5 cursor-pointer disabled:opacity-50 border border-gray-200 shrink-0"
        >
          <svg className="w-4 h-4" viewBox="0 0 24 24">
            <path
              fill="#EA4335"
              d="M12.24 10.285V14.4h6.887c-.648 2.41-2.519 4.114-5.136 4.114A5.99 5.99 0 0 1 8 12.5a5.99 5.99 0 0 1 5.99-6.013c1.558 0 2.973.57 4.077 1.512l3.078-3.078A10.15 10.15 0 0 0 13.99 2 10.19 10.19 0 0 0 3.8 12.19a10.19 10.19 0 0 0 10.19 10.19c5.69 0 10.14-4 10.14-10.19 0-.616-.057-1.21-.16-1.785H12.24Z"
            />
          </svg>
          <span>Sign In with Google</span>
        </button>

        <div className="mt-8 text-center">
          <button
            onClick={() => setIsSignUp(!isSignUp)}
            className="text-xs sm:text-sm text-gray-400 hover:text-cyan-400 transition-colors font-medium"
          >
            {isSignUp
              ? "Already have an account? Sign in"
              : "Don't have an account? Sign up"}
          </button>
        </div>

        <p className="mt-5 text-[10px] text-center text-gray-500 font-medium">
          No spam. No feeds. Just your people.
        </p>
      </div>
    </div>
  );
}
