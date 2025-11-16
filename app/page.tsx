"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabase";

export default function Home() {
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setSuccess(false);
    setError("");

    try {
      // Store a simple message in Supabase
      // Note: You'll need to create a table called 'messages' in your Supabase database
      // with columns: id (uuid, primary key), message (text), created_at (timestamp)
      const { data, error: insertError } = await supabase
        .from("messages")
        .insert([{ message: message }])
        .select();

      if (insertError) {
        throw insertError;
      }

      setSuccess(true);
      setMessage("");
    } catch (err: any) {
      setError(err.message || "Failed to save message");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-100 flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white rounded-lg shadow-lg p-8">
        <h1 className="text-3xl font-bold text-gray-800 mb-2">In Touch</h1>
        <p className="text-gray-600 mb-6">Store a simple message in Supabase</p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="message" className="block text-sm font-medium text-gray-700 mb-2">
              Message
            </label>
            <input
              id="message"
              type="text"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Enter your message..."
              className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-blue-500 text-white py-2 px-4 rounded-md hover:bg-blue-600 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
          >
            {loading ? "Saving..." : "Save to Supabase"}
          </button>
        </form>

        {success && (
          <div className="mt-4 p-3 bg-green-100 text-green-700 rounded-md">
            ✅ Message saved successfully!
          </div>
        )}

        {error && (
          <div className="mt-4 p-3 bg-red-100 text-red-700 rounded-md">
            ❌ Error: {error}
          </div>
        )}

        <div className="mt-6 pt-6 border-t border-gray-200">
          <p className="text-sm text-gray-500">
            Make sure you have:
          </p>
          <ul className="text-sm text-gray-500 mt-2 list-disc list-inside">
            <li>Created a table named "messages" in Supabase</li>
            <li>Added columns: id (uuid), message (text), created_at (timestamp)</li>
            <li>Set up your .env.local file with Supabase credentials</li>
          </ul>
        </div>
      </div>
    </div>
  );
}

