"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { useRouter } from "next/navigation";
import type { User } from "@supabase/supabase-js";

interface Contact {
  id?: string;
  name: string;
  relationship: string;
  cadence_days: number;
  city?: string;
  country?: string;
  location?: string; // kept for backward compatibility
  birthday?: string;
  notes?: string;
}

const RELATIONSHIPS = [
  "Friend",
  "Family",
  "Sibling",
  "Parent",
  "Coworker",
  "Mentor",
  "Other",
];

const CADENCE_PRESETS = [
  { label: "Weekly", days: 7 },
  { label: "Monthly", days: 30 },
  { label: "Quarterly", days: 90 },
  { label: "Yearly", days: 365 },
];

// Helper functions for birthday (month/day only, no year)
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

export default function AddContactPage() {
  const [user, setUser] = useState<User | null>(null);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const router = useRouter();

  // Form state
  const [name, setName] = useState("");
  const [relationship, setRelationship] = useState("Friend");
  const [cadenceDays, setCadenceDays] = useState(30);
  const [city, setCity] = useState("");
  const [country, setCountry] = useState("");
  const [birthdayMonth, setBirthdayMonth] = useState("");
  const [birthdayDay, setBirthdayDay] = useState("");
  const [notes, setNotes] = useState("");
  const [lastTouchpointDate, setLastTouchpointDate] = useState("");

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (!session) {
        router.push("/auth");
      } else {
        setUser(session.user);
        
        // Load existing contacts
        const { data, error } = await supabase
          .from("contacts")
          .select("*")
          .eq("user_id", session.user.id)
          .order("created_at", { ascending: false });
        
        if (!error && data) {
          setContacts(data);
        }
        
        setLoading(false);
      }
    });
  }, [router]);

  const handleAddContact = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !user) return;

    setSaving(true);
    try {
      const birthdayForDB = formatBirthdayForDB(birthdayMonth, birthdayDay);
      
      const { data, error } = await supabase
        .from("contacts")
        .insert([
          {
            user_id: user.id,
            name: name.trim(),
            relationship: relationship,
            cadence_days: cadenceDays,
            city: city.trim() || null,
            country: country.trim() || null,
            birthday: birthdayForDB,
            notes: notes.trim() || null,
          },
        ])
        .select()
        .single();

      if (error) throw error;
      if (!data) {
        throw new Error("Contact was created but data was not returned");
      }

      // If last touchpoint date is provided, create a touchpoint
      if (lastTouchpointDate && data.id) {
        const { error: touchpointError } = await supabase
          .from("touchpoints")
          .insert([
            {
              contact_id: data.id,
              channel: "other",
              contact_date: lastTouchpointDate,
              note: "Initial touchpoint",
            },
          ]);

        if (touchpointError) {
          console.error("Error creating touchpoint:", touchpointError);
          // Don't throw - contact was created successfully
        }
      }

      setContacts([...contacts, data]);
      
      // Show success message with contact name
      setSuccessMessage(data.name);
      
      // Reset form
      setName("");
      setCity("");
      setCountry("");
      setBirthdayMonth("");
      setBirthdayDay("");
      setNotes("");
      setLastTouchpointDate("");
      setRelationship("Friend");
      setCadenceDays(30);
    } catch (err: any) {
      alert(`Error adding contact: ${err.message}`);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (contactId: string) => {
    if (!user) return;

    setDeleting(true);
    try {
      const { error } = await supabase
        .from("contacts")
        .delete()
        .eq("id", contactId)
        .eq("user_id", user.id);

      if (error) throw error;

      // Remove from local state
      setContacts(contacts.filter((c) => c.id !== contactId));
      setShowDeleteConfirm(null);
    } catch (err: any) {
      alert(`Error deleting contact: ${err.message}`);
    } finally {
      setDeleting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#020617] flex items-center justify-center">
        <div className="text-white">Loading...</div>
      </div>
    );
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
            ADD CONTACT
          </h1>
          <h2 className="text-3xl font-bold mb-2">Add the people you want to stay in touch with.</h2>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Add Contact Form */}
          <div className="bg-[#0b1120] border border-gray-800 rounded-lg p-4 sm:p-6">
            <h3 className="text-lg font-semibold mb-4">Add Contact</h3>
            <form onSubmit={handleAddContact} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Name *
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                  className="w-full px-4 py-2 bg-[#111827] border border-gray-700 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-cyan-500"
                  placeholder="John Doe"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Relationship
                </label>
                <select
                  value={relationship}
                  onChange={(e) => setRelationship(e.target.value)}
                  className="w-full px-4 py-2 bg-[#111827] border border-gray-700 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-cyan-500"
                >
                  {RELATIONSHIPS.map((rel) => (
                    <option key={rel} value={rel}>
                      {rel}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Cadence (how often to connect)
                </label>
                <div className="flex flex-wrap gap-2 mb-2">
                  {CADENCE_PRESETS.map((preset) => (
                    <button
                      key={preset.days}
                      type="button"
                      onClick={() => setCadenceDays(preset.days)}
                      className={`px-3 py-1 text-sm rounded-md border transition-colors ${
                        cadenceDays === preset.days
                          ? "bg-cyan-500 border-cyan-500 text-white"
                          : "bg-[#111827] border-gray-700 text-gray-300 hover:border-gray-600"
                      }`}
                    >
                      {preset.label}
                    </button>
                  ))}
                </div>
                <input
                  type="number"
                  value={cadenceDays}
                  onChange={(e) => {
                    const value = e.target.value;
                    if (value === '') {
                      setCadenceDays(0);
                    } else {
                      const num = parseInt(value);
                      if (!isNaN(num) && num > 0) {
                        setCadenceDays(num);
                      }
                    }
                  }}
                  min="1"
                  className="w-full px-4 py-2 bg-[#111827] border border-gray-700 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-cyan-500"
                  placeholder="Custom days"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Connect every {cadenceDays} day{cadenceDays !== 1 ? "s" : ""}
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    City (optional)
                  </label>
                  <input
                    type="text"
                    value={city}
                    onChange={(e) => setCity(e.target.value)}
                    className="w-full px-4 py-2 bg-[#111827] border border-gray-700 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-cyan-500"
                    placeholder="San Jose"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Country (optional)
                  </label>
                  <input
                    type="text"
                    value={country}
                    onChange={(e) => setCountry(e.target.value)}
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
                      value={birthdayMonth}
                      onChange={(e) => {
                        setBirthdayMonth(e.target.value);
                        // Reset day if month changes and current day is invalid
                        if (e.target.value) {
                          const daysInMonth = getDaysInMonth(e.target.value);
                          if (birthdayDay && parseInt(birthdayDay) > daysInMonth.length) {
                            setBirthdayDay("");
                          }
                        } else {
                          setBirthdayDay("");
                        }
                      }}
                      className="w-full px-4 py-3 sm:py-2 bg-[#111827] border border-gray-700 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-cyan-500 text-sm sm:text-base min-h-[44px] sm:min-h-0"
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
                      value={birthdayDay}
                      onChange={(e) => setBirthdayDay(e.target.value)}
                      disabled={!birthdayMonth}
                      className="w-full px-4 py-3 sm:py-2 bg-[#111827] border border-gray-700 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-cyan-500 text-sm sm:text-base min-h-[44px] sm:min-h-0 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <option value="">Day</option>
                      {birthdayMonth && getDaysInMonth(birthdayMonth).map((day) => (
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
                  Last touchpoint (optional)
                </label>
                <input
                  type="date"
                  value={lastTouchpointDate}
                  onChange={(e) => setLastTouchpointDate(e.target.value)}
                  className="w-full max-w-full px-4 py-3 sm:py-2 bg-[#111827] border border-gray-700 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-cyan-500 text-sm sm:text-base box-border min-h-[44px] sm:min-h-0"
                  style={{ WebkitAppearance: 'none', appearance: 'none' }}
                />
                <p className="text-xs text-gray-500 mt-1">
                  When did you last contact this person? This helps us know when to remind you next.
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Notes (optional)
                </label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={3}
                  className="w-full px-4 py-2 bg-[#111827] border border-gray-700 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-cyan-500"
                  placeholder="Prefers WhatsApp, Ask about new job..."
                />
              </div>

              <button
                type="submit"
                disabled={saving || !name.trim()}
                className="w-full bg-cyan-500 text-white py-2 px-4 rounded-md hover:bg-cyan-600 disabled:bg-gray-600 disabled:cursor-not-allowed transition-colors font-medium"
              >
                {saving ? "Adding..." : "Add Contact"}
              </button>
            </form>
            
            {/* Success Message */}
            {successMessage && (
              <div className="mt-4 p-3 bg-green-900/20 border border-green-800 text-green-400 rounded-md text-sm">
                ✓ {successMessage} has been added to your contacts
              </div>
            )}
          </div>

          {/* Contacts List */}
          <div className="bg-[#0b1120] border border-gray-800 rounded-lg p-4 sm:p-6">
            <h3 className="text-lg font-semibold mb-4">
              Your Contacts ({contacts.length})
            </h3>
            {contacts.length === 0 ? (
              <p className="text-gray-400 text-sm">
                No contacts added yet. Add your first contact using the form.
              </p>
            ) : (
              <div className="space-y-3">
                {contacts.map((contact) => (
                  <div
                    key={contact.id}
                    className="bg-[#111827] border border-gray-700 rounded-md p-4"
                  >
                    <div className="flex justify-between items-start">
                      <div className="flex-1">
                        <h4 className="font-semibold text-white">
                          {contact.name}
                        </h4>
                        <p className="text-sm text-gray-400">
                          {contact.relationship}
                        </p>
                        <p className="text-xs text-gray-500 mt-1">
                          Every {contact.cadence_days} days
                        </p>
                      </div>
                      <div className="flex gap-2 ml-3">
                        <button
                          onClick={() => router.push(`/contacts/${contact.id}`)}
                          className="px-3 py-1 text-xs text-gray-400 hover:text-white border border-gray-700 rounded-md hover:border-gray-600 transition-colors"
                        >
                          View
                        </button>
                        <button
                          onClick={() => setShowDeleteConfirm(contact.id || "")}
                          disabled={deleting}
                          className="px-3 py-1 text-xs bg-red-600 hover:bg-red-700 text-white rounded-md transition-colors disabled:opacity-50"
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Delete Confirmation Modal */}
        {showDeleteConfirm && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
            <div className="bg-[#0b1120] border border-gray-800 rounded-lg p-6 max-w-md w-full">
              <h3 className="text-xl font-semibold text-white mb-2">Delete Contact</h3>
              <p className="text-gray-400 mb-6">
                Are you sure you want to delete <span className="font-semibold text-white">
                  {contacts.find(c => c.id === showDeleteConfirm)?.name}
                </span>? This action cannot be undone and will also delete all associated touchpoints.
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => setShowDeleteConfirm(null)}
                  disabled={deleting}
                  className="flex-1 px-4 py-2 text-gray-400 hover:text-white border border-gray-700 rounded-md hover:border-gray-600 transition-colors disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  onClick={() => handleDelete(showDeleteConfirm)}
                  disabled={deleting}
                  className="flex-1 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-md transition-colors font-medium disabled:bg-gray-600 disabled:cursor-not-allowed"
                >
                  {deleting ? "Deleting..." : "Delete"}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

