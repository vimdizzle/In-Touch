"use client";

import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/lib/supabase";
import { 
  Contact, 
  Touchpoint, 
  formatBirthdayForDB, 
  parseBirthday, 
  getDaysInMonth, 
  RELATIONSHIPS, 
  CADENCE_PRESETS, 
  MONTHS,
  getLocalTime
} from "@/lib/utils";

interface ProfileDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  contact: Contact | null;
  userId: string;
  timezoneMap: Record<string, string | null>;
  onSuccess: () => Promise<void>;
  onLogTouchpoint: (contactId: string) => void;
  onReachOut: (contact: Contact) => void;
  onTogglePin: (contactId: string) => void;
}

export default function ProfileDrawer({
  isOpen,
  onClose,
  contact,
  userId,
  timezoneMap,
  onSuccess,
  onLogTouchpoint,
  onReachOut,
  onTogglePin
}: ProfileDrawerProps) {
  // Editing contact details states
  const [isEditingContact, setIsEditingContact] = useState(false);
  const [editName, setEditName] = useState("");
  const [editRelationship, setEditRelationship] = useState("Friend");
  const [editPhone, setEditPhone] = useState("");
  const [editEmail, setEditEmail] = useState("");
  const [editCadenceDays, setEditCadenceDays] = useState(30);
  const [editCity, setEditCity] = useState("");
  const [editCountry, setEditCountry] = useState("");
  const [editBirthdayMonth, setEditBirthdayMonth] = useState("");
  const [editBirthdayDay, setEditBirthdayDay] = useState("");
  const [editNotes, setEditNotes] = useState("");

  // Editing notes state
  const [isEditingNotes, setIsEditingNotes] = useState(false);
  const [notesText, setNotesText] = useState("");

  // Pagination for touchpoint history
  const [visibleCount, setVisibleCount] = useState(3);

  // Editing touchpoints states
  const [editingTouchpointId, setEditingTouchpointId] = useState<string | null>(null);
  const [editTouchpointChannel, setEditTouchpointChannel] = useState("call");
  const [editTouchpointDate, setEditTouchpointDate] = useState("");
  const [editTouchpointNote, setEditTouchpointNote] = useState("");

  // Confirms & saving status
  const [showDeleteTouchpointConfirm, setShowDeleteTouchpointConfirm] = useState<string | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState("");

  // Reset drawer state when contact changes
  useEffect(() => {
    if (contact) {
      setIsEditingContact(false);
      setIsEditingNotes(false);
      setVisibleCount(3);
      setEditingTouchpointId(null);
      setShowDeleteTouchpointConfirm(null);
      setShowDeleteConfirm(false);
      setError("");
      setSaving(false);
      setDeleting(false);
    }
  }, [contact]);

  if (!isOpen || !contact) return null;

  // Pre-resolved local timezone and time
  const contactTimezone = timezoneMap[`${contact.city || ''}|${contact.country || ''}|${contact.location || ''}`] || null;
  const localTime = getLocalTime(contactTimezone);

  const formatCadence = (days: number) => {
    if (days === 7) return "Weekly";
    if (days === 30) return "Monthly";
    if (days === 90) return "Quarterly";
    if (days === 365) return "Yearly";
    return `Every ${days} days`;
  };

  const formatLastContact = (c: Contact) => {
    if (!c.last_contact_date) {
      return "Never contacted";
    }
    const days = c.days_since_last_contact || 0;
    if (days === 0) return "Today";
    if (days === 1) return "Yesterday";
    return `${days} days ago`;
  };

  const getNextTouchInfo = (c: Contact) => {
    if (c.status === "overdue") {
      return { text: "0 days", color: "text-red-400" };
    }
    if (c.status === "coming_up" && c.days_until_due !== undefined) {
      return { text: `${c.days_until_due} days`, color: "text-yellow-400" };
    }
    if (c.status === "on_track" && c.days_until_due !== undefined) {
      return { text: `${c.days_until_due} days`, color: "text-green-400" };
    }
    return { text: "—", color: "text-gray-400" };
  };

  // 1. Contact Editing Logic
  const handleOpenEditContact = () => {
    setEditName(contact.name);
    setEditRelationship(contact.relationship || "Friend");
    setEditPhone(contact.phone || "");
    setEditEmail(contact.email || "");
    setEditCadenceDays(contact.cadence_days || 30);
    setEditCity(contact.city || "");
    setEditCountry(contact.country || "");
    
    const parsedBday = parseBirthday(contact.birthday);
    setEditBirthdayMonth(parsedBday.month);
    setEditBirthdayDay(parsedBday.day);
    setEditNotes(contact.notes || "");
    setError("");
    setIsEditingContact(true);
  };

  const handleSaveEditContact = async () => {
    if (!userId || !contact) return;
    setSaving(true);
    setError("");
    try {
      const birthdayForDB = formatBirthdayForDB(editBirthdayMonth, editBirthdayDay);
      const { error: updateError } = await supabase
        .from("contacts")
        .update({
          name: editName.trim(),
          relationship: editRelationship,
          cadence_days: editCadenceDays,
          city: editCity.trim() || null,
          country: editCountry.trim() || null,
          birthday: birthdayForDB,
          notes: editNotes.trim() || null,
          phone: editPhone.trim() || null,
          email: editEmail.trim() || null,
        })
        .eq("id", contact.id)
        .eq("user_id", userId);

      if (updateError) throw updateError;
      await onSuccess();
      setIsEditingContact(false);
    } catch (err: any) {
      setError(err.message || "Failed to save contact details");
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteContact = async () => {
    if (!userId || !contact) return;
    setDeleting(true);
    setError("");
    try {
      const { error: deleteError } = await supabase
        .from("contacts")
        .delete()
        .eq("id", contact.id)
        .eq("user_id", userId);
      
      if (deleteError) throw deleteError;
      onClose();
      await onSuccess();
    } catch (err: any) {
      setError(err.message || "Failed to delete contact");
    } finally {
      setDeleting(false);
    }
  };

  // 2. Personal Notes Editing Logic
  const handleStartEditNotes = () => {
    setNotesText(contact.notes || "");
    setIsEditingNotes(true);
  };

  const handleSaveNotes = async () => {
    if (!userId || !contact) return;
    setSaving(true);
    try {
      const { error: updateError } = await supabase
        .from("contacts")
        .update({ notes: notesText.trim() || null })
        .eq("id", contact.id)
        .eq("user_id", userId);
      
      if (updateError) throw updateError;
      await onSuccess();
      setIsEditingNotes(false);
    } catch (err) {
      console.error(err);
    } finally {
      setSaving(false);
    }
  };

  // 3. Touchpoint History Logic
  const handleStartEditTouchpoint = (tp: Touchpoint) => {
    setEditingTouchpointId(tp.id);
    setEditTouchpointChannel(tp.channel);
    setEditTouchpointDate(tp.contact_date);
    setEditTouchpointNote(tp.note || "");
  };

  const handleSaveEditTouchpoint = async () => {
    if (!userId || !contact || !editingTouchpointId) return;
    setSaving(true);
    try {
      const { error: updateError } = await supabase
        .from("touchpoints")
        .update({
          channel: editTouchpointChannel,
          contact_date: editTouchpointDate,
          note: editTouchpointNote.trim() || null,
        })
        .eq("id", editingTouchpointId);

      if (updateError) throw updateError;
      await onSuccess();
      setEditingTouchpointId(null);
    } catch (err) {
      console.error(err);
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteTouchpoint = async (tpId: string) => {
    if (!userId || !contact) return;
    setSaving(true);
    try {
      const { error: deleteError } = await supabase
        .from("touchpoints")
        .delete()
        .eq("id", tpId);
      
      if (deleteError) throw deleteError;
      await onSuccess();
      setShowDeleteTouchpointConfirm(null);
    } catch (err) {
      console.error(err);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div 
      className="fixed inset-0 z-50 flex flex-col md:flex-row justify-end items-end md:items-stretch animate-fadeIn"
      onClick={onClose}
    >
      {/* Backdrop with blur */}
      <div className="fixed inset-0 bg-black/60 backdrop-blur-sm transition-opacity" />

      {/* Drawer Panel */}
      <div 
        className="relative w-full h-[85vh] md:h-screen md:max-w-md lg:max-w-lg bg-[#0b1120] border-t md:border-t-0 md:border-l border-gray-800 rounded-t-3xl md:rounded-t-none md:rounded-l-3xl shadow-2xl flex flex-col animate-slideUp md:animate-slideInRight cursor-default"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-6 border-b border-gray-800/80 flex justify-between items-start gap-4 shrink-0">
          <div>
            <h3 className="text-xl font-bold text-white leading-tight">
              {contact.name}
            </h3>
            <p className="text-sm text-gray-400 mt-1">
              {contact.relationship}
              {` • ${formatCadence(contact.cadence_days)}`}
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {/* Clustered Pin Button */}
            <button
              onClick={() => onTogglePin(contact.id)}
              className={`w-10 h-10 flex items-center justify-center border rounded-full transition-all duration-200 cursor-pointer ${
                contact.is_pinned 
                  ? "border-cyan-500/50 text-cyan-400 hover:border-cyan-500 hover:bg-cyan-500/10" 
                  : "border-gray-700 text-gray-500 hover:border-gray-600 hover:text-gray-400 hover:bg-[#111827]"
              }`}
              title={contact.is_pinned ? "Unpin contact" : "Pin contact"}
            >
              <svg className="w-5 h-5" fill={contact.is_pinned ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <circle cx="12" cy="7" r="3.5" fill={contact.is_pinned ? "currentColor" : "none"}/>
                <path d="M12 10.5v11M9 21.5h6" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
              </svg>
            </button>
            {/* Close panel button */}
            <button
              onClick={onClose}
              className="w-10 h-10 flex items-center justify-center text-gray-400 hover:text-white border border-gray-700 rounded-full hover:border-gray-600 hover:bg-[#111827] transition-all duration-200 cursor-pointer"
              title="Close panel"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {showDeleteConfirm ? (
            /* ==========================================
               DELETE CONTACT CONFIRMATION OVERLAY
               ========================================== */
            <div className="space-y-4 py-8 animate-fadeIn text-center">
              <h4 className="text-red-500 font-extrabold text-xl">Delete {contact.name}?</h4>
              <p className="text-sm text-gray-400 leading-relaxed max-w-sm mx-auto">
                Are you sure you want to permanently delete <strong className="text-white">{contact.name}</strong>? This will remove all their touchpoint history forever. This action cannot be undone.
              </p>
              <div className="flex gap-4 justify-center pt-6">
                <button
                  onClick={() => setShowDeleteConfirm(false)}
                  className="px-6 py-2.5 border border-gray-750 hover:border-gray-500 rounded-full text-sm font-semibold text-gray-400 hover:text-white transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  onClick={handleDeleteContact}
                  disabled={deleting}
                  className="px-6 py-2.5 bg-red-600 hover:bg-red-700 text-white font-semibold rounded-full text-sm transition-colors cursor-pointer disabled:opacity-50 flex items-center gap-2"
                >
                  {deleting ? "Deleting..." : "Permanently Delete"}
                </button>
              </div>
            </div>
          ) : isEditingContact ? (
            /* ==========================================
               A. CONTACT EDIT FORM STATE
               ========================================== */
            <div className="space-y-4 animate-fadeIn">
              <div>
                <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
                  Name *
                </label>
                <input
                  type="text"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  required
                  className="w-full px-4 py-2 bg-[#111827] border border-gray-700 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-cyan-500 text-sm"
                  placeholder="John Doe"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
                  Relationship
                </label>
                <select
                  value={editRelationship}
                  onChange={(e) => setEditRelationship(e.target.value)}
                  className="w-full px-4 py-2 bg-[#111827] border border-gray-700 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-cyan-500 text-sm"
                >
                  {RELATIONSHIPS.map((rel) => (
                    <option key={rel} value={rel}>
                      {rel}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
                    Phone
                  </label>
                  <input
                    type="tel"
                    value={editPhone}
                    onChange={(e) => setEditPhone(e.target.value)}
                    className="w-full px-4 py-2 bg-[#111827] border border-gray-700 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-cyan-500 text-sm"
                    placeholder="+1 (555) 000-0000"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
                    Email
                  </label>
                  <input
                    type="email"
                    value={editEmail}
                    onChange={(e) => setEditEmail(e.target.value)}
                    className="w-full px-4 py-2 bg-[#111827] border border-gray-700 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-cyan-500 text-sm"
                    placeholder="example@email.com"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
                  Cadence
                </label>
                <div className="flex flex-wrap gap-2 mb-2">
                  {CADENCE_PRESETS.map((preset) => (
                    <button
                      key={preset.days}
                      type="button"
                      onClick={() => setEditCadenceDays(preset.days)}
                      className={`px-3 py-1 text-xs rounded-md border transition-colors cursor-pointer ${
                        editCadenceDays === preset.days
                          ? "bg-cyan-500 border-cyan-500 text-white"
                          : "bg-[#111827] border-gray-700 text-gray-300 hover:border-gray-600"
                      }`}
                    >
                      {preset.label}
                    </button>
                  ))}
                  <button
                    type="button"
                    onClick={() => {
                      if ([7, 30, 90, 365].includes(editCadenceDays)) {
                        setEditCadenceDays(45);
                      }
                    }}
                    className={`px-3 py-1 text-xs rounded-md border transition-colors cursor-pointer ${
                      ![7, 30, 90, 365].includes(editCadenceDays)
                        ? "bg-cyan-500 border-cyan-500 text-white"
                        : "bg-[#111827] border-gray-700 text-gray-300 hover:border-gray-600"
                    }`}
                  >
                    Custom
                  </button>
                </div>
                
                {![7, 30, 90, 365].includes(editCadenceDays) && (
                  <div className="flex items-center gap-2 animate-fadeIn mt-2 pl-1">
                    <input
                      type="number"
                      value={editCadenceDays}
                      onChange={(e) => {
                        const val = e.target.value;
                        if (val === "") setEditCadenceDays(0);
                        else {
                          const num = parseInt(val);
                          if (!isNaN(num) && num > 0) setEditCadenceDays(num);
                        }
                      }}
                      min="1"
                      className="w-24 px-4 py-2 bg-[#111827] border border-gray-700 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-cyan-500 text-sm"
                    />
                    <span className="text-gray-400 text-sm">days</span>
                  </div>
                )}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
                    City
                  </label>
                  <input
                    type="text"
                    value={editCity}
                    onChange={(e) => setEditCity(e.target.value)}
                    className="w-full px-4 py-2 bg-[#111827] border border-gray-700 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-cyan-500 text-sm"
                    placeholder="San Jose"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
                    Country
                  </label>
                  <input
                    type="text"
                    value={editCountry}
                    onChange={(e) => setEditCountry(e.target.value)}
                    className="w-full px-4 py-2 bg-[#111827] border border-gray-700 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-cyan-500 text-sm"
                    placeholder="United States"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
                  Birthday
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <select
                    value={editBirthdayMonth}
                    onChange={(e) => {
                      setEditBirthdayMonth(e.target.value);
                      if (e.target.value) {
                        const days = getDaysInMonth(e.target.value);
                        if (editBirthdayDay && parseInt(editBirthdayDay) > days.length) {
                          setEditBirthdayDay("");
                        }
                      } else {
                        setEditBirthdayDay("");
                      }
                    }}
                    className="w-full px-3 py-2 bg-[#111827] border border-gray-700 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-cyan-500 text-sm"
                  >
                    <option value="">Month</option>
                    {MONTHS.map((m) => (
                      <option key={m.value} value={m.value}>{m.label}</option>
                    ))}
                  </select>
                  <select
                    value={editBirthdayDay}
                    onChange={(e) => setEditBirthdayDay(e.target.value)}
                    disabled={!editBirthdayMonth}
                    className="w-full px-3 py-2 bg-[#111827] border border-gray-700 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-cyan-500 text-sm disabled:opacity-50"
                  >
                    <option value="">Day</option>
                    {editBirthdayMonth && getDaysInMonth(editBirthdayMonth).map((d) => (
                      <option key={d} value={String(d).padStart(2, '0')}>{d}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
                  Notes
                </label>
                <textarea
                  value={editNotes}
                  onChange={(e) => setEditNotes(e.target.value)}
                  rows={3}
                  className="w-full px-4 py-2 bg-[#111827] border border-gray-700 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-cyan-500 text-sm"
                  placeholder="Notes..."
                />
              </div>

              {error && (
                <div className="p-3 bg-red-900/20 border border-red-800 text-red-400 rounded-md text-xs">
                  {error}
                </div>
              )}
            </div>
          ) : (
            /* ==========================================
               B. STANDARD PREVIEW STATE
               ========================================== */
            <div className="space-y-6 animate-fadeIn">
              {/* Status Bar */}
              <div className="bg-[#111827]/40 border border-gray-800/60 rounded-xl p-4 flex justify-between items-center text-sm">
                <div>
                  <span className="text-gray-400 text-xs block mb-0.5">Last touchpoint</span>
                  <span className="font-medium text-gray-200">{formatLastContact(contact)}</span>
                </div>
                <div className="text-right">
                  <span className="text-gray-400 text-xs block mb-0.5">Next touch due</span>
                  <span className={`font-semibold ${getNextTouchInfo(contact).color}`}>
                    {getNextTouchInfo(contact).text}
                  </span>
                </div>
              </div>

              {/* Details Section */}
              <div className="space-y-4">
                <h4 className="text-xs font-semibold text-cyan-400 uppercase tracking-wider">Contact Info</h4>
                
                <div className="space-y-3">
                  {/* Location */}
                  {(contact.city || contact.country || contact.location) && (
                    <div className="flex items-center gap-3 p-3 bg-[#111827]/20 border border-gray-800/40 rounded-xl">
                      <svg className="w-5 h-5 text-gray-400 shrink-0" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25s-7.5-4.108-7.5-11.25a7.5 7.5 0 1115 0z" />
                      </svg>
                      <div className="text-sm">
                        <span className="text-gray-500 text-xs block">Location</span>
                        <span className="text-gray-200">
                          {[contact.city, contact.country].filter(Boolean).join(', ') || contact.location}
                          {localTime ? ` (${localTime} local time)` : ''}
                        </span>
                      </div>
                    </div>
                  )}

                  {/* Birthday */}
                  {contact.birthday && (
                    <div className="flex items-center gap-3 p-3 bg-[#111827]/20 border border-gray-800/40 rounded-xl">
                      <svg className="w-5 h-5 text-gray-400 shrink-0" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 8.25v-1.5m0 1.5c-1.355 0-2.697-.056-4.024-.166C6.845 7.96 6 6.99 6 5.89V5.25c0-1.1.9-2 2-2h8c1.1 0 2 .9 2 2v.64c0 1.1-.845 2.07-1.976 2.194A42.14 42.14 0 0112 8.25zm0 0v1.5m0-1.5c1.355 0 2.697.056 4.024.166C17.156 8.52 18 9.49 18 10.59v6.66a2.25 2.25 0 01-2.25 2.25H8.25A2.25 2.25 0 016 17.25v-6.66c0-1.1.844-2.07 1.976-2.194C9.303 8.306 10.645 8.25 12 8.25z" />
                      </svg>
                      <div className="text-sm">
                        <span className="text-gray-500 text-xs block">Birthday</span>
                        <span className="text-gray-200">
                          {new Date(contact.birthday).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}
                        </span>
                      </div>
                    </div>
                  )}

                  {/* Phone */}
                  {contact.phone && (
                    <div className="flex items-center justify-between p-3 bg-[#111827]/20 border border-gray-800/40 rounded-xl">
                      <div className="flex items-center gap-3">
                        <svg className="w-5 h-5 text-gray-400 shrink-0" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 6.75c0 8.284 6.716 15 15 15h2.25a2.25 2.25 0 002.25-2.25v-1.372c0-.516-.351-.966-.852-1.091l-4.423-1.106c-.44-.11-.902.055-1.173.417l-.97 1.293c-.282.376-.769.542-1.21.302a12.01 12.01 0 01-5.907-5.907c-.44-.44-.274-.927.102-1.21l1.293-.97a1.125 1.125 0 00.417-1.173L6.963 3.102a1.125 1.125 0 00-1.091-.852H4.5A2.25 2.25 0 002.25 4.5v2.25z" />
                        </svg>
                        <div className="text-sm">
                          <span className="text-gray-500 text-xs block">Phone</span>
                          <a href={`tel:${contact.phone}`} className="text-cyan-400 hover:underline font-medium">
                            {contact.phone}
                          </a>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Email */}
                  {contact.email && (
                    <div className="flex items-center justify-between p-3 bg-[#111827]/20 border border-gray-800/40 rounded-xl">
                      <div className="flex items-center gap-3">
                        <svg className="w-5 h-5 text-gray-400 shrink-0" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75" />
                        </svg>
                        <div className="text-sm">
                          <span className="text-gray-500 text-xs block">Email</span>
                          <a href={`mailto:${contact.email}`} className="text-cyan-400 hover:underline font-medium">
                            {contact.email}
                          </a>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Personal Notes Card */}
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <h4 className="text-xs font-semibold text-cyan-400 uppercase tracking-wider">Personal Notes</h4>
                  {!isEditingNotes && (
                    <button
                      onClick={handleStartEditNotes}
                      className="w-8 h-8 flex items-center justify-center text-cyan-400 hover:text-white border border-cyan-500/30 rounded-full hover:bg-cyan-500/10 transition-colors cursor-pointer"
                      title="Edit Notes"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L6.832 19.82a4.5 4.5 0 01-1.897 1.13l-2.685.8.8-2.685a4.5 4.5 0 011.13-1.897L16.863 4.487zm0 0L19.5 7.125" />
                      </svg>
                    </button>
                  )}
                </div>

                {isEditingNotes ? (
                  <div className="space-y-3 mt-2 animate-fadeIn">
                    <textarea
                      value={notesText}
                      onChange={(e) => setNotesText(e.target.value)}
                      rows={4}
                      className="w-full px-4 py-2 bg-[#111827] border border-gray-700 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-cyan-500 text-sm"
                      placeholder="Prefers WhatsApp, Ask about new job..."
                    />
                    <div className="flex gap-2 justify-end">
                      <button
                        onClick={() => setIsEditingNotes(false)}
                        className="w-8 h-8 flex items-center justify-center text-red-500 hover:text-white border border-red-500/50 rounded-full hover:border-red-500 hover:bg-red-500/10 transition-all duration-200 cursor-pointer"
                        title="Cancel"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                      <button
                        onClick={handleSaveNotes}
                        disabled={saving}
                        className="w-8 h-8 flex items-center justify-center text-cyan-400 hover:text-white border border-cyan-500/50 rounded-full hover:border-cyan-500 hover:bg-cyan-500/10 transition-all duration-200 disabled:opacity-50 cursor-pointer"
                        title="Save Notes"
                      >
                        {saving ? (
                          <svg className="animate-spin h-4 w-4 text-cyan-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                          </svg>
                        ) : (
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                          </svg>
                        )}
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="bg-[#111827]/30 border border-gray-800/50 rounded-xl p-4 text-sm text-gray-300 italic whitespace-pre-wrap leading-relaxed">
                    {contact.notes || "No notes yet. Click Edit to add some."}
                  </div>
                )}
              </div>

              {/* Timeline History Block */}
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <h4 className="text-xs font-semibold text-cyan-400 uppercase tracking-wider">Touchpoint History</h4>
                  <button
                    onClick={() => onLogTouchpoint(contact.id)}
                    className="w-8 h-8 flex items-center justify-center bg-cyan-500 hover:bg-cyan-600 text-white rounded-full transition-all duration-200 cursor-pointer"
                    title="Log Touchpoint"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                    </svg>
                  </button>
                </div>

                {contact.touchpoints && contact.touchpoints.length > 0 ? (
                  <div className="space-y-4">
                    {contact.touchpoints.slice(0, visibleCount).map((tp: Touchpoint) => (
                      <div key={tp.id} className="border-b border-gray-800/80 pb-4 last:border-0 last:pb-0">
                        {editingTouchpointId === tp.id ? (
                          /* Inline Touchpoint Edit Form */
                          <div className="space-y-3 p-3 bg-[#111827]/40 rounded-xl border border-gray-800/80 animate-fadeIn">
                            <div>
                              <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">
                                Channel *
                              </label>
                              <select
                                value={editTouchpointChannel}
                                onChange={(e) => setEditTouchpointChannel(e.target.value)}
                                className="w-full px-3 py-1.5 bg-[#111827] border border-gray-700 rounded-md text-white focus:outline-none focus:ring-1 focus:ring-cyan-500 text-xs"
                              >
                                <option value="call">Call</option>
                                <option value="text">Text</option>
                                <option value="video">Video</option>
                                <option value="in_person">In Person</option>
                                <option value="email">Email</option>
                                <option value="other">Other</option>
                              </select>
                            </div>
                            <div>
                              <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">
                                Date *
                              </label>
                              <input
                                type="date"
                                value={editTouchpointDate}
                                onChange={(e) => setEditTouchpointDate(e.target.value)}
                                required
                                className="w-full h-[30px] px-3 py-1.5 bg-[#111827] border border-gray-700 rounded-md text-white focus:outline-none focus:ring-1 focus:ring-cyan-500 text-xs appearance-none"
                              />
                            </div>
                            <div>
                              <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">
                                Note
                              </label>
                              <textarea
                                value={editTouchpointNote}
                                onChange={(e) => setEditTouchpointNote(e.target.value)}
                                rows={2}
                                className="w-full px-3 py-1.5 bg-[#111827] border border-gray-700 rounded-md text-white focus:outline-none focus:ring-1 focus:ring-cyan-500 text-xs"
                                placeholder="Notes..."
                              />
                            </div>
                            <div className="flex gap-2 justify-end">
                              <button
                                onClick={() => setEditingTouchpointId(null)}
                                className="w-8 h-8 flex items-center justify-center text-red-500 hover:text-white border border-red-500/50 rounded-full hover:border-red-500 hover:bg-red-500/10 transition-all duration-200 cursor-pointer"
                                title="Cancel"
                              >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                                </svg>
                              </button>
                              <button
                                onClick={handleSaveEditTouchpoint}
                                disabled={saving}
                                className="w-8 h-8 flex items-center justify-center text-cyan-400 hover:text-white border border-cyan-500/50 rounded-full hover:border-cyan-500 hover:bg-cyan-500/10 transition-all duration-200 disabled:opacity-50 cursor-pointer"
                                title="Save Touchpoint"
                              >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                                </svg>
                              </button>
                            </div>
                          </div>
                        ) : showDeleteTouchpointConfirm === tp.id ? (
                          /* Inline Touchpoint Delete Confirmation */
                          <div className="p-4 bg-red-950/20 border border-red-800 rounded-xl text-center space-y-3 animate-fadeIn">
                            <span className="text-xs text-red-400 font-semibold block">Delete touchpoint entry?</span>
                            <div className="flex gap-3 justify-center">
                              <button
                                type="button"
                                onClick={() => setShowDeleteTouchpointConfirm(null)}
                                className="px-3 py-1 border border-gray-700 hover:border-gray-500 rounded-full text-xs font-semibold text-gray-400 hover:text-white cursor-pointer"
                              >
                                Cancel
                              </button>
                              <button
                                type="button"
                                onClick={() => handleDeleteTouchpoint(tp.id)}
                                className="px-3 py-1 bg-red-600 hover:bg-red-700 text-white rounded-full text-xs font-semibold cursor-pointer"
                              >
                                Confirm
                              </button>
                            </div>
                          </div>
                        ) : (
                          /* Normal Touchpoint View */
                          <div className="text-sm flex flex-col bg-[#111827]/20 p-4 rounded-2xl border border-gray-800/40 relative group/row">
                            <div className="flex justify-between items-start text-gray-300">
                              <div>
                                <span className="font-semibold capitalize text-xs bg-gray-800 px-2 py-0.5 rounded text-cyan-400">
                                  {tp.channel === 'in_person' ? 'In Person' : tp.channel}
                                </span>
                                <p className="text-[11px] text-gray-500 mt-1">
                                  {new Date(tp.contact_date).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                                </p>
                              </div>
                              
                              {/* Action Buttons for Row */}
                              <div className="flex gap-2 opacity-0 group-hover/row:opacity-100 transition-opacity duration-200">
                                <button
                                  onClick={() => handleStartEditTouchpoint(tp)}
                                  className="w-7 h-7 flex items-center justify-center text-gray-400 hover:text-cyan-400 border border-gray-800 rounded-full hover:bg-gray-800/60 transition-colors cursor-pointer"
                                  title="Edit touchpoint"
                                >
                                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L6.832 19.82a4.5 4.5 0 01-1.897 1.13l-2.685.8.8-2.685a4.5 4.5 0 011.13-1.897L16.863 4.487zm0 0L19.5 7.125" />
                                  </svg>
                                </button>
                                <button
                                  onClick={() => setShowDeleteTouchpointConfirm(tp.id)}
                                  className="w-7 h-7 flex items-center justify-center text-gray-400 hover:text-red-400 border border-gray-800 rounded-full hover:bg-gray-800/60 transition-colors cursor-pointer"
                                  title="Delete touchpoint"
                                >
                                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
                                  </svg>
                                </button>
                              </div>
                            </div>
                            {tp.note && (
                              <p className="text-xs text-gray-400 italic mt-2.5 leading-relaxed border-l border-cyan-500/30 pl-2">
                                {tp.note}
                              </p>
                            )}
                          </div>
                        )}
                      </div>
                    ))}
                    
                    {/* Timeline Paging Load More */}
                    {contact.touchpoints.length > visibleCount && (
                      <div className="text-center pt-2">
                        <button
                          onClick={() => setVisibleCount(prev => prev + 10)}
                          className="w-9 h-9 flex items-center justify-center text-cyan-400 hover:text-cyan-300 border border-cyan-500/40 rounded-full hover:bg-cyan-500/10 mx-auto transition-all duration-200 cursor-pointer"
                          title="Load More History"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
                          </svg>
                        </button>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="text-center py-6 border border-dashed border-gray-800 rounded-xl">
                    <p className="text-sm text-gray-500 italic">No touchpoints logged yet.</p>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Bottom Actions Footer */}
        {!showDeleteConfirm && (
          <div className="p-6 bg-[#070b14]/50 border-t border-gray-800/80 flex justify-between items-center shrink-0">
            <div className="flex gap-2">
              {/* Edit Contact Button */}
              <button
                onClick={() => {
                  if (isEditingContact) {
                    handleSaveEditContact();
                  } else {
                    handleOpenEditContact();
                  }
                }}
                disabled={saving}
                className={`w-10 h-10 flex items-center justify-center rounded-full border transition-all duration-200 cursor-pointer ${
                  isEditingContact
                    ? "bg-cyan-500 border-cyan-500 text-white hover:bg-cyan-600"
                    : "text-cyan-400 border-cyan-500/40 hover:border-cyan-500 hover:text-white hover:bg-cyan-500/10"
                }`}
                title={isEditingContact ? "Save Details" : "Edit Contact"}
              >
                {saving ? (
                  <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                ) : isEditingContact ? (
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                  </svg>
                ) : (
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L6.832 19.82a4.5 4.5 0 01-1.897 1.13l-2.685.8.8-2.685a4.5 4.5 0 011.13-1.897L16.863 4.487zm0 0L19.5 7.125" />
                  </svg>
                )}
              </button>

              {/* Delete / Cancel Button */}
              <button
                onClick={() => {
                  if (isEditingContact) {
                    setIsEditingContact(false);
                  } else {
                    setShowDeleteConfirm(true);
                  }
                }}
                className="w-10 h-10 flex items-center justify-center text-red-500 hover:text-white border border-red-500/50 rounded-full hover:border-red-500 hover:bg-red-500/10 transition-all duration-200 cursor-pointer"
                title={isEditingContact ? "Cancel Editing" : "Delete Contact"}
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                  {isEditingContact ? (
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M6 18L18 6M6 6l12 12" />
                  ) : (
                    <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
                  )}
                </svg>
              </button>
            </div>
            
            <div className="flex gap-2">
              {/* Reach Out Circular Button */}
              <button
                onClick={() => onReachOut(contact)}
                className="w-10 h-10 flex items-center justify-center text-gray-400 hover:text-white border border-gray-700 rounded-full hover:border-gray-600 hover:bg-[#111827] transition-all duration-200 cursor-pointer"
                title="Reach Out"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 8.25h9m-9 3H12m-9.75 1.51c0 1.6 1.123 2.994 2.707 3.227 1.129.166 2.27.293 3.423.379.35.026.67.21.865.501L12 21l2.755-4.133a1.14 1.14 0 01.865-.501c1.153-.086 2.294-.21 3.423-.379 1.584-.233 2.707-1.626 2.707-3.228V6.741c0-1.602-1.123-2.995-2.707-3.228A48.394 48.394 0 0012 3c-2.392 0-4.744.175-7.043.513C3.373 3.746 2.25 5.14 2.25 6.741v6.018z" />
                </svg>
              </button>
              {/* Log Circular Button */}
              <button
                onClick={() => onLogTouchpoint(contact.id)}
                className="w-10 h-10 flex items-center justify-center text-cyan-400 hover:text-white border border-cyan-500/40 rounded-full hover:border-cyan-500 hover:bg-cyan-500/10 transition-all duration-200 cursor-pointer"
                title="Log Touchpoint"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
                </svg>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
