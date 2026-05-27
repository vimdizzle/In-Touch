"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { useRouter } from "next/navigation";
import type { User } from "@supabase/supabase-js";
import { formatBirthdayForDB, parseBirthday } from "@/lib/utils";

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
  phone?: string;
  email?: string;
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

type OnboardingStep = "welcome" | "setup" | "done";

export default function OnboardingPage() {
  const [user, setUser] = useState<User | null>(null);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const router = useRouter();

  // 3-Step Wizard state
  const [step, setStep] = useState<OnboardingStep>("welcome");

  // Unified Form state for one contact at a time
  const [name, setName] = useState("");
  const [relationship, setRelationship] = useState("Friend");
  const [cadenceDays, setCadenceDays] = useState(30);
  const [city, setCity] = useState("");
  const [country, setCountry] = useState("");
  const [birthdayMonth, setBirthdayMonth] = useState("");
  const [birthdayDay, setBirthdayDay] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
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
    setError("");
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
            phone: phone.trim() || null,
            email: email.trim() || null,
            notes: notes.trim() || null,
          },
        ])
        .select()
        .single();

      if (error) throw error;

      // Stage contact instantly to lists
      setContacts([data, ...contacts]);
      
      // Reset Unified Setup Form completely
      setName("");
      setRelationship("Friend");
      setCadenceDays(30);
      setCity("");
      setCountry("");
      setBirthdayMonth("");
      setBirthdayDay("");
      setPhone("");
      setEmail("");
      setNotes("");
    } catch (err: any) {
      setError(err.message || "Failed to add contact");
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteContact = async (contactId: string) => {
    setError("");
    try {
      const { error } = await supabase
        .from("contacts")
        .delete()
        .eq("id", contactId);

      if (error) throw error;

      setContacts(contacts.filter((c) => c.id !== contactId));
    } catch (err: any) {
      setError(err.message || "Failed to remove contact");
    }
  };

  const handleFinish = () => {
    router.push("/");
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#020617] flex items-center justify-center">
        <div className="text-white flex flex-col items-center gap-3">
          <svg className="animate-spin h-8 w-8 text-cyan-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
          <span className="text-sm font-semibold tracking-wide text-gray-500">Loading your profile...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#020617] text-white flex flex-col justify-center items-center py-6 px-4 relative overflow-hidden select-none">
      {/* Low-opacity subtle glowing backdrops */}
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-cyan-500/5 rounded-full blur-3xl -z-10" />
      <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-indigo-500/5 rounded-full blur-3xl -z-10" />

      {/* Main unified onboarding container */}
      <main className="w-full max-w-3xl bg-[#0b1120]/45 border border-gray-800/80 backdrop-blur-md rounded-3xl p-6 sm:p-10 shadow-2xl flex flex-col justify-between min-h-[500px] max-h-[90vh]">
        
        {/* STEP 1: WELCOME INTRO */}
        {step === "welcome" && (
          <div className="flex flex-col items-center justify-center py-8 text-center max-w-md mx-auto my-auto animate-scaleUp">
            <div className="w-16 h-16 rounded-full bg-gradient-to-tr from-cyan-500 to-indigo-500 flex items-center justify-center p-[2px] mb-8 shadow-[0_0_20px_rgba(6,182,212,0.15)]">
              <div className="w-full h-full bg-[#020617] rounded-full flex items-center justify-center">
                <svg className="w-8 h-8 text-cyan-400 animate-pulse" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M18 18.72a9.094 9.094 0 003.741-.479 3 3 0 00-4.682-2.72m.94 3.198.001.031c0 .225-.012.447-.037.666A11.944 11.944 0 0112 21c-2.17 0-4.207-.576-5.963-1.584A6.062 6.062 0 016 18.719m12 0a5.971 5.971 0 00-.941-3.197m0 0A5.995 5.995 0 0012 12.75a5.995 5.995 0 00-5.058 2.772m0 0a3 3 0 00-4.681 2.72 8.986 8.986 0 003.74.477m.94-3.197a5.971 5.971 0 00-.94-3.197M15 6.75a3 3 0 11-6 0 3 3 0 016 0zm6 3a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0zm-13.5 0a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0z" />
                </svg>
              </div>
            </div>
            <h2 className="text-2xl font-extrabold tracking-tight text-white mb-3">
              Stay in Touch
            </h2>
            <p className="text-slate-400 text-xs leading-relaxed mb-8 max-w-sm">
              Keep track of the relationships that matter most to you. Add contacts, set mindful reminder rhythms, and never lose touch.
            </p>
            <button
              onClick={() => setStep("setup")}
              className="px-6 py-3 bg-gradient-to-r from-cyan-500 to-indigo-500 hover:from-cyan-600 hover:to-indigo-600 text-white rounded-full font-bold text-xs shadow-md shadow-cyan-950/20 transition-all duration-200 flex items-center gap-2 group cursor-pointer"
            >
              Get Started
              <svg className="w-4 h-4 group-hover:translate-x-1 transition-transform" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
              </svg>
            </button>
          </div>
        )}

        {/* STEP 2: UNIFIED CIRCLE BUILDER */}
        {step === "setup" && (
          <div className="flex-1 flex flex-col lg:flex-row gap-8 overflow-hidden animate-fadeIn justify-between">
            {/* Left Column: Spacious configuration form */}
            <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar max-h-[58vh]">
              <div>
                <h3 className="text-base font-bold text-white mb-0.5">Configure Contact</h3>
                <p className="text-[11px] text-slate-400 mb-5">
                  Configure connection cadences and details for one person at a time.
                </p>

                <form onSubmit={handleAddContact} className="space-y-4">
                  {error && (
                    <div className="p-3 bg-red-900/20 border border-red-800 text-red-400 rounded-xl text-xs">
                      {error}
                    </div>
                  )}

                  {/* Name field */}
                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">
                      Name *
                    </label>
                    <input
                      type="text"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      required
                      placeholder="e.g. Mom, Jane Doe, David"
                      className="w-full px-4 py-2.5 bg-[#111827] border border-slate-700/80 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-cyan-500 text-xs placeholder-slate-600 transition-all"
                    />
                  </div>

                  {/* Relationship quick selection */}
                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">
                      Relationship
                    </label>
                    <div className="flex flex-wrap gap-1.5 mb-2">
                      {["Parent", "Sibling", "Friend", "Family", "Coworker"].map((rel) => (
                        <button
                          key={rel}
                          type="button"
                          onClick={() => setRelationship(rel)}
                          className={`px-3 py-1.5 text-[11px] font-semibold rounded-full border transition-all duration-200 cursor-pointer ${
                            relationship === rel
                              ? "bg-cyan-500 border-cyan-500 text-white shadow-md shadow-cyan-950/20"
                              : "bg-[#111827] border-gray-700 text-slate-300 hover:border-gray-600 hover:text-white"
                          }`}
                        >
                          {rel}
                        </button>
                      ))}
                    </div>
                    <select
                      value={relationship}
                      onChange={(e) => setRelationship(e.target.value)}
                      className="w-full px-4 py-2 bg-[#111827] border border-slate-700/80 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-cyan-500 text-xs"
                    >
                      {RELATIONSHIPS.map((rel) => (
                        <option key={rel} value={rel}>
                          {rel}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Unified Cadence Selector */}
                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">
                      Cadence (How often to connect)
                    </label>
                    <div className="flex flex-wrap gap-1.5 mb-2">
                      {[
                        { label: "Weekly", days: 7 },
                        { label: "Bi-weekly", days: 14 },
                        { label: "Monthly", days: 30 },
                        { label: "Quarterly", days: 90 },
                      ].map((preset) => {
                        const isSelected = cadenceDays === preset.days;
                        return (
                          <button
                            key={preset.days}
                            type="button"
                            onClick={() => setCadenceDays(preset.days)}
                            className={`px-3 py-1.5 text-[11px] font-semibold rounded-full border transition-all duration-200 cursor-pointer ${
                              isSelected
                                ? "bg-cyan-500 border-cyan-500 text-white shadow-md shadow-cyan-950/20"
                                : "bg-[#111827] border-gray-700/80 text-slate-300 hover:border-gray-600 hover:text-white"
                            }`}
                          >
                            {preset.label}
                          </button>
                        );
                      })}
                      <button
                        type="button"
                        onClick={() => {
                          if ([7, 14, 30, 90].includes(cadenceDays)) {
                            setCadenceDays(45); // Set custom to 45 by default when toggled
                          }
                        }}
                        className={`px-3 py-1.5 text-[11px] font-semibold rounded-full border transition-all duration-200 cursor-pointer ${
                          ![7, 14, 30, 90].includes(cadenceDays)
                            ? "bg-cyan-500 border-cyan-500 text-white shadow-md shadow-cyan-950/20"
                            : "bg-[#111827] border-gray-700/80 text-slate-300 hover:border-gray-600 hover:text-white"
                        }`}
                      >
                        Custom
                      </button>
                    </div>

                    {/* Inline custom numerical input */}
                    {![7, 14, 30, 90].includes(cadenceDays) && (
                      <div className="flex items-center gap-2 animate-fadeIn mt-1 pl-1">
                        <span className="text-[10px] text-slate-400 font-medium">Connect every</span>
                        <input
                          type="number"
                          value={cadenceDays || ""}
                          onChange={(e) => {
                            const val = e.target.value;
                            if (val !== "") {
                              const num = parseInt(val);
                              if (!isNaN(num) && num > 0) setCadenceDays(num);
                            } else {
                              setCadenceDays(0);
                            }
                          }}
                          min="1"
                          className="w-16 px-2.5 py-1 bg-[#111827] border border-slate-700 rounded-lg text-white text-xs font-bold text-center focus:outline-none focus:ring-1 focus:ring-cyan-500"
                        />
                        <span className="text-[10px] text-slate-400 font-medium">days</span>
                      </div>
                    )}
                  </div>

                  {/* Side-by-Side City/Country Location */}
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">
                        📍 City (Optional)
                      </label>
                      <input
                        type="text"
                        value={city}
                        onChange={(e) => setCity(e.target.value)}
                        placeholder="e.g. San Francisco"
                        className="w-full px-3 py-2 bg-[#111827] border border-slate-700/80 rounded-xl text-white text-xs focus:outline-none focus:ring-2 focus:ring-cyan-500 placeholder-slate-700"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">
                        Country (Optional)
                      </label>
                      <input
                        type="text"
                        value={country}
                        onChange={(e) => setCountry(e.target.value)}
                        placeholder="e.g. United States"
                        className="w-full px-3 py-2 bg-[#111827] border border-slate-700/80 rounded-xl text-white text-xs focus:outline-none focus:ring-2 focus:ring-cyan-500 placeholder-slate-700"
                      />
                    </div>
                  </div>

                  {/* Side-by-Side Birthday Month/Day selects */}
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">
                        🎂 Month (Optional)
                      </label>
                      <select
                        value={birthdayMonth}
                        onChange={(e) => {
                          setBirthdayMonth(e.target.value);
                          if (!e.target.value) setBirthdayDay("");
                        }}
                        className="w-full px-2.5 py-2 bg-[#111827] border border-slate-700/80 rounded-xl text-white text-xs focus:outline-none focus:ring-2 focus:ring-cyan-500"
                      >
                        <option value="">Month</option>
                        {MONTHS.map((m) => (
                          <option key={m.value} value={m.value}>{m.label}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">
                        Day (Optional)
                      </label>
                      <select
                        value={birthdayDay}
                        onChange={(e) => setBirthdayDay(e.target.value)}
                        disabled={!birthdayMonth}
                        className="w-full px-2.5 py-2 bg-[#111827] border border-slate-700/80 rounded-xl text-white text-xs focus:outline-none focus:ring-2 focus:ring-cyan-500 disabled:opacity-40"
                      >
                        <option value="">Day</option>
                        {birthdayMonth && getDaysInMonth(birthdayMonth).map((d) => (
                          <option key={d} value={String(d).padStart(2, '0')}>{d}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {/* Side-by-Side Optional phone/email */}
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">
                        Phone (Optional)
                      </label>
                      <input
                        type="tel"
                        value={phone}
                        onChange={(e) => setPhone(e.target.value)}
                        placeholder="+1 (555) 000-0000"
                        className="w-full px-3 py-2 bg-[#111827] border border-slate-700/80 rounded-xl text-white text-xs focus:outline-none focus:ring-2 focus:ring-cyan-500 placeholder-slate-700"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">
                        Email (Optional)
                      </label>
                      <input
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="example@email.com"
                        className="w-full px-3 py-2 bg-[#111827] border border-slate-700/80 rounded-xl text-white text-xs focus:outline-none focus:ring-2 focus:ring-cyan-500 placeholder-slate-700"
                      />
                    </div>
                  </div>

                  {/* Optional notes */}
                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">
                      Notes (Optional)
                    </label>
                    <textarea
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      rows={2}
                      placeholder="e.g. Prefers FaceTime, ask about their new project..."
                      className="w-full px-3 py-2 bg-[#111827] border border-slate-700/80 rounded-xl text-white text-xs focus:outline-none focus:ring-2 focus:ring-cyan-500 placeholder-slate-700"
                    />
                  </div>

                  {/* Non-wrapping, fully padded Add button */}
                  <button
                    type="submit"
                    disabled={saving || !name.trim()}
                    className="w-full h-11 flex items-center justify-center bg-cyan-500 hover:bg-cyan-600 text-white rounded-full font-bold transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed shadow-[0_0_15px_rgba(6,182,212,0.15)] cursor-pointer py-2.5 px-6 shrink-0"
                  >
                    {saving ? (
                      <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                    ) : (
                      <span className="flex items-center gap-2 whitespace-nowrap text-sm tracking-wide">
                        Add to Circle
                        <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                        </svg>
                      </span>
                    )}
                  </button>
                </form>
              </div>
            </div>

            {/* Right Column: Clean, simple styled Sidebar list */}
            <div className="w-full lg:w-72 border-t lg:border-t-0 lg:border-l border-slate-800/80 pt-6 lg:pt-0 lg:pl-6 flex flex-col overflow-hidden max-h-[58vh]">
              <h4 className="text-xs font-bold text-white mb-3 flex items-center justify-between shrink-0">
                <span>Added Connections</span>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-900 border border-slate-800 text-cyan-400 font-semibold">
                  {contacts.length} total
                </span>
              </h4>

              {contacts.length === 0 ? (
                <div className="flex-1 flex items-center justify-center bg-slate-900/10 border border-dashed border-slate-800/80 rounded-2xl p-6 text-center animate-fadeIn min-h-[100px] lg:min-h-0">
                  <p className="text-[10px] text-slate-500 max-w-[150px] leading-relaxed">
                    No contacts configured yet. Use the form on the left to add someone.
                  </p>
                </div>
              ) : (
                <div className="flex-1 overflow-y-auto space-y-2 pr-1 custom-scrollbar">
                  {contacts.map((contact) => (
                    <div
                      key={contact.id}
                      className="bg-[#111827]/40 border border-slate-800/80 hover:border-slate-700/80 rounded-2xl p-2.5 flex justify-between items-center transition-all duration-200 animate-scaleUp"
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className="w-8 h-8 rounded-full bg-slate-800 flex items-center justify-center font-bold text-cyan-400 border border-cyan-500/10 text-xs shrink-0">
                          {contact.name.charAt(0).toUpperCase()}
                        </div>
                        <div className="min-w-0">
                          <h5 className="font-bold text-white text-[11px] leading-none mb-1 truncate">{contact.name}</h5>
                          <div className="flex gap-1">
                            <span className="text-[9px] text-slate-400 font-semibold px-1.5 py-0.2 bg-slate-900 rounded border border-slate-800 leading-none">
                              {contact.relationship}
                            </span>
                            <span className="text-[9px] text-cyan-400 font-semibold px-1.5 py-0.2 bg-slate-900 rounded border border-slate-800 leading-none">
                              {contact.cadence_days}d
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Small, clean circular trash button */}
                      <button
                        onClick={() => handleDeleteContact(contact.id!)}
                        className="w-8 h-8 flex items-center justify-center text-slate-500 hover:text-red-400 border border-slate-800 hover:border-red-500/20 rounded-full hover:bg-red-500/5 transition-all duration-200 cursor-pointer shrink-0"
                        title="Remove Contact"
                      >
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
                        </svg>
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* STEP 3: SIMPLE DONE SCREEN */}
        {step === "done" && (
          <div className="flex flex-col items-center justify-center text-center py-10 max-w-sm mx-auto my-auto animate-scaleUp">
            <div className="w-14 h-14 rounded-full bg-cyan-950 border border-cyan-500/40 flex items-center justify-center text-cyan-400 text-2xl mb-6 shadow-[0_0_20px_rgba(6,182,212,0.1)] shrink-0">
              ✓
            </div>
            <h3 className="text-xl font-bold text-white mb-2">Setup Complete!</h3>
            <p className="text-slate-400 text-xs leading-relaxed mb-8">
              You have successfully configured <strong>{contacts.length} connection{contacts.length !== 1 ? 's' : ''}</strong> in your inner circle. We will start tracking your connection schedules right away.
            </p>

            <button
              onClick={handleFinish}
              className="px-8 py-3.5 bg-gradient-to-r from-cyan-500 to-indigo-500 hover:from-cyan-600 hover:to-indigo-600 text-white rounded-full font-bold shadow-[0_4px_20px_rgba(6,182,212,0.2)] transition-all duration-200 cursor-pointer text-sm"
            >
              Enter Dashboard
            </button>
          </div>
        )}

        {/* Minimal Navigation Footer */}
        {step === "setup" && (
          <div className="mt-6 pt-5 border-t border-slate-800/80 flex justify-between items-center shrink-0">
            <button
              onClick={() => setStep("welcome")}
              className="px-5 py-2 text-xs font-semibold text-slate-400 hover:text-white transition-colors cursor-pointer"
            >
              Back to Intro
            </button>
            <button
              onClick={() => setStep("done")}
              disabled={contacts.length === 0}
              className="px-6 py-2.5 bg-gradient-to-r from-cyan-500 to-indigo-500 hover:from-cyan-600 hover:to-indigo-600 text-white rounded-full font-bold shadow-md shadow-cyan-950/20 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer text-xs"
            >
              Finish Setup
            </button>
          </div>
        )}
      </main>
    </div>
  );
}
