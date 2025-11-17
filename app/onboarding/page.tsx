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
  location?: string;
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

export default function OnboardingPage() {
  const [user, setUser] = useState<User | null>(null);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const router = useRouter();

  // Form state
  const [name, setName] = useState("");
  const [relationship, setRelationship] = useState("Friend");
  const [cadenceDays, setCadenceDays] = useState(30);
  const [location, setLocation] = useState("");
  const [birthday, setBirthday] = useState("");
  const [notes, setNotes] = useState("");

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
      const { data, error } = await supabase
        .from("contacts")
        .insert([
          {
            user_id: user.id,
            name: name.trim(),
            relationship: relationship,
            cadence_days: cadenceDays,
            location: location.trim() || null,
            birthday: birthday || null,
            notes: notes.trim() || null,
          },
        ])
        .select()
        .single();

      if (error) throw error;

      setContacts([...contacts, data]);
      
      // Reset form
      setName("");
      setLocation("");
      setBirthday("");
      setNotes("");
      setRelationship("Friend");
      setCadenceDays(30);
    } catch (err: any) {
      alert(`Error adding contact: ${err.message}`);
    } finally {
      setSaving(false);
    }
  };

  const handleFinish = () => {
    router.push("/");
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
          <h1 className="text-sm uppercase tracking-widest text-gray-400 mb-2">
            ONBOARDING
          </h1>
          <h2 className="text-3xl font-bold mb-2">Who are your top people?</h2>
          <p className="text-gray-400">
            Add the people you want to stay in touch with. You can add more later.
          </p>
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
                  onChange={(e) => setCadenceDays(parseInt(e.target.value) || 30)}
                  min="1"
                  className="w-full px-4 py-2 bg-[#111827] border border-gray-700 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-cyan-500"
                  placeholder="Custom days"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Connect every {cadenceDays} day{cadenceDays !== 1 ? "s" : ""}
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Location (optional)
                </label>
                <input
                  type="text"
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  className="w-full px-4 py-2 bg-[#111827] border border-gray-700 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-cyan-500"
                  placeholder="New York, NY"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Birthday (optional)
                </label>
                <input
                  type="date"
                  value={birthday}
                  onChange={(e) => setBirthday(e.target.value)}
                  className="w-full px-4 py-2 bg-[#111827] border border-gray-700 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-cyan-500 text-sm sm:text-base"
                />
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
                      <div>
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
                    </div>
                  </div>
                ))}
              </div>
            )}

            {contacts.length > 0 && (
              <button
                onClick={handleFinish}
                className="w-full mt-6 bg-cyan-500 text-white py-3 px-4 rounded-md hover:bg-cyan-600 transition-colors font-medium"
              >
                <span className="hidden sm:inline">Finish & Go to Dashboard</span>
                <span className="sm:hidden">Finish</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

