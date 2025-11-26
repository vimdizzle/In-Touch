"use client";

import { useState, useEffect, Suspense } from "react";
import { supabase } from "@/lib/supabase";
import { useRouter, useParams } from "next/navigation";
import type { User } from "@supabase/supabase-js";

interface Contact {
  id: string;
  name: string;
  relationship: string;
  city?: string | null;
  country?: string | null;
  location?: string | null; // kept for backward compatibility
  birthday?: string | null;
  cadence_days: number;
  notes?: string | null;
  created_at: string;
  is_pinned?: boolean;
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

// Helper functions for birthday (month/day only, no year)
const parseBirthday = (birthday: string | null | undefined): { month: string; day: string } => {
  if (!birthday) return { month: "", day: "" };
  try {
    const date = new Date(birthday);
    return {
      month: String(date.getMonth() + 1).padStart(2, '0'),
      day: String(date.getDate()).padStart(2, '0')
    };
  } catch {
    return { month: "", day: "" };
  }
};

const formatBirthdayForDB = (month: string, day: string): string | null => {
  if (!month || !day) return null;
  // Use year 2000 as placeholder (leap year, so Feb 29 works)
  return `2000-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
};

const MONTHS = [
  { value: "01", label: "January" },
  { value: "02", label: "February" },
  { value: "03", label: "March" },
  { value: "04", label: "April" },
  { value: "05", label: "May" },
  { value: "06", label: "June" },
  { value: "07", label: "July" },
  { value: "08", label: "August" },
  { value: "09", label: "September" },
  { value: "10", label: "October" },
  { value: "11", label: "November" },
  { value: "12", label: "December" },
];

const getDaysInMonth = (month: string): number[] => {
  if (!month) return [];
  const monthNum = parseInt(month);
  const daysInMonth = new Date(2000, monthNum, 0).getDate(); // Using 2000 (leap year) for Feb 29
  return Array.from({ length: daysInMonth }, (_, i) => i + 1);
};

function ContactDetailContent() {
  const [user, setUser] = useState<User | null>(null);
  const [contact, setContact] = useState<Contact | null>(null);
  const [touchpoints, setTouchpoints] = useState<Touchpoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editingNotes, setEditingNotes] = useState(false);
  const [editing, setEditing] = useState(false);
  const [notes, setNotes] = useState("");
  const [cadenceDays, setCadenceDays] = useState(30);
  const [editName, setEditName] = useState("");
  const [editCity, setEditCity] = useState("");
  const [editCountry, setEditCountry] = useState("");
  const [editBirthdayMonth, setEditBirthdayMonth] = useState("");
  const [editBirthdayDay, setEditBirthdayDay] = useState("");
  const [editCadenceDays, setEditCadenceDays] = useState(30);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [editingTouchpointId, setEditingTouchpointId] = useState<string | null>(null);
  const [editTouchpointChannel, setEditTouchpointChannel] = useState("");
  const [editTouchpointDate, setEditTouchpointDate] = useState("");
  const [editTouchpointNote, setEditTouchpointNote] = useState("");
  const [showDeleteTouchpointConfirm, setShowDeleteTouchpointConfirm] = useState<string | null>(null);
  const [deletingTouchpointId, setDeletingTouchpointId] = useState<string | null>(null);

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
      // Load contact and touchpoints in parallel
      await Promise.all([
        loadContact(session.user.id),
        loadTouchpoints()
      ]);
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
    setEditName(data.name);
    setEditCity(data.city || "");
    setEditCountry(data.country || "");
    const { month, day } = parseBirthday(data.birthday);
    setEditBirthdayMonth(month);
    setEditBirthdayDay(day);
    setEditCadenceDays(data.cadence_days);
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

  const handleSaveEdit = async () => {
    if (!contact || !user) return;
    
    // Validate cadence days
    if (editCadenceDays < 1) {
      alert("Cadence must be at least 1 day");
      return;
    }

    setSaving(true);
    try {
      const birthdayForDB = formatBirthdayForDB(editBirthdayMonth, editBirthdayDay);
      
      const { error } = await supabase
        .from("contacts")
        .update({
          name: editName.trim(),
          city: editCity.trim() || null,
          country: editCountry.trim() || null,
          birthday: birthdayForDB,
          cadence_days: editCadenceDays,
        })
        .eq("id", contactId)
        .eq("user_id", user.id);

      if (error) throw error;

      setContact({
        ...contact,
        name: editName.trim(),
        city: editCity.trim() || null,
        country: editCountry.trim() || null,
        birthday: birthdayForDB,
        cadence_days: editCadenceDays,
      });
      setCadenceDays(editCadenceDays);
      setEditing(false);
    } catch (err: any) {
      alert(`Error saving contact: ${err.message}`);
    } finally {
      setSaving(false);
    }
  };

  const handleCancelEdit = () => {
    if (!contact) return;
    setEditName(contact.name);
    setEditCity(contact.city || "");
    setEditCountry(contact.country || "");
    const { month, day } = parseBirthday(contact.birthday);
    setEditBirthdayMonth(month);
    setEditBirthdayDay(day);
    setEditCadenceDays(contact.cadence_days);
    setEditing(false);
  };

  const handleDelete = async () => {
    if (!contact || !user) return;

    setDeleting(true);
    try {
      const { error } = await supabase
        .from("contacts")
        .delete()
        .eq("id", contactId)
        .eq("user_id", user.id);

      if (error) throw error;

      // Redirect to home page after successful deletion
      router.push("/");
    } catch (err: any) {
      alert(`Error deleting contact: ${err.message}`);
      setDeleting(false);
      setShowDeleteConfirm(false);
    }
  };

  const handleStartEditTouchpoint = (touchpoint: Touchpoint) => {
    setEditingTouchpointId(touchpoint.id);
    setEditTouchpointChannel(touchpoint.channel);
    // Format date for input (YYYY-MM-DD)
    const date = new Date(touchpoint.contact_date);
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    setEditTouchpointDate(`${year}-${month}-${day}`);
    setEditTouchpointNote(touchpoint.note || "");
  };

  const handleCancelEditTouchpoint = () => {
    setEditingTouchpointId(null);
    setEditTouchpointChannel("");
    setEditTouchpointDate("");
    setEditTouchpointNote("");
  };

  const handleSaveEditTouchpoint = async () => {
    if (!editingTouchpointId || !editTouchpointChannel || !editTouchpointDate) {
      alert("Please fill in channel and date");
      return;
    }

    setSaving(true);
    try {
      const { error } = await supabase
        .from("touchpoints")
        .update({
          channel: editTouchpointChannel,
          contact_date: editTouchpointDate,
          note: editTouchpointNote.trim() || null,
        })
        .eq("id", editingTouchpointId);

      if (error) throw error;

      // Reload touchpoints
      await loadTouchpoints();
      handleCancelEditTouchpoint();
    } catch (err: any) {
      alert(`Error updating touchpoint: ${err.message}`);
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteTouchpoint = async (touchpointId: string) => {
    setDeletingTouchpointId(touchpointId);
    try {
      const { error } = await supabase
        .from("touchpoints")
        .delete()
        .eq("id", touchpointId);

      if (error) throw error;

      // Reload touchpoints
      await loadTouchpoints();
      setShowDeleteTouchpointConfirm(null);
    } catch (err: any) {
      alert(`Error deleting touchpoint: ${err.message}`);
    } finally {
      setDeletingTouchpointId(null);
    }
  };

  const formatDate = (dateString: string, includeYear: boolean = true) => {
    const date = new Date(dateString);
    return date.toLocaleDateString("en-US", {
      ...(includeYear && { year: "numeric" }),
      month: "long",
      day: "numeric",
    });
  };

  const formatBirthday = (dateString: string) => {
    // Format birthday without year for privacy
    const date = new Date(dateString);
    return date.toLocaleDateString("en-US", {
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
← Back
          </button>
          <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-4">
            <div>
              <h1 className="text-sm uppercase tracking-widest text-gray-400 mb-2">
                CONTACT DETAIL
              </h1>
              {editing ? (
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      Name *
                    </label>
                    <input
                      type="text"
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      required
                      className="w-full px-4 py-2 bg-[#111827] border border-gray-700 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-cyan-500"
                    />
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-2">
                        City
                      </label>
                      <input
                        type="text"
                        value={editCity}
                        onChange={(e) => setEditCity(e.target.value)}
                        className="w-full px-4 py-2 bg-[#111827] border border-gray-700 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-cyan-500"
                        placeholder="San Jose"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-2">
                        Country
                      </label>
                      <input
                        type="text"
                        value={editCountry}
                        onChange={(e) => setEditCountry(e.target.value)}
                        className="w-full px-4 py-2 bg-[#111827] border border-gray-700 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-cyan-500"
                        placeholder="United States"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      Birthday (optional)
                    </label>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <select
                          value={editBirthdayMonth}
                          onChange={(e) => {
                            setEditBirthdayMonth(e.target.value);
                            // Reset day if month changes and current day is invalid
                            if (e.target.value) {
                              const daysInMonth = getDaysInMonth(e.target.value);
                              if (editBirthdayDay && parseInt(editBirthdayDay) > daysInMonth.length) {
                                setEditBirthdayDay("");
                              }
                            } else {
                              setEditBirthdayDay("");
                            }
                          }}
                          className="w-full px-4 py-2 bg-[#111827] border border-gray-700 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-cyan-500 text-sm sm:text-base"
                        >
                          <option value="">Month</option>
                          {MONTHS.map((month) => (
                            <option key={month.value} value={month.value}>
                              {month.label}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <select
                          value={editBirthdayDay}
                          onChange={(e) => setEditBirthdayDay(e.target.value)}
                          disabled={!editBirthdayMonth}
                          className="w-full px-4 py-2 bg-[#111827] border border-gray-700 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-cyan-500 text-sm sm:text-base disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          <option value="">Day</option>
                          {editBirthdayMonth && getDaysInMonth(editBirthdayMonth).map((day) => (
                            <option key={day} value={String(day).padStart(2, '0')}>
                              {day}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      Cadence (days)
                    </label>
                    <input
                      type="number"
                      value={editCadenceDays}
                      onChange={(e) => {
                        const value = e.target.value;
                        if (value === '') {
                          setEditCadenceDays(0);
                        } else {
                          const num = parseInt(value);
                          if (!isNaN(num) && num > 0) {
                            setEditCadenceDays(num);
                          }
                        }
                      }}
                      min="1"
                      className="w-full px-4 py-2 bg-[#111827] border border-gray-700 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-cyan-500"
                    />
                    <div className="flex flex-wrap gap-2 mt-2">
                      {CADENCE_PRESETS.map((preset) => (
                        <button
                          key={preset.days}
                          type="button"
                          onClick={() => setEditCadenceDays(preset.days)}
                          className={`px-3 py-1 text-sm rounded-md border transition-colors ${
                            editCadenceDays === preset.days
                              ? "bg-cyan-500 border-cyan-500 text-white"
                              : "bg-[#111827] border-gray-700 text-gray-300 hover:border-gray-600"
                          }`}
                        >
                          {preset.label}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              ) : (
                <>
                  <h2 className="text-3xl sm:text-4xl font-bold mb-2">{contact.name}</h2>
                  <p className="text-gray-400 text-sm sm:text-base">
                    {contact.relationship}
                    {(contact.city || contact.country) && ` • ${[contact.city, contact.country].filter(Boolean).join(', ')}`}
                    {!contact.city && !contact.country && contact.location && ` • ${contact.location}`}
                    {contact.birthday && ` • Birthday: ${formatBirthday(contact.birthday)}`}
                  </p>
                </>
              )}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Left Column */}
          <div className="space-y-6">
            {/* Cadence Card */}
            {!editing && (
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
            )}

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
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-semibold">Touchpoints</h3>
                <button
                  onClick={() => router.push(`/log-touchpoint?contactId=${contact.id}`)}
                  className="bg-cyan-500 hover:bg-cyan-600 text-white py-2 px-4 rounded-md transition-colors font-medium text-sm"
                >
                  <span className="hidden sm:inline">Log touchpoint</span>
                  <span className="sm:hidden">Log</span>
                </button>
              </div>
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
                      {editingTouchpointId === touchpoint.id ? (
                        <div className="space-y-3">
                          <div>
                            <label className="block text-sm font-medium text-gray-300 mb-2">
                              Channel *
                            </label>
                            <select
                              value={editTouchpointChannel}
                              onChange={(e) => setEditTouchpointChannel(e.target.value)}
                              className="w-full px-4 py-2 bg-[#111827] border border-gray-700 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-cyan-500"
                            >
                              {Object.entries(CHANNEL_LABELS).map(([value, label]) => (
                                <option key={value} value={value}>
                                  {label}
                                </option>
                              ))}
                            </select>
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-gray-300 mb-2">
                              Date *
                            </label>
                            <input
                              type="date"
                              value={editTouchpointDate}
                              onChange={(e) => setEditTouchpointDate(e.target.value)}
                              required
                              className="w-full px-4 py-2 bg-[#111827] border border-gray-700 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-cyan-500 min-h-[44px] sm:min-h-0"
                            />
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-gray-300 mb-2">
                              Note
                            </label>
                            <textarea
                              value={editTouchpointNote}
                              onChange={(e) => setEditTouchpointNote(e.target.value)}
                              rows={3}
                              className="w-full px-4 py-2 bg-[#111827] border border-gray-700 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-cyan-500"
                              placeholder="Optional note..."
                            />
                          </div>
                          <div className="flex gap-2">
                            <button
                              onClick={handleSaveEditTouchpoint}
                              disabled={saving || !editTouchpointChannel || !editTouchpointDate}
                              className="bg-cyan-500 hover:bg-cyan-600 text-white py-2 px-4 rounded-md text-sm disabled:opacity-50 transition-colors"
                            >
                              {saving ? "Saving..." : "Save"}
                            </button>
                            <button
                              onClick={handleCancelEditTouchpoint}
                              disabled={saving}
                              className="px-4 py-2 text-sm text-gray-400 hover:text-white border border-gray-700 rounded-md hover:border-gray-600 transition-colors disabled:opacity-50"
                            >
                              Cancel
                            </button>
                          </div>
                        </div>
                      ) : (
                        <>
                          <div className="flex justify-between items-start mb-2">
                            <div>
                              <p className="text-white font-medium">
                                {CHANNEL_LABELS[touchpoint.channel] || touchpoint.channel}
                              </p>
                              <p className="text-sm text-gray-400">
                                {formatDate(touchpoint.contact_date)}
                              </p>
                            </div>
                            <div className="flex gap-2">
                              <button
                                onClick={() => handleStartEditTouchpoint(touchpoint)}
                                className="p-1.5 text-gray-400 hover:text-cyan-400 transition-colors"
                                title="Edit touchpoint"
                              >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                </svg>
                              </button>
                              <button
                                onClick={() => setShowDeleteTouchpointConfirm(touchpoint.id)}
                                className="p-1.5 text-gray-400 hover:text-red-400 transition-colors"
                                title="Delete touchpoint"
                              >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                </svg>
                              </button>
                            </div>
                          </div>
                          {touchpoint.note && (
                            <p className="text-sm text-gray-300 mt-2">{touchpoint.note}</p>
                          )}
                        </>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Edit and Delete Buttons */}
        <div className="mt-8 pt-8 border-t border-gray-800">
          <div className="flex flex-col sm:flex-row gap-3">
            {editing ? (
              <>
                <button
                  onClick={handleSaveEdit}
                  disabled={saving || !editName.trim()}
                  className="px-6 py-3 bg-cyan-500 hover:bg-cyan-600 text-white rounded-md transition-colors font-medium disabled:bg-gray-600 disabled:cursor-not-allowed"
                >
                  {saving ? "Saving..." : "Save Changes"}
                </button>
                <button
                  onClick={handleCancelEdit}
                  disabled={saving}
                  className="px-6 py-3 text-gray-400 hover:text-white border border-gray-700 rounded-md hover:border-gray-600 transition-colors font-medium disabled:opacity-50"
                >
                  Cancel
                </button>
              </>
            ) : (
              <>
                <button
                  onClick={() => setEditing(true)}
                  className="px-6 py-3 text-gray-400 hover:text-white border border-gray-700 rounded-md hover:border-gray-600 transition-colors font-medium"
                >
                  Edit
                </button>
                <button
                  onClick={() => setShowDeleteConfirm(true)}
                  disabled={deleting}
                  className="px-6 py-3 bg-transparent border border-red-600 hover:border-red-500 text-red-400 hover:text-red-300 rounded-md transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {deleting ? "Deleting..." : "Delete Contact"}
                </button>
              </>
            )}
          </div>
        </div>

        {/* Delete Contact Confirmation Modal */}
        {showDeleteConfirm && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
            <div className="bg-[#0b1120] border border-gray-800 rounded-lg p-6 max-w-md w-full">
              <h3 className="text-xl font-semibold text-white mb-2">Delete Contact</h3>
              <p className="text-gray-400 mb-6">
                Are you sure you want to delete <span className="font-semibold text-white">{contact?.name}</span>? This action cannot be undone and will also delete all associated touchpoints.
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => setShowDeleteConfirm(false)}
                  disabled={deleting}
                  className="flex-1 px-4 py-2 text-gray-400 hover:text-white border border-gray-700 rounded-md hover:border-gray-600 transition-colors disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  onClick={handleDelete}
                  disabled={deleting}
                  className="flex-1 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-md transition-colors font-medium disabled:bg-gray-600 disabled:cursor-not-allowed"
                >
                  {deleting ? "Deleting..." : "Delete"}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Delete Touchpoint Confirmation Modal */}
        {showDeleteTouchpointConfirm && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
            <div className="bg-[#0b1120] border border-gray-800 rounded-lg p-6 max-w-md w-full">
              <h3 className="text-xl font-semibold text-white mb-2">Delete Touchpoint</h3>
              <p className="text-gray-400 mb-6">
                Are you sure you want to delete this touchpoint? This action cannot be undone.
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => setShowDeleteTouchpointConfirm(null)}
                  disabled={!!deletingTouchpointId}
                  className="flex-1 px-4 py-2 text-gray-400 hover:text-white border border-gray-700 rounded-md hover:border-gray-600 transition-colors disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  onClick={() => handleDeleteTouchpoint(showDeleteTouchpointConfirm)}
                  disabled={!!deletingTouchpointId}
                  className="flex-1 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-md transition-colors font-medium disabled:bg-gray-600 disabled:cursor-not-allowed"
                >
                  {deletingTouchpointId === showDeleteTouchpointConfirm ? "Deleting..." : "Delete"}
                </button>
              </div>
            </div>
          </div>
        )}
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

