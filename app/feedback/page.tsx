"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { useRouter } from "next/navigation";
import type { User } from "@supabase/supabase-js";

export default function FeedbackPage() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [feedback, setFeedback] = useState("");

  const router = useRouter();

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (!session) {
        router.push("/auth");
        return;
      }

      setUser(session.user);
      
      // Load user info
      const { data: userData } = await supabase
        .from("users")
        .select("name, email")
        .eq("id", session.user.id)
        .single();

      if (userData) {
        setName(userData.name || session.user.email?.split("@")[0] || "");
        setEmail(userData.email || session.user.email || "");
      } else {
        // Fallback to auth user email
        setName(session.user.email?.split("@")[0] || "");
        setEmail(session.user.email || "");
      }

      setLoading(false);
    });
  }, [router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    if (!name.trim() || !email.trim() || !feedback.trim()) {
      setError("Please fill in all fields");
      return;
    }

    setSubmitting(true);
    setError("");
    setSuccess(false);

    try {
      const { error: submitError } = await supabase
        .from("feedback")
        .insert([
          {
            user_id: user.id,
            name: name.trim(),
            email: email.trim(),
            feedback: feedback.trim(),
          },
        ]);

      if (submitError) throw submitError;

      setSuccess(true);
      setFeedback(""); // Clear feedback field
      
      // Redirect after 2 seconds
      setTimeout(() => {
        router.push("/");
      }, 2000);
    } catch (err: any) {
      setError(err.message || "Failed to submit feedback. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#020617] flex items-center justify-center">
        <div className="text-white">Loading...</div>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  return (
    <div className="min-h-screen bg-[#020617] text-white flex flex-col">
      <div className="max-w-4xl mx-auto p-4 sm:p-8 flex-1 w-full">
        <div className="mb-8">
          <button
            onClick={() => router.back()}
            className="text-gray-400 hover:text-white mb-4 flex items-center gap-2"
          >
            ← Back
          </button>
          <h1 className="text-sm uppercase tracking-widest text-gray-400 mb-2">
            FEEDBACK
          </h1>
          <h2 className="text-3xl font-bold">Share Your Thoughts</h2>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="bg-[#0b1120] border border-gray-800 rounded-lg p-4 sm:p-6">
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Name
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                  className="w-full px-4 py-2 bg-[#111827] border border-gray-700 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-cyan-500"
                  placeholder="Your name"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Email
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="w-full px-4 py-2 bg-[#111827] border border-gray-700 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-cyan-500"
                  placeholder="your@email.com"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Feedback
                </label>
                <textarea
                  value={feedback}
                  onChange={(e) => setFeedback(e.target.value)}
                  required
                  rows={6}
                  className="w-full px-4 py-2 bg-[#111827] border border-gray-700 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-cyan-500 resize-none"
                  placeholder="Share your thoughts, suggestions, or report any issues..."
                />
              </div>
            </div>
          </div>

          {/* Status Messages */}
          {error && (
            <div className="p-3 bg-red-900/20 border border-red-800 text-red-400 rounded-md text-sm">
              {error}
            </div>
          )}

          {success && (
            <div className="p-3 bg-green-900/20 border border-green-800 text-green-400 rounded-md text-sm">
              Thank you for your feedback! Redirecting...
            </div>
          )}

          {/* Submit Button */}
          <div className="flex justify-start">
            <button
              type="submit"
              disabled={submitting}
              className="bg-cyan-500 hover:bg-cyan-600 text-white py-3 px-6 rounded-md disabled:bg-gray-600 disabled:cursor-not-allowed transition-colors font-medium"
            >
              {submitting ? "Submitting..." : "Submit"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

