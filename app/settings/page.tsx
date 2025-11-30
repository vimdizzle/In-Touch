"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { useRouter } from "next/navigation";
import type { User } from "@supabase/supabase-js";

interface UserSettings {
  id: string;
  email?: string;
  name?: string;
  daily_reminder_time?: string;
  default_cadence_days?: number;
}

export default function SettingsPage() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const [name, setName] = useState("");
  const [defaultCadenceDays, setDefaultCadenceDays] = useState(30);

  const router = useRouter();

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (!session) {
        router.push("/auth");
        return;
      }

      setUser(session.user);
      await loadSettings(session.user.id);
      setLoading(false);
    });
  }, [router]);

  const loadSettings = async (userId: string) => {
    try {
      // Load user profile
      const { data: userData, error: userError } = await supabase
        .from("users")
        .select("*")
        .eq("id", userId)
        .single();

      if (userError && userError.code !== "PGRST116") {
        // PGRST116 = not found, which is okay for new users
        console.error("Error loading user:", userError);
      }

      if (userData) {
        setName(userData.name || "");
        // For now, we'll store settings in the users table
        // In a future version, you might want a separate settings table
        // Handle case where columns might not exist yet (graceful fallback)
        setDefaultCadenceDays((userData as any).default_cadence_days || 30);
      } else {
        // Create user profile if it doesn't exist
        const { data: newUser } = await supabase.auth.getUser();
        if (newUser.user) {
          // Only insert fields that exist (graceful fallback)
          const insertData: any = {
            id: newUser.user.id,
            email: newUser.user.email,
          };
          
          // Try to include settings fields, but don't fail if they don't exist
          try {
            await supabase.from("users").insert([
              {
                ...insertData,
                default_cadence_days: 30,
              },
            ]);
          } catch {
            // If columns don't exist, just insert basic fields
            await supabase.from("users").insert([insertData]);
          }
        }
      }
    } catch (err) {
      console.error("Error loading settings:", err);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    setSaving(true);
    setError("");
    setSuccess(false);

    try {
      // Update user profile
      // Only update fields that exist in the database
      const updateData: any = {
        name: name.trim() || null,
      };
      
      // Check if columns exist by trying to update them (graceful fallback)
      // If they don't exist, we'll just update name
      try {
        const { error: updateError } = await supabase
          .from("users")
          .update({
            ...updateData,
            default_cadence_days: defaultCadenceDays,
          })
          .eq("id", user.id);

        if (updateError) {
          // If columns don't exist, just update name
          if (updateError.message.includes("default_cadence_days")) {
            const { error: nameOnlyError } = await supabase
              .from("users")
              .update(updateData)
              .eq("id", user.id);
            
            if (nameOnlyError) throw nameOnlyError;
          } else {
            throw updateError;
          }
        }
      } catch (err: any) {
        // Fallback: just update name if other fields fail
        const { error: nameOnlyError } = await supabase
          .from("users")
          .update(updateData)
          .eq("id", user.id);
        
        if (nameOnlyError) throw nameOnlyError;
      }

      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } catch (err: any) {
      setError(err.message || "Failed to save settings");
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteAccount = async () => {
    if (!user) return;

    setDeleting(true);
    setError("");

    try {
      // Step 1: Delete all contacts (this will cascade delete touchpoints due to ON DELETE CASCADE)
      const { error: contactsError } = await supabase
        .from("contacts")
        .delete()
        .eq("user_id", user.id);

      if (contactsError) throw contactsError;

      // Step 2: Delete user from users table
      const { error: userError } = await supabase
        .from("users")
        .delete()
        .eq("id", user.id);

      if (userError) throw userError;

      // Step 3: Delete from auth.users using database function
      // This requires the supabase-delete-user-function.sql migration to be run
      // The function automatically uses the current authenticated user's ID
      const { error: authError } = await supabase.rpc('delete_auth_user');

      if (authError) {
        // If the function doesn't exist or fails, log but continue
        // The user data is already deleted, so the account is effectively deleted
        console.error("Error deleting auth user (function may not exist):", authError);
        // Still sign out and redirect
      }

      // Step 4: Sign out and redirect to auth page
      await supabase.auth.signOut();
      router.push("/auth");
    } catch (err: any) {
      setError(err.message || "Failed to delete account. Please try again.");
      setDeleting(false);
      setShowDeleteConfirm(false);
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
    <div className="min-h-screen bg-[#020617] text-white">
      <div className="max-w-4xl mx-auto p-4 sm:p-8">
        <div className="mb-8">
          <button
            onClick={() => router.push("/")}
            className="text-gray-400 hover:text-white mb-4 flex items-center gap-2"
          >
← Back
          </button>
          <h1 className="text-sm uppercase tracking-widest text-gray-400 mb-2">
            SETTINGS
          </h1>
          <h2 className="text-3xl font-bold">Account & Preferences</h2>
        </div>

        <form onSubmit={handleSave} className="space-y-6">
          {/* Account Info */}
          <div className="bg-[#0b1120] border border-gray-800 rounded-lg p-4 sm:p-6">
            <h3 className="text-lg font-semibold mb-4">Account Information</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Email
                </label>
                <input
                  type="email"
                  value={user.email || ""}
                  disabled
                  className="w-full px-4 py-2 bg-[#111827] border border-gray-700 rounded-md text-gray-400 cursor-not-allowed"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Email cannot be changed here. Contact support if you need to update it.
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Name
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full px-4 py-2 bg-[#111827] border border-gray-700 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-cyan-500"
                  placeholder="Your name"
                />
              </div>
            </div>
          </div>

          {/* Preferences */}
          <div className="bg-[#0b1120] border border-gray-800 rounded-lg p-4 sm:p-6">
            <h3 className="text-lg font-semibold mb-4">Preferences</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Default Cadence for New Contacts
                </label>
                <div className="flex items-center gap-3">
                  <input
                    type="number"
                    value={defaultCadenceDays}
                    onChange={(e) =>
                      setDefaultCadenceDays(parseInt(e.target.value) || 30)
                    }
                    min="1"
                    className="w-32 px-4 py-2 bg-[#111827] border border-gray-700 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-cyan-500"
                  />
                  <span className="text-gray-400">days</span>
                </div>
                <p className="text-xs text-gray-500 mt-1">
                  This will be the default cadence when adding new contacts
                </p>
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
              Settings saved successfully!
            </div>
          )}

          {/* Save Button */}
          <div className="flex justify-start">
            <button
              type="submit"
              disabled={saving}
              className="bg-cyan-500 hover:bg-cyan-600 text-white py-3 px-6 rounded-md disabled:bg-gray-600 disabled:cursor-not-allowed transition-colors font-medium"
            >
              {saving ? "Saving..." : "Save"}
            </button>
          </div>
        </form>

        {/* Delete Account Section */}
        <div className="mt-12 border-t border-gray-800 pt-8">
          <div className="bg-[#0b1120] border border-red-800/50 rounded-lg p-4 sm:p-6">
            <h3 className="text-lg font-semibold mb-2 text-red-400">Danger Zone</h3>
            <p className="text-sm text-gray-400 mb-4">
              Once you delete your account, there is no going back. This will permanently delete your account and all your contacts.
            </p>
            <button
              onClick={() => setShowDeleteConfirm(true)}
              disabled={deleting}
              className="bg-red-600 hover:bg-red-700 text-white py-2 px-4 rounded-md transition-colors font-medium text-sm disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {deleting ? "Deleting..." : "Delete Account"}
            </button>
          </div>
        </div>

        {/* Delete Confirmation Modal */}
        {showDeleteConfirm && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-[#0b1120] border border-red-800 rounded-lg p-6 max-w-md w-full">
              <h3 className="text-xl font-bold text-red-400 mb-4">Delete Account</h3>
              <p className="text-gray-300 mb-6">
                Are you sure you want to delete your account? This action cannot be undone. All your contacts and data will be permanently deleted.
              </p>
              <div className="flex gap-3 justify-end">
                <button
                  onClick={() => {
                    setShowDeleteConfirm(false);
                    setError("");
                  }}
                  disabled={deleting}
                  className="px-4 py-2 text-gray-400 hover:text-white border border-gray-700 rounded-md hover:border-gray-600 transition-colors disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  onClick={handleDeleteAccount}
                  disabled={deleting}
                  className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-md transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {deleting ? "Deleting..." : "Delete Account"}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

