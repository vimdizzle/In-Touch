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
  phone?: string | null;
  email?: string | null;
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

import { parseBirthday, formatBirthdayForDB, formatBirthday as formatBirthdayUtil, getLocalTime } from "@/lib/utils";

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
  const [visibleCount, setVisibleCount] = useState(3);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [editingNotes, setEditingNotes] = useState(false);
  const [editing, setEditing] = useState(false);
  const [notes, setNotes] = useState("");
  const [cadenceDays, setCadenceDays] = useState(30);
  const [editName, setEditName] = useState("");
  const [editCity, setEditCity] = useState("");
  const [editCountry, setEditCountry] = useState("");
  const [editBirthdayMonth, setEditBirthdayMonth] = useState("");
  const [editBirthdayDay, setEditBirthdayDay] = useState("");
  const [editPhone, setEditPhone] = useState("");
  const [editEmail, setEditEmail] = useState("");
  const [editCadenceDays, setEditCadenceDays] = useState(30);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [editingTouchpointId, setEditingTouchpointId] = useState<string | null>(null);
  const [editTouchpointChannel, setEditTouchpointChannel] = useState("");
  const [editTouchpointDate, setEditTouchpointDate] = useState("");
  const [editTouchpointNote, setEditTouchpointNote] = useState("");
  const [showDeleteTouchpointConfirm, setShowDeleteTouchpointConfirm] = useState<string | null>(null);
  const [deletingTouchpointId, setDeletingTouchpointId] = useState<string | null>(null);
  const [isPinned, setIsPinned] = useState(false);

  const router = useRouter();
  const params = useParams();
  const contactId = params.id as string;

  // A state hook to trigger re-renders every 30 seconds to update local clocks live
  const [timeTick, setTimeTick] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      setTimeTick((tick) => tick + 1);
    }, 30000);
    return () => clearInterval(timer);
  }, []);

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

      // If edit query param is present, open edit mode immediately
      const urlParams = new URLSearchParams(window.location.search);
      if (urlParams.get("edit") === "true") {
        setEditing(true);
      }

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
    setEditPhone(data.phone || "");
    setEditEmail(data.email || "");
    setEditCadenceDays(data.cadence_days);
    setIsPinned(data.is_pinned || false);
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
      setError("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save notes");
    } finally {
      setSaving(false);
    }
  };

  const handleSaveEdit = async () => {
    if (!contact || !user) return;
    
    // Validate cadence days
    if (editCadenceDays < 1) {
      setError("Cadence must be at least 1 day");
      return;
    }

    setSaving(true);
    setError("");
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
          phone: editPhone.trim() || null,
          email: editEmail.trim() || null,
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
        phone: editPhone.trim() || null,
        email: editEmail.trim() || null,
      });
      setCadenceDays(editCadenceDays);
      setEditing(false);
      setError("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save contact");
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
    setEditPhone(contact.phone || "");
    setEditEmail(contact.email || "");
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
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete contact");
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
      setError("Please fill in channel and date");
      return;
    }

    setError("");

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
      setError("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update touchpoint");
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
      setError("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete touchpoint");
    } finally {
      setDeletingTouchpointId(null);
    }
  };

  const handleTogglePin = async () => {
    if (!contact || !user) return;

    const newPinStatus = !isPinned;
    setSaving(true);
    try {
      const { error } = await supabase
        .from("contacts")
        .update({ is_pinned: newPinStatus })
        .eq("id", contactId)
        .eq("user_id", user.id);

      if (error) throw error;

      setIsPinned(newPinStatus);
      setContact({ ...contact, is_pinned: newPinStatus });
      setError("");
    } catch (err) {
      setError(err instanceof Error ? err.message : `Failed to ${newPinStatus ? 'pin' : 'unpin'} contact`);
    } finally {
      setSaving(false);
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
            className="w-10 h-10 flex items-center justify-center text-gray-400 hover:text-white border border-gray-700 rounded-full hover:border-gray-600 hover:bg-[#111827] transition-all duration-200 mb-4"
            title="Back to Dashboard"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
            </svg>
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
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-2">
                        Phone
                      </label>
                      <input
                        type="tel"
                        value={editPhone}
                        onChange={(e) => setEditPhone(e.target.value)}
                        className="w-full px-4 py-2 bg-[#111827] border border-gray-700 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-cyan-500"
                        placeholder="+1 (555) 000-0000"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-2">
                        Email
                      </label>
                      <input
                        type="email"
                        value={editEmail}
                        onChange={(e) => setEditEmail(e.target.value)}
                        className="w-full px-4 py-2 bg-[#111827] border border-gray-700 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-cyan-500"
                        placeholder="example@email.com"
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
                    {(() => {
                      const localTime = getLocalTime(contact.city, contact.country, contact.location);
                      return localTime ? ` (${localTime})` : '';
                    })()}
                    {contact.birthday && ` • Birthday: ${formatBirthdayUtil(contact.birthday)}`}
                  </p>
                  {(contact.phone || contact.email) && (
                    <div className="flex flex-wrap gap-x-4 gap-y-2 mt-2 text-sm text-cyan-400">
                      {contact.phone && (
                        <a href={`tel:${contact.phone}`} className="flex items-center gap-1.5 hover:text-cyan-300 hover:underline">
                          <svg className="w-4 h-4 text-cyan-400 group-hover:text-cyan-300 transition-colors" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 6.75c0 8.284 6.716 15 15 15h2.25a2.25 2.25 0 002.25-2.25v-1.372c0-.516-.351-.966-.852-1.091l-4.423-1.106c-.44-.11-.902.055-1.173.417l-.97 1.293c-.282.376-.769.542-1.21.302a12.01 12.01 0 01-5.907-5.907c-.44-.44-.274-.927.102-1.21l1.293-.97a1.125 1.125 0 00.417-1.173L6.963 3.102a1.125 1.125 0 00-1.091-.852H4.5A2.25 2.25 0 002.25 4.5v2.25z" />
                          </svg>
                          <span>{contact.phone}</span>
                        </a>
                      )}
                      {contact.email && (
                        <a href={`mailto:${contact.email}`} className="flex items-center gap-1.5 hover:text-cyan-300 hover:underline">
                          <svg className="w-4 h-4 text-cyan-400 group-hover:text-cyan-300 transition-colors" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75" />
                          </svg>
                          <span>{contact.email}</span>
                        </a>
                      )}
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        </div>

        {/* Error Message */}
        {error && (
          <div className="mb-6 p-3 bg-red-900/20 border border-red-800 text-red-400 rounded-md text-sm">
            {error}
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Left Column */}
          <div className="space-y-6">
            {/* Cadence Card */}
            {!editing && (
              <div className="bg-[#0b1120] border border-gray-800 rounded-lg p-4 sm:p-6">
                <h3 className="text-lg font-semibold mb-4">Cadence</h3>
                <div>
                  <p className="text-sm text-gray-400 mb-2">Connect every</p>
                  <p className="text-white text-lg">
                    {contact.cadence_days} day{contact.cadence_days !== 1 ? "s" : ""}
                  </p>
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
                    className="w-8 h-8 flex items-center justify-center text-cyan-400 hover:text-white border border-cyan-500/30 rounded-full hover:bg-cyan-500/10 transition-colors"
                    title="Edit Notes"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L6.832 19.82a4.5 4.5 0 01-1.897 1.13l-2.685.8.8-2.685a4.5 4.5 0 011.13-1.897L16.863 4.487zm0 0L19.5 7.125" />
                    </svg>
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
                      onClick={() => {
                        setNotes(contact.notes || "");
                        setEditingNotes(false);
                      }}
                      className="w-10 h-10 flex items-center justify-center text-red-500 hover:text-white border border-red-500/50 rounded-full hover:border-red-500 hover:bg-red-500/10 transition-all duration-200"
                      title="Cancel"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                    <button
                      onClick={handleSaveNotes}
                      disabled={saving}
                      className="w-10 h-10 flex items-center justify-center text-cyan-400 hover:text-white border border-cyan-500/50 rounded-full hover:border-cyan-500 hover:bg-cyan-500/10 transition-all duration-200 disabled:opacity-50"
                      title="Save Notes"
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
                  className="w-10 h-10 flex items-center justify-center bg-cyan-500 hover:bg-cyan-600 text-white rounded-full hover:bg-cyan-600 transition-all duration-200"
                  title="Log Touchpoint"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                  </svg>
                </button>
              </div>
              {touchpoints.length === 0 ? (
                <p className="text-gray-400 text-sm">
                  No touchpoints yet. Log your first interaction above.
                </p>
              ) : (
                <div className="space-y-4">
                  {touchpoints.slice(0, visibleCount).map((touchpoint) => (
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
                              onClick={handleCancelEditTouchpoint}
                              disabled={saving}
                              className="w-10 h-10 flex items-center justify-center text-red-500 hover:text-white border border-red-500/50 rounded-full hover:border-red-500 hover:bg-red-500/10 transition-all duration-200 disabled:opacity-50"
                              title="Cancel"
                            >
                              <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                              </svg>
                            </button>
                            <button
                              onClick={handleSaveEditTouchpoint}
                              disabled={saving || !editTouchpointChannel || !editTouchpointDate}
                              className="w-10 h-10 flex items-center justify-center text-cyan-400 hover:text-white border border-cyan-500/50 rounded-full hover:border-cyan-500 hover:bg-cyan-500/10 transition-all duration-200 disabled:opacity-50"
                              title="Save Touchpoint"
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
                                className="w-8 h-8 flex items-center justify-center text-gray-400 hover:text-cyan-400 border border-gray-800/80 rounded-full hover:bg-[#111827] transition-all duration-200"
                                title="Edit touchpoint"
                              >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L6.832 19.82a4.5 4.5 0 01-1.897 1.13l-2.685.8.8-2.685a4.5 4.5 0 011.13-1.897L16.863 4.487zm0 0L19.5 7.125" />
                                </svg>
                              </button>
                              <button
                                onClick={() => setShowDeleteTouchpointConfirm(touchpoint.id)}
                                className="w-8 h-8 flex items-center justify-center text-gray-400 hover:text-red-400 border border-gray-800/80 rounded-full hover:bg-[#111827] transition-all duration-200"
                                title="Delete touchpoint"
                              >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
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
                    {touchpoints.length > visibleCount && (
                      <div className="text-center pt-4">
                        <button
                          onClick={() => setVisibleCount((prev) => prev + 10)}
                          className="w-10 h-10 flex items-center justify-center text-cyan-400 hover:text-cyan-300 border border-cyan-500/40 rounded-full hover:bg-cyan-500/10 mx-auto transition-all duration-200"
                          title="Load More Touchpoints"
                        >
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
                          </svg>
                        </button>
                      </div>
                    )}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Edit and Delete Buttons */}
        <div className="mt-8 pt-8 border-t border-gray-800">
          <div className="flex gap-3">
            {editing ? (
              <div className="flex gap-4 justify-center w-full">
                <button
                  onClick={handleCancelEdit}
                  disabled={saving}
                  className="w-12 h-12 flex items-center justify-center text-red-500 hover:text-white border border-red-500/50 rounded-full hover:border-red-500 hover:bg-red-500/10 transition-all duration-200 disabled:opacity-50"
                  title="Cancel Edit"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
                <button
                  onClick={handleSaveEdit}
                  disabled={saving || !editName.trim()}
                  className="w-12 h-12 flex items-center justify-center text-cyan-400 hover:text-white border border-cyan-500/50 rounded-full hover:border-cyan-500 hover:bg-cyan-500/10 transition-all duration-200 disabled:opacity-50"
                  title="Save Contact"
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
            ) : (
              <div className="flex gap-4 justify-center w-full">
                {/* Circular Edit Button */}
                <button
                  onClick={() => setEditing(true)}
                  className="w-12 h-12 flex items-center justify-center text-cyan-400 hover:text-white border border-cyan-500/50 rounded-full hover:border-cyan-500 hover:bg-cyan-500/10 transition-all duration-200"
                  title="Edit Contact"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L6.832 19.82a4.5 4.5 0 01-1.897 1.13l-2.685.8.8-2.685a4.5 4.5 0 011.13-1.897L16.863 4.487zm0 0L19.5 7.125" />
                  </svg>
                </button>
                {/* Circular Delete Button */}
                <button
                  onClick={() => setShowDeleteConfirm(true)}
                  disabled={deleting}
                  className="w-12 h-12 flex items-center justify-center text-red-500 hover:text-white border border-red-500/50 rounded-full hover:border-red-500 hover:bg-red-500/10 transition-all duration-200 disabled:opacity-50"
                  title="Delete Contact"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
                  </svg>
                </button>
              </div>
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
              <div className="flex gap-4 justify-center">
                <button
                  onClick={() => setShowDeleteConfirm(false)}
                  disabled={deleting}
                  className="w-12 h-12 flex items-center justify-center text-gray-400 hover:text-white border border-gray-700 rounded-full hover:border-gray-600 hover:bg-[#111827] transition-all duration-200 disabled:opacity-50"
                  title="Cancel"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
                <button
                  onClick={handleDelete}
                  disabled={deleting}
                  className="w-12 h-12 flex items-center justify-center text-red-500 hover:text-white border border-red-500/50 rounded-full hover:border-red-500 hover:bg-red-500/10 transition-all duration-200 disabled:opacity-50"
                  title="Confirm Delete Contact"
                >
                  {deleting ? (
                    <svg className="animate-spin h-5 w-5 text-red-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                  ) : (
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
                    </svg>
                  )}
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
              <div className="flex gap-4 justify-center">
                <button
                  onClick={() => setShowDeleteTouchpointConfirm(null)}
                  disabled={!!deletingTouchpointId}
                  className="w-12 h-12 flex items-center justify-center text-gray-400 hover:text-white border border-gray-700 rounded-full hover:border-gray-600 hover:bg-[#111827] transition-all duration-200 disabled:opacity-50"
                  title="Cancel"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
                <button
                  onClick={() => handleDeleteTouchpoint(showDeleteTouchpointConfirm)}
                  disabled={!!deletingTouchpointId}
                  className="w-12 h-12 flex items-center justify-center text-red-500 hover:text-white border border-red-500/50 rounded-full hover:border-red-500 hover:bg-red-500/10 transition-all duration-200 disabled:opacity-50"
                  title="Confirm Delete Touchpoint"
                >
                  {deletingTouchpointId === showDeleteTouchpointConfirm ? (
                    <svg className="animate-spin h-5 w-5 text-red-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                  ) : (
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
                    </svg>
                  )}
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

