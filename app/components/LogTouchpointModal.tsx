"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";

interface LogTouchpointModalProps {
  isOpen: boolean;
  onClose: () => void;
  contactId: string | null;
  contactName: string | null;
  isPinned: boolean;
  userId: string;
  onSuccess: () => Promise<void>;
}

export default function LogTouchpointModal({
  isOpen,
  onClose,
  contactId,
  contactName,
  isPinned,
  userId,
  onSuccess
}: LogTouchpointModalProps) {
  const [channel, setChannel] = useState("call");
  const [date, setDate] = useState("");
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  // Initialize date on mount or open
  useEffect(() => {
    if (isOpen) {
      setDate(new Date().toISOString().split("T")[0]);
      setChannel("call");
      setNote("");
      setError("");
    }
  }, [isOpen]);

  if (!isOpen || !contactId) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!contactId || !userId) return;
    setSaving(true);
    setError("");

    try {
      const { error: insertError } = await supabase
        .from("touchpoints")
        .insert([
          {
            contact_id: contactId,
            channel,
            contact_date: date,
            note: note.trim() || null,
          },
        ]);

      if (insertError) throw insertError;

      // Unpin contact if pinned
      if (isPinned) {
        await supabase
          .from("contacts")
          .update({ is_pinned: false })
          .eq("id", contactId)
          .eq("user_id", userId);
      }

      await onSuccess();
      onClose();
    } catch (err: any) {
      setError(err.message || "Failed to log touchpoint");
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
        className="bg-[#0b1120] border border-gray-800 rounded-3xl max-w-md w-full overflow-hidden animate-scaleUp shadow-2xl flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-6 py-5 border-b border-gray-800/80 flex justify-between items-center shrink-0">
          <h3 className="text-xl font-bold text-white">
            Log Touchpoint {contactName ? `with ${contactName}` : ""}
          </h3>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
              Method
            </label>
            <select
              value={channel}
              onChange={(e) => setChannel(e.target.value)}
              className="w-full px-4 py-2 bg-[#111827] border border-gray-700 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-cyan-500 text-sm"
            >
              <option value="call">Call</option>
              <option value="text">Text Message</option>
              <option value="video">Video Call</option>
              <option value="in_person">In Person</option>
              <option value="email">Email</option>
              <option value="other">Other</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
              Date
            </label>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              required
              className="w-full h-[38px] px-4 py-2 bg-[#111827] border border-gray-700 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-cyan-500 text-sm appearance-none"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
              Notes
            </label>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={3}
              className="w-full px-4 py-2 bg-[#111827] border border-gray-700 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-cyan-500 text-sm"
              placeholder="What did you talk about?"
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
              <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
            <button
              type="submit"
              disabled={saving}
              className="w-12 h-12 flex items-center justify-center text-cyan-400 hover:text-white border border-cyan-500/50 rounded-full hover:border-cyan-500 hover:bg-cyan-500/10 transition-all duration-200 disabled:opacity-50 cursor-pointer"
              title="Log Connection"
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
        </form>
      </div>
    </div>
  );
}
