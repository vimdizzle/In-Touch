"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useRouter } from "next/navigation";
import type { User } from "@supabase/supabase-js";

export default function Home() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    // Check if user is logged in
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        setUser(session.user);
      } else {
        router.push("/auth");
      }
      setLoading(false);
    });

    // Listen for auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session) {
        setUser(session.user);
      } else {
        router.push("/auth");
      }
    });

    return () => subscription.unsubscribe();
  }, [router]);

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    router.push("/auth");
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
    <div className="min-h-screen bg-[#020617] text-white">
      <div className="max-w-7xl mx-auto p-8">
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-sm uppercase tracking-widest text-gray-400 mb-2">
              TODAY'S MISSION
            </h1>
            <h2 className="text-3xl font-bold">Here's who to reach out to.</h2>
          </div>
          <button
            onClick={handleSignOut}
            className="px-4 py-2 text-sm text-gray-400 hover:text-white border border-gray-700 rounded-md hover:border-gray-600 transition-colors"
          >
            Sign Out
          </button>
        </div>

        <div className="bg-[#0b1120] border border-gray-800 rounded-lg p-8">
          <p className="text-gray-400">
            Welcome! Database schema is set up. Next: Add contacts functionality.
          </p>
          <p className="text-sm text-gray-500 mt-2">
            Email: {user.email}
          </p>
        </div>
      </div>
    </div>
  );
}
