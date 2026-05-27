"use client";

import { useState, useEffect, Suspense } from "react";
import { supabase } from "@/lib/supabase";
import { useRouter, useSearchParams } from "next/navigation";
import type { User } from "@supabase/supabase-js";

const CHANNELS = [
  { value: "call", label: "Call" },
  { value: "text", label: "Text" },
  { value: "video", label: "Video" },
  { value: "in_person", label: "In Person" },
  { value: "email", label: "Email" },
  { value: "other", label: "Other" },
];

interface Contact {
  id: string;
  name: string;
  relationship: string;
  is_pinned?: boolean;
}

function LogTouchpointForm() {
  const [user, setUser] = useState<User | null>(null);
  const [contact, setContact] = useState<Contact | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const router = useRouter();
  const searchParams = useSearchParams();
  const contactId = searchParams.get("contactId");

  // Form state
  const [channel, setChannel] = useState("call");
  const [contactDate, setContactDate] = useState(
    new Date().toISOString().split("T")[0]
  );
  const [note, setNote] = useState("");

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (!session) {
        router.push("/auth");
        return;
      }

      setUser(session.user);

      if (contactId) {
        // Load contact details
        const { data, error } = await supabase
          .from("contacts")
          .select("id, name, relationship, is_pinned")
          .eq("id", contactId)
          .eq("user_id", session.user.id)
          .single();

        if (error || !data) {
          setError("Contact not found");
        } else {
          setContact(data);
        }
      }

      setLoading(false);
    });
  }, [contactId, router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!contact || !user) return;

    setSaving(true);
    setError("");

    try {
      const { error: insertError } = await supabase
        .from("touchpoints")
        .insert([
          {
            contact_id: contact.id,
            channel: channel,
            contact_date: contactDate,
            note: note.trim() || null,
          },
        ]);

      if (insertError) throw insertError;

      // If contact is pinned, unpin it after logging touchpoint
      if (contact.is_pinned) {
        const { error: unpinError } = await supabase
          .from("contacts")
          .update({ is_pinned: false })
          .eq("id", contact.id)
          .eq("user_id", user.id);

        if (unpinError) {
          // Log error but don't fail the touchpoint creation
          console.error("Error unpinning contact:", unpinError);
        }
      }

      // Redirect back to home
      router.push("/");
    } catch (err: any) {
      setError(err.message || "Failed to log touchpoint");
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    router.back();
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#020617] flex items-center justify-center">
        <div className="text-white">Loading...</div>
      </div>
    );
  }

  if (!user || !contact) {
    return (
      <div className="min-h-screen bg-[#020617] flex items-center justify-center">
        <div className="text-white">Contact not found</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#020617] text-white">
      <div className="max-w-2xl mx-auto p-4 sm:p-8">
        <div className="mb-8">
          <button
            onClick={handleCancel}
            className="w-10 h-10 flex items-center justify-center text-gray-400 hover:text-white border border-gray-700 rounded-full hover:border-gray-600 hover:bg-[#111827] transition-all duration-200 mb-4"
            title="Back"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
            </svg>
          </button>
          <h1 className="text-sm uppercase tracking-widest text-gray-400 mb-2">
            LOG TOUCHPOINT
          </h1>
          <h2 className="text-3xl font-bold mb-2">Log interaction with {contact.name}</h2>
          <p className="text-gray-400">
            Record when and how you connected with {contact.name}.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="bg-[#0b1120] border border-gray-800 rounded-lg p-4 sm:p-6 space-y-6">
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Channel *
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {CHANNELS.map((ch) => (
                <button
                  key={ch.value}
                  type="button"
                  onClick={() => setChannel(ch.value)}
                  className={`px-4 py-3 rounded-md border transition-all ${
                    channel === ch.value
                      ? "bg-cyan-500 border-cyan-500 text-white"
                      : "bg-[#111827] border-gray-700 text-gray-300 hover:border-gray-600"
                  }`}
                >
                  {ch.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Date *
            </label>
            <input
              type="date"
              value={contactDate}
              onChange={(e) => setContactDate(e.target.value)}
              max={new Date().toISOString().split("T")[0]}
              required
              className="w-full max-w-full px-4 py-2 bg-[#111827] border border-gray-700 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-cyan-500 text-sm sm:text-base box-border"
              style={{ WebkitAppearance: 'none', appearance: 'none' }}
            />
            <p className="text-xs text-gray-500 mt-1">
              Defaults to today. You can select a past date.
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Note (optional)
            </label>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={4}
              className="w-full px-4 py-2 bg-[#111827] border border-gray-700 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-cyan-500"
              placeholder="What did you talk about? Any follow-ups needed?"
            />
          </div>

          {error && (
            <div className="p-3 bg-red-900/20 border border-red-800 text-red-400 rounded-md text-sm">
              {error}
            </div>
          )}

          <div className="flex gap-4 justify-center">
            <button
              type="button"
              onClick={handleCancel}
              className="w-12 h-12 flex items-center justify-center text-red-500 hover:text-white border border-red-500/50 rounded-full hover:border-red-500 hover:bg-red-500/10 transition-all duration-200 disabled:opacity-50"
              title="Cancel"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
            <button
              type="submit"
              disabled={saving}
              className="w-12 h-12 flex items-center justify-center text-cyan-400 hover:text-white border border-cyan-500/50 rounded-full hover:border-cyan-500 hover:bg-cyan-500/10 transition-all duration-200 disabled:opacity-50"
              title="Log Touchpoint"
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

export default function LogTouchpointPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-[#020617] flex items-center justify-center">
        <div className="text-white">Loading...</div>
      </div>
    }>
      <LogTouchpointForm />
    </Suspense>
  );
}

