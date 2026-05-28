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

  return (
    <div className="min-h-screen bg-[#020617] flex items-start sm:items-center justify-center p-4 pt-16 sm:pt-4">
      <div className="max-w-md w-full bg-[#0b1120] border border-gray-800 rounded-lg p-6 sm:p-8">
        <div className="text-center mb-7 sm:mb-8">
          <h1 className="text-sm uppercase tracking-widest text-gray-400 mb-2">
            IN TOUCH
          </h1>
          <h2 className="text-2xl font-bold text-white mb-2">
            Stay in touch with the people who matter.
          </h2>
        </div>

        <form onSubmit={handleAuth} className="space-y-4">
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-gray-300 mb-2">
              Email
            </label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="w-full px-4 py-2 bg-[#111827] border border-gray-700 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent"
              placeholder="your@email.com"
            />
          </div>

          <div>
            <label htmlFor="password" className="block text-sm font-medium text-gray-300 mb-2">
              Password
            </label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={6}
              className="w-full px-4 py-2 bg-[#111827] border border-gray-700 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent"
              placeholder="••••••••"
            />
          </div>

          {error && (
            <div className="p-3 bg-red-900/20 border border-red-800 text-red-400 rounded-md text-sm">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 px-4 bg-gradient-to-r from-cyan-500 to-indigo-500 hover:from-cyan-600 hover:to-indigo-600 text-white rounded-full font-bold text-xs shadow-md shadow-cyan-950/20 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 flex items-center justify-center gap-2 group cursor-pointer"
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
        </form>

        <div className="mt-6 text-center">
          <button
            onClick={() => setIsSignUp(!isSignUp)}
            className="text-sm text-gray-400 hover:text-cyan-400 transition-colors"
          >
            {isSignUp
              ? "Already have an account? Sign in"
              : "Don't have an account? Sign up"}
          </button>
        </div>

        <p className="mt-4 text-xs text-center text-gray-500">
          No spam. No feeds. Just your people.
        </p>
      </div>
    </div>
  );
}

