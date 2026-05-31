"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { Contact } from "@/lib/utils";

interface ConfigurePhoneModalProps {
  isOpen: boolean;
  onClose: () => void;
  contact: Contact | null;
  userId: string;
  onSuccess: () => Promise<void>;
}

export default function ConfigurePhoneModal({
  isOpen,
  onClose,
  contact,
  userId,
  onSuccess,
}: ConfigurePhoneModalProps) {
  const [phone, setPhone] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  // Initialize input state when modal opens
  useEffect(() => {
    if (isOpen && contact) {
      setPhone(contact.phone || "");
      setError("");
    }
  }, [isOpen, contact]);

  if (!isOpen || !contact) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userId || !contact) return;
    setSaving(true);
    setError("");

    try {
      const { error: updateError } = await supabase
        .from("contacts")
        .update({
          phone: phone.trim() || null,
        })
        .eq("id", contact.id)
        .eq("user_id", userId);

      if (updateError) throw updateError;

      await onSuccess();
      onClose();
    } catch (err: any) {
      setError(err.message || "Failed to save phone number");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 z-50 animate-fadeIn cursor-default"
      onClick={onClose}
    >
      <div
        className="bg-[#0b1120] border border-gray-800 rounded-3xl max-w-sm w-full overflow-hidden animate-scaleUp shadow-2xl flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-6 py-5 border-b border-gray-800/80 flex flex-col shrink-0">
          <h3 className="text-xl font-bold text-white leading-tight">
            Add Phone Number
          </h3>
          <p className="text-xs text-gray-400 mt-1 uppercase tracking-wider">
            for {contact.name}
          </p>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          <p className="text-sm text-gray-400 leading-relaxed">
            Please configure a phone number for <strong className="text-white">{contact.name}</strong> to enable direct Call and Text actions.
          </p>

          <div>
            <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
              Phone Number
            </label>
            <input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              required
              autoFocus
              className="w-full px-4 py-2 bg-[#111827] border border-gray-700 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-cyan-500 text-sm"
              placeholder="+1 (555) 000-0000"
            />
          </div>

          {error && (
            <div className="p-3 bg-red-900/20 border border-red-800 text-red-400 rounded-md text-xs">
              {error}
            </div>
          )}

          {/* Footer Buttons */}
          <div className="pt-4 border-t border-gray-800/80 flex justify-end gap-3 shrink-0">
            <button
              type="button"
              onClick={onClose}
              className="w-12 h-12 flex items-center justify-center text-gray-400 hover:text-white border border-gray-700 rounded-full hover:border-gray-600 hover:bg-[#111827] transition-all duration-200 cursor-pointer"
              title="Cancel"
            >
              <svg
                className="w-5 h-5"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
            <button
              type="submit"
              disabled={saving}
              className="w-12 h-12 flex items-center justify-center text-cyan-400 hover:text-white border border-cyan-500/50 rounded-full hover:border-cyan-500 hover:bg-cyan-500/10 transition-all duration-200 disabled:opacity-50 cursor-pointer"
              title="Save Phone Number"
            >
              {saving ? (
                <svg
                  className="animate-spin h-5 w-5 text-cyan-400"
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                >
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                  ></path>
                </svg>
              ) : (
                <svg
                  className="w-5 h-5"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.5"
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                </svg>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
