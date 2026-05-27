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

const getRelationshipDefaultDays = (rel: string): number => {
  switch (rel) {
    case "Parent":
    case "Sibling":
      return 7; // Weekly
    case "Family":
    case "Mentor":
      return 14; // Bi-weekly
    case "Friend":
      return 30; // Monthly
    case "Coworker":
      return 90; // Quarterly
    default:
      return 30; // Monthly
  }
};

type OnboardingStep = "welcome" | "contacts" | "cadence" | "details" | "celebrate";

export default function OnboardingPage() {
  const [user, setUser] = useState<User | null>(null);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const router = useRouter();

  // Wizard state
  const [step, setStep] = useState<OnboardingStep>("welcome");

  // Form state for adding contact
  const [name, setName] = useState("");
  const [relationship, setRelationship] = useState("Friend");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [showOptionalFields, setShowOptionalFields] = useState(false);

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
          // If user already has contacts, they shouldn't be forced into onboarding,
          // but if they navigate here manually, starting at "welcome" is fine.
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
      const defaultDays = getRelationshipDefaultDays(relationship);
      const { data, error } = await supabase
        .from("contacts")
        .insert([
          {
            user_id: user.id,
            name: name.trim(),
            relationship: relationship,
            cadence_days: defaultDays,
            phone: phone.trim() || null,
            email: email.trim() || null,
          },
        ])
        .select()
        .single();

      if (error) throw error;

      // Update contacts list with animation
      setContacts([data, ...contacts]);
      
      // Reset Quick Add Form
      setName("");
      setPhone("");
      setEmail("");
      setShowOptionalFields(false);
      setRelationship("Friend");
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

  const handleUpdateCadence = async (contactId: string, days: number) => {
    // Optimistic UI update
    setContacts((prev) =>
      prev.map((c) => (c.id === contactId ? { ...c, cadence_days: days } : c))
    );

    // Database update in background
    const { error } = await supabase
      .from("contacts")
      .update({ cadence_days: days })
      .eq("id", contactId);

    if (error) {
      console.error("Failed to update cadence in DB:", error);
    }
  };

  const handleUpdateDetails = async (contactId: string, updates: Partial<Contact>) => {
    // Optimistic UI update
    setContacts((prev) =>
      prev.map((c) => (c.id === contactId ? { ...c, ...updates } : c))
    );

    // Database update in background
    const { error } = await supabase
      .from("contacts")
      .update(updates)
      .eq("id", contactId);

    if (error) {
      console.error("Failed to update contact details in DB:", error);
    }
  };

  const handleUpdateBirthday = async (contactId: string, month: string, day: string) => {
    const birthdayForDB = formatBirthdayForDB(month, day);
    await handleUpdateDetails(contactId, { birthday: birthdayForDB || undefined });
  };

  const handleNextStep = () => {
    if (step === "welcome") setStep("contacts");
    else if (step === "contacts") {
      if (contacts.length > 0) setStep("cadence");
    } else if (step === "cadence") setStep("details");
    else if (step === "details") setStep("celebrate");
  };

  const handlePrevStep = () => {
    if (step === "contacts") setStep("welcome");
    else if (step === "cadence") setStep("contacts");
    else if (step === "details") setStep("cadence");
    else if (step === "celebrate") setStep("details");
  };

  const handleFinish = () => {
    router.push("/");
  };

  const getStepIndex = (s: OnboardingStep): number => {
    const stepsOrder: OnboardingStep[] = ["welcome", "contacts", "cadence", "details", "celebrate"];
    return stepsOrder.indexOf(s);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#020617] flex items-center justify-center">
        <div className="text-white flex flex-col items-center gap-3">
          <svg className="animate-spin h-8 w-8 text-cyan-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
          <span className="text-sm font-semibold tracking-wide text-gray-400">Loading your profile...</span>
        </div>
      </div>
    );
  }

  const stepsList: { id: OnboardingStep; label: string }[] = [
    { id: "welcome", label: "Intro" },
    { id: "contacts", label: "Add Circle" },
    { id: "cadence", label: "Rhythms" },
    { id: "details", label: "Details" },
    { id: "celebrate", label: "Complete" },
  ];

  return (
    <div className="min-h-screen bg-[#020617] text-white flex flex-col justify-between items-center py-8 px-4 relative overflow-hidden select-none">
      {/* Glowing Ambient Background Orbs */}
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-cyan-500/5 rounded-full blur-3xl -z-10 animate-pulse duration-[8000ms]" />
      <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-indigo-500/5 rounded-full blur-3xl -z-10 animate-pulse duration-[10000ms]" />

      {/* Title block / SEO Semantic Heading */}
      <header className="mb-6 text-center shrink-0">
        <h1 className="text-sm uppercase tracking-widest text-slate-500 font-extrabold">
          In Touch Onboarding
        </h1>
      </header>

      {/* Stepper Progress Bar (Visible at all steps except Welcome & Celebrate) */}
      {step !== "welcome" && step !== "celebrate" && (
        <div className="w-full max-w-xl mx-auto mb-10 px-4 shrink-0">
          <div className="flex justify-between items-center relative">
            <div className="absolute left-0 right-0 top-1/2 -translate-y-1/2 h-[2px] bg-slate-800/80 z-0" />
            <div
              className="absolute left-0 top-1/2 -translate-y-1/2 h-[2px] bg-gradient-to-r from-cyan-400 to-indigo-400 transition-all duration-500 z-0"
              style={{
                width: `${(getStepIndex(step) / (stepsList.length - 1)) * 100}%`,
              }}
            />
            {stepsList.map((s, idx) => {
              const isCompleted = getStepIndex(step) > idx;
              const isActive = step === s.id;
              return (
                <div key={s.id} className="flex flex-col items-center relative z-10">
                  <div
                    className={`w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold transition-all duration-300 ${
                      isCompleted
                        ? "bg-cyan-500 text-white shadow-[0_0_15px_rgba(6,182,212,0.4)]"
                        : isActive
                        ? "bg-slate-900 border-2 border-cyan-400 text-cyan-400 scale-110 ring-4 ring-cyan-950/40"
                        : "bg-slate-900 border border-slate-800 text-slate-500"
                    }`}
                  >
                    {isCompleted ? (
                      <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" strokeWidth="3" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                      </svg>
                    ) : (
                      idx + 1
                    )}
                  </div>
                  <span
                    className={`text-[9px] font-bold tracking-wider uppercase mt-2.5 hidden sm:block transition-colors duration-300 ${
                      isActive ? "text-cyan-400" : isCompleted ? "text-slate-400" : "text-slate-600"
                    }`}
                  >
                    {s.label}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Main glassmorphic card container */}
      <main className="w-full max-w-2xl bg-[#0b1120]/45 border border-gray-800/80 backdrop-blur-md rounded-3xl p-6 sm:p-10 shadow-2xl flex flex-col justify-between flex-1 min-h-[500px] max-h-[85vh]">
        
        {/* STEP 1: WELCOME SCREEN */}
        {step === "welcome" && (
          <div className="flex flex-col items-center justify-center py-6 text-center max-w-md mx-auto my-auto animate-scaleUp">
            <div className="w-20 h-20 rounded-full bg-gradient-to-tr from-cyan-500 to-indigo-500 flex items-center justify-center p-[2px] mb-8 shadow-[0_0_30px_rgba(6,182,212,0.2)]">
              <div className="w-full h-full bg-[#020617] rounded-full flex items-center justify-center">
                <svg className="w-10 h-10 text-cyan-400 animate-pulse" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M18 18.72a9.094 9.094 0 003.741-.479 3 3 0 00-4.682-2.72m.94 3.198.001.031c0 .225-.012.447-.037.666A11.944 11.944 0 0112 21c-2.17 0-4.207-.576-5.963-1.584A6.062 6.062 0 016 18.719m12 0a5.971 5.971 0 00-.941-3.197m0 0A5.995 5.995 0 0012 12.75a5.995 5.995 0 00-5.058 2.772m0 0a3 3 0 00-4.681 2.72 8.986 8.986 0 003.74.477m.94-3.197a5.971 5.971 0 00-.94-3.197M15 6.75a3 3 0 11-6 0 3 3 0 016 0zm6 3a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0zm-13.5 0a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0z" />
                </svg>
              </div>
            </div>
            <h2 className="text-3xl font-extrabold tracking-tight text-white mb-4">
              Welcome to <span className="bg-gradient-to-r from-cyan-400 to-indigo-400 bg-clip-text text-transparent">In Touch</span>
            </h2>
            <p className="text-slate-400 text-sm leading-relaxed mb-8">
              Stay connected with those who matter most. Let's configure your circle, setup connection cadences, and log reminders effortlessly.
            </p>
            <button
              onClick={() => setStep("contacts")}
              className="px-8 py-4 bg-gradient-to-r from-cyan-500 to-indigo-500 hover:from-cyan-600 hover:to-indigo-600 text-white rounded-full font-bold shadow-[0_4px_20px_rgba(6,182,212,0.25)] hover:shadow-[0_4px_25px_rgba(6,182,212,0.4)] transition-all duration-300 flex items-center gap-2 group cursor-pointer"
            >
              Get Started
              <svg className="w-5 h-5 group-hover:translate-x-1 transition-transform" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
              </svg>
            </button>
          </div>
        )}

        {/* STEP 2: ADD CONTACTS */}
        {step === "contacts" && (
          <div className="flex-1 flex flex-col lg:flex-row gap-8 overflow-hidden animate-fadeIn">
            {/* Left Column: Quick Add Form */}
            <div className="flex-1 flex flex-col justify-between overflow-y-auto pr-1">
              <div>
                <h3 className="text-lg font-bold text-white mb-1">Build Your Circle</h3>
                <p className="text-xs text-slate-400 mb-6">
                  Who do you want to keep in touch with? Add them to your circle.
                </p>

                <form onSubmit={handleAddContact} className="space-y-4">
                  {error && (
                    <div className="p-3 bg-red-900/20 border border-red-800 text-red-400 rounded-xl text-xs">
                      {error}
                    </div>
                  )}

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
                      className="w-full px-4 py-2.5 bg-[#111827] border border-slate-700/80 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-cyan-500 text-sm placeholder-slate-600 transition-all"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">
                      Relationship
                    </label>
                    <div className="flex flex-wrap gap-2 mb-2">
                      {["Parent", "Sibling", "Friend", "Family", "Coworker"].map((rel) => (
                        <button
                          key={rel}
                          type="button"
                          onClick={() => setRelationship(rel)}
                          className={`px-3 py-1.5 text-xs font-semibold rounded-full border transition-all duration-200 cursor-pointer ${
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
                      className="w-full px-4 py-2.5 bg-[#111827] border border-slate-700/80 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-cyan-500 text-xs"
                    >
                      {RELATIONSHIPS.map((rel) => (
                        <option key={rel} value={rel}>
                          {rel}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Accordion / Optional Info Toggle */}
                  <div className="pt-2">
                    <button
                      type="button"
                      onClick={() => setShowOptionalFields(!showOptionalFields)}
                      className="text-xs text-cyan-400 hover:text-cyan-300 font-bold flex items-center gap-1 cursor-pointer transition-colors"
                    >
                      <span>{showOptionalFields ? "Hide optional info" : "Add contact info (phone, email)"}</span>
                      <svg
                        className={`w-3.5 h-3.5 transition-transform duration-200 ${showOptionalFields ? "rotate-180" : ""}`}
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2.5"
                        viewBox="0 0 24 24"
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
                      </svg>
                    </button>

                    {showOptionalFields && (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-3 animate-fadeIn">
                        <div>
                          <label className="block text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">
                            Phone
                          </label>
                          <input
                            type="tel"
                            value={phone}
                            onChange={(e) => setPhone(e.target.value)}
                            placeholder="+1 (555) 000-0000"
                            className="w-full px-3 py-2 bg-[#111827] border border-slate-700/80 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-cyan-500 text-xs placeholder-slate-700"
                          />
                        </div>
                        <div>
                          <label className="block text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">
                            Email
                          </label>
                          <input
                            type="email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            placeholder="example@email.com"
                            className="w-full px-3 py-2 bg-[#111827] border border-slate-700/80 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-cyan-500 text-xs placeholder-slate-700"
                          />
                        </div>
                      </div>
                    )}
                  </div>

                  <button
                    type="submit"
                    disabled={saving || !name.trim()}
                    className="w-full h-12 flex items-center justify-center bg-cyan-500 hover:bg-cyan-600 text-white rounded-full font-bold transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed shadow-[0_0_15px_rgba(6,182,212,0.15)] mt-4 cursor-pointer"
                  >
                    {saving ? (
                      <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                    ) : (
                      <span className="flex items-center gap-2">
                        Add to Circle
                        <svg className="w-4.5 h-4.5" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                        </svg>
                      </span>
                    )}
                  </button>
                </form>
              </div>
            </div>

            {/* Right Column: Added Contacts Summary list */}
            <div className="flex-1 flex flex-col border-t lg:border-t-0 lg:border-l border-slate-800/80 pt-6 lg:pt-0 lg:pl-6 overflow-hidden">
              <h4 className="text-sm font-bold text-white mb-3 flex items-center justify-between shrink-0">
                <span>Your Circle</span>
                <span className="text-xs px-2.5 py-0.5 rounded-full bg-slate-900 border border-slate-800 text-cyan-400">
                  {contacts.length} added
                </span>
              </h4>

              {contacts.length === 0 ? (
                <div className="flex-1 flex items-center justify-center bg-slate-900/20 border border-dashed border-slate-800 rounded-2xl p-6 text-center animate-fadeIn">
                  <p className="text-xs text-slate-500 max-w-[200px] leading-relaxed">
                    No one added yet. Type a name and click Add to begin.
                  </p>
                </div>
              ) : (
                <div className="flex-1 overflow-y-auto space-y-2 pr-1 custom-scrollbar">
                  {contacts.map((contact) => (
                    <div
                      key={contact.id}
                      className="bg-[#111827]/40 border border-slate-800/80 hover:border-slate-700/80 rounded-2xl p-3 flex justify-between items-center transition-all duration-200 animate-scaleUp"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-full bg-slate-800 flex items-center justify-center font-bold text-cyan-400 border border-cyan-500/10 text-sm">
                          {contact.name.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <h5 className="font-bold text-white text-xs leading-none mb-1">{contact.name}</h5>
                          <span className="text-[10px] text-slate-400 font-medium px-2 py-0.5 bg-slate-900 rounded-full border border-slate-800">
                            {contact.relationship}
                          </span>
                        </div>
                      </div>

                      {/* Circle Red Trash Button */}
                      <button
                        onClick={() => handleDeleteContact(contact.id!)}
                        className="w-10 h-10 flex items-center justify-center text-red-400 hover:text-white border border-red-500/30 rounded-full hover:border-red-500 hover:bg-red-500/10 transition-all duration-200 cursor-pointer"
                        title="Remove Contact"
                      >
                        <svg className="w-4.5 h-4.5" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
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

        {/* STEP 3: SET RHYTHMS / CADENCES */}
        {step === "cadence" && (
          <div className="flex-1 flex flex-col overflow-hidden animate-fadeIn">
            <div className="text-center max-w-md mx-auto mb-6 shrink-0">
              <h3 className="text-lg font-bold text-white mb-1">Set Connection Rhythm</h3>
              <p className="text-xs text-slate-400 leading-normal">
                We've suggested starting frequencies based on relationship type. Adjust any cadence below:
              </p>
            </div>

            <div className="flex-1 overflow-y-auto space-y-3 pr-1 custom-scrollbar">
              {contacts.map((contact) => (
                <div key={contact.id} className="bg-slate-900/30 border border-slate-800/80 rounded-2xl p-4 space-y-3 animate-scaleUp">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-slate-800 flex items-center justify-center font-bold text-cyan-400 border border-cyan-500/10 text-xs">
                      {contact.name.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <h4 className="font-bold text-white text-xs mb-0.5">{contact.name}</h4>
                      <span className="text-[10px] text-slate-400">
                        {contact.relationship}
                      </span>
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-1.5">
                    {[
                      { label: "Weekly", days: 7 },
                      { label: "Bi-weekly", days: 14 },
                      { label: "Monthly", days: 30 },
                      { label: "Quarterly", days: 90 },
                    ].map((preset) => {
                      const isSelected = contact.cadence_days === preset.days;
                      return (
                        <button
                          key={preset.days}
                          type="button"
                          onClick={() => handleUpdateCadence(contact.id!, preset.days)}
                          className={`px-3 py-1.5 text-xs font-semibold rounded-full border transition-all duration-200 cursor-pointer ${
                            isSelected
                              ? "bg-cyan-500 border-cyan-500 text-white shadow-md shadow-cyan-950/20"
                              : "bg-[#111827] border-gray-700/85 text-slate-300 hover:border-slate-600 hover:text-white"
                          }`}
                        >
                          {preset.label}
                        </button>
                      );
                    })}

                    <button
                      type="button"
                      onClick={() => {
                        const currentCad = contact.cadence_days;
                        if ([7, 14, 30, 90].includes(currentCad)) {
                          handleUpdateCadence(contact.id!, 45); // Default custom days set to 45
                        }
                      }}
                      className={`px-3 py-1.5 text-xs font-semibold rounded-full border transition-all duration-200 cursor-pointer ${
                        ![7, 14, 30, 90].includes(contact.cadence_days)
                          ? "bg-cyan-500 border-cyan-500 text-white shadow-md shadow-cyan-950/20"
                          : "bg-[#111827] border-gray-700/85 text-slate-300 hover:border-slate-600 hover:text-white"
                      }`}
                    >
                      Custom
                    </button>
                  </div>

                  {/* Inline custom numerical input */}
                  {![7, 14, 30, 90].includes(contact.cadence_days) && (
                    <div className="flex items-center gap-2 animate-fadeIn pl-1">
                      <span className="text-[10px] text-slate-400 font-medium">Connect every</span>
                      <input
                        type="number"
                        value={contact.cadence_days || ""}
                        onChange={(e) => {
                          const val = e.target.value;
                          if (val !== "") {
                            const num = parseInt(val);
                            if (!isNaN(num) && num > 0) {
                              handleUpdateCadence(contact.id!, num);
                            }
                          } else {
                            handleUpdateCadence(contact.id!, 0);
                          }
                        }}
                        min="1"
                        className="w-16 px-2.5 py-1 bg-[#111827] border border-slate-700 rounded-lg text-white text-xs font-bold text-center focus:outline-none focus:ring-1 focus:ring-cyan-500"
                      />
                      <span className="text-[10px] text-slate-400 font-medium">days</span>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* STEP 4: BIRTHDAYS & TIME ZONES */}
        {step === "details" && (
          <div className="flex-1 flex flex-col overflow-hidden animate-fadeIn">
            <div className="text-center max-w-md mx-auto mb-6 shrink-0">
              <h3 className="text-lg font-bold text-white mb-1">Birthdays & Time Zones</h3>
              <p className="text-xs text-slate-400 leading-normal">
                Add optional details to receive birthday reminders and see what time it is in their city.
              </p>
            </div>

            <div className="flex-1 overflow-y-auto space-y-3 pr-1 custom-scrollbar">
              {contacts.map((contact) => {
                const parsedBday = parseBirthday(contact.birthday);
                return (
                  <div key={contact.id} className="bg-slate-900/30 border border-slate-800/80 rounded-2xl p-4 space-y-4 animate-scaleUp">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-slate-800 flex items-center justify-center font-bold text-cyan-400 border border-cyan-500/10 text-xs">
                        {contact.name.charAt(0).toUpperCase()}
                      </div>
                      <h4 className="font-bold text-white text-xs">{contact.name}</h4>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      {/* Birthday Grid Dropdowns */}
                      <div>
                        <label className="block text-[9px] font-bold text-slate-500 uppercase tracking-wider mb-2">
                          🎂 Birthday (Optional)
                        </label>
                        <div className="grid grid-cols-2 gap-2">
                          <select
                            value={parsedBday.month}
                            onChange={(e) => {
                              const m = e.target.value;
                              const d = parsedBday.day;
                              handleUpdateBirthday(contact.id!, m, m ? d : "");
                            }}
                            className="w-full px-2 py-1.5 bg-[#111827] border border-slate-700/80 rounded-lg text-white text-[11px] focus:outline-none focus:ring-1 focus:ring-cyan-500"
                          >
                            <option value="">Month</option>
                            {MONTHS.map((m) => (
                              <option key={m.value} value={m.value}>{m.label}</option>
                            ))}
                          </select>
                          <select
                            value={parsedBday.day}
                            onChange={(e) => {
                              const d = e.target.value;
                              handleUpdateBirthday(contact.id!, parsedBday.month, d);
                            }}
                            disabled={!parsedBday.month}
                            className="w-full px-2 py-1.5 bg-[#111827] border border-slate-700/80 rounded-lg text-white text-[11px] focus:outline-none focus:ring-1 focus:ring-cyan-500 disabled:opacity-40"
                          >
                            <option value="">Day</option>
                            {parsedBday.month && getDaysInMonth(parsedBday.month).map((d) => (
                              <option key={d} value={String(d).padStart(2, '0')}>{d}</option>
                            ))}
                          </select>
                        </div>
                      </div>

                      {/* City/Country Fields */}
                      <div>
                        <label className="block text-[9px] font-bold text-slate-500 uppercase tracking-wider mb-2">
                          📍 Location (Optional)
                        </label>
                        <div className="grid grid-cols-2 gap-2">
                          <input
                            type="text"
                            value={contact.city || ""}
                            onChange={(e) => handleUpdateDetails(contact.id!, { city: e.target.value.trim() || undefined })}
                            placeholder="City"
                            className="w-full px-3 py-1.5 bg-[#111827] border border-slate-700/80 rounded-lg text-white text-[11px] focus:outline-none focus:ring-1 focus:ring-cyan-500 placeholder-slate-700"
                          />
                          <input
                            type="text"
                            value={contact.country || ""}
                            onChange={(e) => handleUpdateDetails(contact.id!, { country: e.target.value.trim() || undefined })}
                            placeholder="Country"
                            className="w-full px-3 py-1.5 bg-[#111827] border border-slate-700/80 rounded-lg text-white text-[11px] focus:outline-none focus:ring-1 focus:ring-cyan-500 placeholder-slate-700"
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* STEP 5: CELEBRATION SCREEN */}
        {step === "celebrate" && (
          <div className="flex flex-col items-center justify-center text-center py-6 max-w-md mx-auto my-auto animate-scaleUp">
            <div className="text-5xl mb-6 animate-bounce">🎉</div>
            <h3 className="text-2xl font-black text-white mb-2">Setup Complete!</h3>
            <p className="text-slate-400 text-xs max-w-sm mx-auto mb-6 leading-relaxed">
              You have established <strong>{contacts.length} circle connections</strong>. We will keep track of your cadences and tell you exactly when to stay in touch.
            </p>

            {/* Quick mini-bubbles showing circle list */}
            <div className="flex flex-wrap items-center justify-center gap-2 mb-8 max-w-sm mx-auto">
              {contacts.map((c) => (
                <div
                  key={c.id}
                  className="px-3 py-1 bg-slate-900 border border-slate-800 rounded-full text-[10px] font-bold text-slate-300 flex items-center gap-1.5"
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-ping" />
                  {c.name}
                </div>
              ))}
            </div>

            <button
              onClick={handleFinish}
              className="px-8 py-4 bg-gradient-to-r from-cyan-500 to-indigo-500 hover:from-cyan-600 hover:to-indigo-600 text-white rounded-full font-bold shadow-[0_4px_25px_rgba(6,182,212,0.3)] hover:shadow-[0_4px_30px_rgba(6,182,212,0.45)] transition-all duration-300 flex items-center gap-2 group cursor-pointer"
            >
              Enter Dashboard
              <svg className="w-5 h-5 group-hover:translate-x-1 transition-transform" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
              </svg>
            </button>
          </div>
        )}

        {/* Tactile Navigation Footer Buttons */}
        {step !== "welcome" && step !== "celebrate" && (
          <div className="mt-6 pt-5 border-t border-slate-800/80 flex justify-between items-center shrink-0">
            {/* Tactile Circular Back Button */}
            <button
              onClick={handlePrevStep}
              className="w-12 h-12 flex items-center justify-center text-gray-400 hover:text-white border border-slate-700/80 rounded-full hover:border-slate-600 hover:bg-[#111827] transition-all duration-200 cursor-pointer"
              title="Back"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
              </svg>
            </button>

            {/* Tactile Circular Next Button */}
            <button
              onClick={handleNextStep}
              disabled={step === "contacts" && contacts.length === 0}
              className="w-12 h-12 flex items-center justify-center text-cyan-400 hover:text-white border border-cyan-500/40 rounded-full hover:border-cyan-500 hover:bg-cyan-500/10 transition-all duration-200 disabled:opacity-45 disabled:cursor-not-allowed cursor-pointer"
              title={step === "details" ? "Finish" : "Next"}
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
              </svg>
            </button>
          </div>
        )}
      </main>
    </div>
  );
}
