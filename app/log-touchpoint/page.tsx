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
          .select("id, name, relationship")
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
            className="text-gray-400 hover:text-white mb-4 flex items-center gap-2"
          >
            ← Back
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
              className="w-full px-4 py-2 bg-[#111827] border border-gray-700 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-cyan-500 text-sm sm:text-base"
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

          <div className="flex gap-3">
            <button
              type="button"
              onClick={handleCancel}
              className="flex-1 px-4 py-3 text-gray-400 hover:text-white border border-gray-700 rounded-md hover:border-gray-600 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="flex-1 bg-cyan-500 hover:bg-cyan-600 text-white py-3 px-4 rounded-md disabled:bg-gray-600 disabled:cursor-not-allowed transition-colors font-medium"
            >
              {saving ? "Saving..." : "Log Touchpoint"}
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

