"use client";

import { useState, useEffect, Suspense } from "react";
import { supabase } from "@/lib/supabase";
import { useRouter, useParams } from "next/navigation";
import type { User } from "@supabase/supabase-js";

interface Contact {
  id: string;
  name: string;
  relationship: string;
  location?: string | null;
  birthday?: string | null;
  cadence_days: number;
  notes?: string | null;
  created_at: string;
}

interface Touchpoint {
  id: string;
  channel: string;
  contact_date: string;
  note?: string;
  created_at: string;
}

const CADENCE_PRESETS = [
  { label: "Weekly", days: 7 },
  { label: "Monthly", days: 30 },
  { label: "Quarterly", days: 90 },
  { label: "Yearly", days: 365 },
];

const CHANNEL_LABELS: Record<string, string> = {
  call: "Call",
  text: "Text",
  video: "Video",
  in_person: "In Person",
  email: "Email",
  other: "Other",
};

function ContactDetailContent() {
  const [user, setUser] = useState<User | null>(null);
  const [contact, setContact] = useState<Contact | null>(null);
  const [touchpoints, setTouchpoints] = useState<Touchpoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editingNotes, setEditingNotes] = useState(false);
  const [notes, setNotes] = useState("");
  const [cadenceDays, setCadenceDays] = useState(30);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const router = useRouter();
  const params = useParams();
  const contactId = params.id as string;

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (!session) {
        router.push("/auth");
        return;
      }

      setUser(session.user);
      await loadContact(session.user.id);
      await loadTouchpoints();
      setLoading(false);
    });
  }, [contactId, router]);

  const loadContact = async (userId: string) => {
    const { data, error } = await supabase
      .from("contacts")
      .select("*")
      .eq("id", contactId)
      .eq("user_id", userId)
      .single();

    if (error || !data) {
      router.push("/");
      return;
    }

    setContact(data);
    setNotes(data.notes || "");
    setCadenceDays(data.cadence_days);
  };

  const loadTouchpoints = async () => {
    const { data, error } = await supabase
      .from("touchpoints")
      .select("*")
      .eq("contact_id", contactId)
      .order("contact_date", { ascending: false });

    if (!error && data) {
      setTouchpoints(data);
    }
  };

  const handleUpdateCadence = async (days: number) => {
    if (!contact || !user) return;

    setSaving(true);
    try {
      const { error } = await supabase
        .from("contacts")
        .update({ cadence_days: days })
        .eq("id", contactId)
        .eq("user_id", user.id);

      if (error) throw error;

      setCadenceDays(days);
      setContact({ ...contact, cadence_days: days });
    } catch (err: any) {
      alert(`Error updating cadence: ${err.message}`);
    } finally {
      setSaving(false);
    }
  };

  const handleSaveNotes = async () => {
    if (!contact || !user) return;

    setSaving(true);
    try {
      const { error } = await supabase
        .from("contacts")
        .update({ notes: notes.trim() || null })
        .eq("id", contactId)
        .eq("user_id", user.id);

      if (error) throw error;

      setContact({ ...contact, notes: notes.trim() || undefined });
      setEditingNotes(false);
    } catch (err: any) {
      alert(`Error saving notes: ${err.message}`);
    } finally {
      setSaving(false);
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  };

  const getLastContactInfo = () => {
    if (touchpoints.length === 0) {
      return { text: "Never contacted", days: null };
    }

    const lastTouchpoint = touchpoints[0];
    const lastDate = new Date(lastTouchpoint.contact_date);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    lastDate.setHours(0, 0, 0, 0);

    const daysAgo = Math.floor(
      (today.getTime() - lastDate.getTime()) / (1000 * 60 * 60 * 24)
    );

    const channel = CHANNEL_LABELS[lastTouchpoint.channel] || lastTouchpoint.channel;
    return {
      text: `${daysAgo} day${daysAgo !== 1 ? "s" : ""} ago via ${channel}`,
      days: daysAgo,
    };
  };

  const getNextDueInfo = () => {
    if (!contact) return null;

    const lastContact = getLastContactInfo();
    if (lastContact.days === null) {
      // Never contacted - due immediately
      return { text: "Due now", status: "overdue" };
    }

    const daysUntilDue = contact.cadence_days - lastContact.days;
    if (daysUntilDue < 0) {
      return {
        text: `Overdue by ${Math.abs(daysUntilDue)} day${Math.abs(daysUntilDue) !== 1 ? "s" : ""}`,
        status: "overdue",
      };
    } else if (daysUntilDue <= 7) {
      return {
        text: `Due in ${daysUntilDue} day${daysUntilDue !== 1 ? "s" : ""}`,
        status: "coming_up",
      };
    } else {
      return {
        text: `Due in ${daysUntilDue} days`,
        status: "on_track",
      };
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#020617] flex items-center justify-center">
        <div className="text-white">Loading...</div>
      </div>
    );
  }

  if (!user || !contact) {
    return null;
  }

  const lastContact = getLastContactInfo();
  const nextDue = getNextDueInfo();

  return (
    <div className="min-h-screen bg-[#020617] text-white">
      <div className="max-w-6xl mx-auto p-4 sm:p-8">
        {/* Header */}
        <div className="mb-8">
          <button
            onClick={() => router.push("/")}
            className="text-gray-400 hover:text-white mb-4 flex items-center gap-2"
          >
            ← Back to Today
          </button>
          <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-4">
            <div>
              <h1 className="text-sm uppercase tracking-widest text-gray-400 mb-2">
                CONTACT DETAIL
              </h1>
              <h2 className="text-3xl sm:text-4xl font-bold mb-2">{contact.name}</h2>
              <p className="text-gray-400 text-sm sm:text-base">
                {contact.relationship}
                {contact.location && ` • ${contact.location}`}
                {contact.birthday && ` • Birthday: ${formatDate(contact.birthday)}`}
              </p>
            </div>
            <button
              onClick={() => router.push(`/log-touchpoint?contactId=${contact.id}`)}
              className="bg-cyan-500 hover:bg-cyan-600 text-white py-2 px-4 sm:px-6 rounded-md transition-colors font-medium text-sm sm:text-base"
            >
              <span className="hidden sm:inline">Log touchpoint</span>
              <span className="sm:hidden">Log</span>
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Left Column */}
          <div className="space-y-6">
            {/* Cadence Card */}
            <div className="bg-[#0b1120] border border-gray-800 rounded-lg p-4 sm:p-6">
              <h3 className="text-lg font-semibold mb-4">Cadence</h3>
              <div className="mb-4">
                <p className="text-sm text-gray-400 mb-2">Connect every</p>
                <div className="flex items-center gap-2 mb-4">
                  <input
                    type="number"
                    value={cadenceDays}
                    onChange={(e) => setCadenceDays(parseInt(e.target.value) || 30)}
                    min="1"
                    className="w-24 px-3 py-2 bg-[#111827] border border-gray-700 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-cyan-500"
                  />
                  <span className="text-gray-400">days</span>
                </div>
                <div className="flex flex-wrap gap-2 mb-2">
                  {CADENCE_PRESETS.map((preset) => (
                    <button
                      key={preset.days}
                      onClick={() => handleUpdateCadence(preset.days)}
                      disabled={saving}
                      className={`px-3 py-1 text-sm rounded-md border transition-colors ${
                        cadenceDays === preset.days
                          ? "bg-cyan-500 border-cyan-500 text-white"
                          : "bg-[#111827] border-gray-700 text-gray-300 hover:border-gray-600"
                      } disabled:opacity-50`}
                    >
                      {preset.label}
                    </button>
                  ))}
                </div>
                {cadenceDays !== contact.cadence_days && (
                  <button
                    onClick={() => handleUpdateCadence(cadenceDays)}
                    disabled={saving}
                    className="text-sm text-cyan-400 hover:text-cyan-300"
                  >
                    Save custom cadence
                  </button>
                )}
              </div>
            </div>

            {/* Status Card */}
            <div className="bg-[#0b1120] border border-gray-800 rounded-lg p-4 sm:p-6">
              <h3 className="text-lg font-semibold mb-4">Status</h3>
              <div className="space-y-3">
                <div>
                  <p className="text-sm text-gray-400 mb-1">Last contacted</p>
                  <p className="text-white">{lastContact.text}</p>
                </div>
                {nextDue && (
                  <div>
                    <p className="text-sm text-gray-400 mb-1">Next due</p>
                    <p
                      className={
                        nextDue.status === "overdue"
                          ? "text-red-400"
                          : nextDue.status === "coming_up"
                          ? "text-yellow-400"
                          : "text-green-400"
                      }
                    >
                      {nextDue.text}
                    </p>
                  </div>
                )}
              </div>
            </div>

            {/* Notes Card */}
            <div className="bg-[#0b1120] border border-gray-800 rounded-lg p-4 sm:p-6">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-semibold">Notes</h3>
                {!editingNotes && (
                  <button
                    onClick={() => setEditingNotes(true)}
                    className="text-sm text-cyan-400 hover:text-cyan-300"
                  >
                    Edit
                  </button>
                )}
              </div>
              {editingNotes ? (
                <div className="space-y-3">
                  <textarea
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    rows={6}
                    className="w-full px-4 py-2 bg-[#111827] border border-gray-700 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-cyan-500"
                    placeholder="Prefers WhatsApp, Ask about new job..."
                  />
                  <div className="flex gap-2">
                    <button
                      onClick={handleSaveNotes}
                      disabled={saving}
                      className="bg-cyan-500 hover:bg-cyan-600 text-white py-2 px-4 rounded-md text-sm disabled:opacity-50 transition-colors"
                    >
                      {saving ? "Saving..." : "Save"}
                    </button>
                    <button
                      onClick={() => {
                        setNotes(contact.notes || "");
                        setEditingNotes(false);
                      }}
                      className="px-4 py-2 text-sm text-gray-400 hover:text-white border border-gray-700 rounded-md hover:border-gray-600 transition-colors"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <p className="text-gray-300 whitespace-pre-wrap">
                  {contact.notes || "No notes yet. Click Edit to add some."}
                </p>
              )}
            </div>
          </div>

          {/* Right Column - Touchpoints */}
          <div>
            <div className="bg-[#0b1120] border border-gray-800 rounded-lg p-4 sm:p-6">
              <h3 className="text-lg font-semibold mb-4">Touchpoints</h3>
              {touchpoints.length === 0 ? (
                <p className="text-gray-400 text-sm">
                  No touchpoints yet. Log your first interaction above.
                </p>
              ) : (
                <div className="space-y-4">
                  {touchpoints.map((touchpoint) => (
                    <div
                      key={touchpoint.id}
                      className="border-b border-gray-800 pb-4 last:border-0 last:pb-0"
                    >
                      <div className="flex justify-between items-start mb-2">
                        <div>
                          <p className="text-white font-medium">
                            {CHANNEL_LABELS[touchpoint.channel] || touchpoint.channel}
                          </p>
                          <p className="text-sm text-gray-400">
                            {formatDate(touchpoint.contact_date)}
                          </p>
                        </div>
                      </div>
                      {touchpoint.note && (
                        <p className="text-sm text-gray-300 mt-2">{touchpoint.note}</p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function ContactDetailPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-[#020617] flex items-center justify-center">
          <div className="text-white">Loading...</div>
        </div>
      }
    >
      <ContactDetailContent />
    </Suspense>
  );
}

