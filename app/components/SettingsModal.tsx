"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { useRouter } from "next/navigation";
import type { User } from "@supabase/supabase-js";

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  user: User;
  contactsCount: number;
  onSuccess: () => Promise<void>;
}

export default function SettingsModal({
  isOpen,
  onClose,
  user,
  contactsCount,
  onSuccess
}: SettingsModalProps) {
  const [name, setName] = useState("");
  const [defaultCadence, setDefaultCadence] = useState(30);
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState("");
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const router = useRouter();

  // Load settings on open
  useEffect(() => {
    if (isOpen && user) {
      setError("");
      setSuccess(false);
      setShowDeleteConfirm(false);
      setSaving(false);
      setDeleting(false);

      const loadSettings = async () => {
        try {
          const { data, error: selectError } = await supabase
            .from("users")
            .select("*")
            .eq("id", user.id)
            .single();
          
          if (selectError && selectError.code !== "PGRST116") {
            console.error("Error loading settings:", selectError);
          }
          if (data) {
            setName(data.name || "");
            setDefaultCadence(data.default_cadence_days || 30);
          }
        } catch (err) {
          console.error("Catch in loading settings:", err);
        }
      };

      loadSettings();
    }
  }, [isOpen, user]);

  if (!isOpen) return null;

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setSaving(true);
    setError("");
    setSuccess(false);

    try {
      const updateData = {
        name: name.trim() || null,
        default_cadence_days: defaultCadence,
      };

      const { error } = await supabase
        .from("users")
        .update(updateData)
        .eq("id", user.id);

      if (error) throw error;
      setSuccess(true);

      // Sync and reload contacts on parent
      await onSuccess();

      setTimeout(() => {
        setSuccess(false);
        onClose();
      }, 1200);
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
      // 1. Delete contacts (cascade takes care of touchpoints)
      const { error: contactsError } = await supabase
        .from("contacts")
        .delete()
        .eq("user_id", user.id);
      if (contactsError) throw contactsError;

      // 2. Delete public user profile
      const { error: userError } = await supabase
        .from("users")
        .delete()
        .eq("id", user.id);
      if (userError) throw userError;

      // 3. Delete auth.users account using RPC helper
      try {
        await supabase.rpc('delete_auth_user');
      } catch (e) {
        console.error("Error calling delete_auth_user RPC:", e);
      }

      // 4. Sign out and redirect
      await supabase.auth.signOut();
      router.push("/auth");
    } catch (err: any) {
      setError(err.message || "Failed to delete account");
      setDeleting(false);
      setShowDeleteConfirm(false);
    }
  };

  return (
    <div 
      className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 z-50 animate-fadeIn cursor-default"
      onClick={onClose}
    >
      <div 
        className="bg-[#0b1120] border border-gray-800 rounded-3xl max-w-md w-full overflow-hidden animate-scaleUp shadow-2xl flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-6 py-5 border-b border-gray-800/80 flex justify-between items-center shrink-0">
          <h3 className="text-xl font-bold text-white">Settings</h3>
        </div>

        {/* Form / Confirm Container */}
        <form onSubmit={handleSave} className="p-6 space-y-6">
          {showDeleteConfirm ? (
            <div className="space-y-4 animate-fadeIn">
              <h4 className="text-red-500 font-semibold text-base">Delete Your Account?</h4>
              <p className="text-sm text-gray-400 leading-relaxed">
                This is a destructive action. This will permanently delete your user account, profile settings, and <span className="text-white font-semibold">all {contactsCount} contacts</span> along with their touchpoint histories.
              </p>
              <div className="flex gap-3 justify-end pt-2">
                <button
                  type="button"
                  onClick={() => setShowDeleteConfirm(false)}
                  className="w-12 h-12 flex items-center justify-center text-gray-400 hover:text-white border border-gray-700 rounded-full hover:border-gray-600 hover:bg-[#111827] transition-all duration-200 cursor-pointer"
                  title="Cancel"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
                <button
                  type="button"
                  onClick={handleDeleteAccount}
                  disabled={deleting}
                  className="w-12 h-12 flex items-center justify-center text-red-500 hover:text-white border border-red-500/50 rounded-full hover:border-red-500 hover:bg-red-500/10 transition-all duration-200 disabled:opacity-50 cursor-pointer"
                  title="Confirm Permanent Delete"
                >
                  {deleting ? (
                    <svg className="animate-spin h-5 w-5 text-red-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                  ) : (
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  )}
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
                  Preferred Name
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full px-4 py-2 bg-[#111827] border border-gray-700 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-cyan-500 text-sm"
                  placeholder="John Doe"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
                  Default Touchpoint Cadence
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    value={defaultCadence}
                    onChange={(e) => {
                      const val = e.target.value;
                      if (val === "") setDefaultCadence(0);
                      else {
                        const num = parseInt(val);
                        if (!isNaN(num) && num > 0) setDefaultCadence(num);
                      }
                    }}
                    min="1"
                    className="w-24 px-4 py-2 bg-[#111827] border border-gray-700 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-cyan-500 text-sm"
                  />
                  <span className="text-gray-400 text-sm">days</span>
                </div>
              </div>

              {success && (
                <div className="p-3 bg-green-900/20 border border-green-800 text-green-400 rounded-md text-xs">
                  Settings saved successfully!
                </div>
              )}
              {error && (
                <div className="p-3 bg-red-900/20 border border-red-800 text-red-400 rounded-md text-xs">
                  {error}
                </div>
              )}

              <div className="pt-4 border-t border-gray-800/80 flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => setShowDeleteConfirm(true)}
                  className="text-xs text-red-500 hover:text-red-400 hover:underline font-semibold cursor-pointer bg-transparent border-0"
                >
                  Delete Account
                </button>

                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={onClose}
                    className="w-12 h-12 flex items-center justify-center text-gray-400 hover:text-white border border-gray-700 rounded-full hover:border-gray-600 hover:bg-[#111827] transition-all duration-200 cursor-pointer"
                    title="Cancel"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                  <button
                    type="submit"
                    disabled={saving}
                    className="w-12 h-12 flex items-center justify-center text-cyan-400 hover:text-white border border-cyan-500/50 rounded-full hover:border-cyan-500 hover:bg-cyan-500/10 transition-all duration-200 disabled:opacity-50 cursor-pointer"
                    title="Save Settings"
                  >
                    {saving ? (
                      <svg className="animate-spin h-5 w-5 text-cyan-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                    ) : (
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                      </svg>
                    )}
                  </button>
                </div>
              </div>
            </div>
          )}
        </form>
      </div>
    </div>
  );
}
