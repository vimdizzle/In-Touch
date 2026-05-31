"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { useRouter } from "next/navigation";
import type { User } from "@supabase/supabase-js";
import { 
  formatBirthdayForDB, 
  parseBirthday, 
  Contact
} from "@/lib/utils";

type OnboardingStep = "welcome" | "setup" | "done";


export default function OnboardingPage() {
  const [user, setUser] = useState<User | null>(null);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const router = useRouter();

  // 3-Step Wizard state
  const [step, setStep] = useState<OnboardingStep>("welcome");

  // Unified Form state matching Add Contact form in app/page.tsx exactly
  const [name, setName] = useState("");
  const [relationship, setRelationship] = useState("Friend");
  const [cadenceDays, setCadenceDays] = useState(30);
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [city, setCity] = useState("");
  const [country, setCountry] = useState("");
  const [birthdayMonth, setBirthdayMonth] = useState("");
  const [birthdayDay, setBirthdayDay] = useState("");
  const [lastTouchpointDate, setLastTouchpointDate] = useState("");
  const [notes, setNotes] = useState("");
  const [editingContactId, setEditingContactId] = useState<string | null>(null);
  const [showUnsavedModal, setShowUnsavedModal] = useState(false);

  // 1. Initial auth check & session setup
  useEffect(() => {
    let isMounted = true;
    const isOAuthCallback = typeof window !== "undefined" && (
      window.location.hash.includes("access_token") || 
      window.location.search.includes("code=")
    );

    // Fail-safe timeout to prevent perpetual loading screen
    const fallbackTimer = setTimeout(() => {
      if (isMounted && loading) {
        console.warn("Onboarding auth check timed out. Transitioning out of loading state.");
        router.push("/auth");
        setLoading(false);
      }
    }, 6000);

    // Check session
    supabase.auth.getSession()
      .then(({ data: { session } }) => {
        if (!isMounted) return;
        if (session) {
          clearTimeout(fallbackTimer);
          setUser(session.user);
        } else if (!isOAuthCallback) {
          clearTimeout(fallbackTimer);
          router.push("/auth");
          setLoading(false);
        }
      })
      .catch((err) => {
        console.error("Error checking session in onboarding:", err);
        if (isMounted) {
          clearTimeout(fallbackTimer);
          router.push("/auth");
          setLoading(false);
        }
      });

    // Listen for auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!isMounted) return;
      if (session) {
        clearTimeout(fallbackTimer);
        setUser(session.user);
      } else if (_event === "SIGNED_OUT") {
        clearTimeout(fallbackTimer);
        setUser(null);
        setContacts([]);
        router.push("/auth");
        setLoading(false);
      }
    });

    return () => {
      isMounted = false;
      clearTimeout(fallbackTimer);
      subscription.unsubscribe();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router]);

  // 2. Fetch contacts and ensure user profile once user state is set
  useEffect(() => {
    if (!user) return;

    let isMounted = true;
    
    const fetchOnboardingData = async () => {
      try {
        // Ensure user has a profile in public.users (especially for Google OAuth)
        const { data: profile, error: profileErr } = await supabase
          .from("users")
          .select("id")
          .eq("id", user.id)
          .maybeSingle();

        if (!profileErr && !profile) {
          console.log("Auto-creating onboarding user profile:", user.email);
          await supabase
            .from("users")
            .insert([{ 
              id: user.id, 
              email: user.email || null,
              name: user.user_metadata?.full_name || user.user_metadata?.name || null
            }]);
        }

        // Fetch existing contacts
        const { data, error } = await supabase
          .from("contacts")
          .select("*")
          .eq("user_id", user.id)
          .order("created_at", { ascending: false });
        
        if (!error && data && isMounted) {
          setContacts(data);
        }
      } catch (err) {
        console.error("Error loading onboarding data in useEffect:", err);
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    fetchOnboardingData();

    return () => {
      isMounted = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  // Safety redirection hook
  useEffect(() => {
    if (!loading && !user) {
      console.warn("No user found on onboarding after loading completed. Redirecting to /auth.");
      router.push("/auth");
    }
  }, [loading, user, router]);







  const handleStartEditContact = (contact: Contact) => {
    setError("");
    setEditingContactId(contact.id || null);
    setName(contact.name);
    setRelationship(contact.relationship || "Friend");
    setCadenceDays(contact.cadence_days || 30);
    setPhone(contact.phone || "");
    setEmail(contact.email || "");
    setCity(contact.city || "");
    setCountry(contact.country || "");
    
    if (contact.birthday) {
      const parsed = parseBirthday(contact.birthday);
      setBirthdayMonth(parsed.month);
      setBirthdayDay(parsed.day);
    } else {
      setBirthdayMonth("");
      setBirthdayDay("");
    }
    
    setLastTouchpointDate("");
    setNotes(contact.notes || "");

    // Smoothly scroll window to the top of the screen to focus on form fields
    if (typeof window !== "undefined") {
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  };

  const handleCancelEdit = () => {
    setEditingContactId(null);
    handleClearForm();
  };

  const handleAddContact = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !user) return;

    setSaving(true);
    setError("");
    try {
      const birthdayForDB = formatBirthdayForDB(birthdayMonth, birthdayDay);
      
      if (editingContactId) {
        // Update existing contact
        const { data, error } = await supabase
          .from("contacts")
          .update({
            name: name.trim(),
            relationship: relationship,
            cadence_days: cadenceDays,
            city: city.trim() || null,
            country: country.trim() || null,
            birthday: birthdayForDB,
            phone: phone.trim() || null,
            email: email.trim() || null,
            notes: notes.trim() || null,
          })
          .eq("id", editingContactId)
          .select()
          .single();

        if (error) throw error;

        // Update contact list state locally
        setContacts(contacts.map((c) => c.id === editingContactId ? data : c));
        setEditingContactId(null);
      } else {
        // Create new contact
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

        // If last touchpoint date is provided, create a touchpoint
        if (lastTouchpointDate) {
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
          }
        }

        // Stage contact instantly to list
        setContacts([data, ...contacts]);
      }
      
      const savedName = name.trim();
      const isEdit = !!editingContactId;
      
      // Reset Setup Form completely
      setName("");
      setRelationship("Friend");
      setCadenceDays(30);
      setPhone("");
      setEmail("");
      setCity("");
      setCountry("");
      setBirthdayMonth("");
      setBirthdayDay("");
      setLastTouchpointDate("");
      setNotes("");
      setError("");

      // Set temporary confirmation message and pull user to top
      setSuccessMessage(isEdit ? `Changes to "${savedName}" saved successfully!` : `"${savedName}" successfully added to your contacts!`);
      window.scrollTo({ top: 0, behavior: 'smooth' });
      
      setTimeout(() => {
        setSuccessMessage("");
      }, 4000);
    } catch (err: any) {
      setError(err.message || "Failed to save contact");
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

  const handleFinishAttempt = () => {
    if (name.trim()) {
      setShowUnsavedModal(true);
    } else {
      setStep("done");
    }
  };

  const handleClearForm = () => {
    setName("");
    setRelationship("Friend");
    setCadenceDays(30);
    setPhone("");
    setEmail("");
    setCity("");
    setCountry("");
    setBirthdayMonth("");
    setBirthdayDay("");
    setLastTouchpointDate("");
    setNotes("");
  };

  // Display up to 5 contacts in the onboarding list
  const displayedContacts = contacts.slice(0, 5);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#020617] flex items-center justify-center">
        <div className="text-white flex flex-col items-center gap-3">
          <svg className="animate-spin h-8 w-8 text-cyan-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
          <span className="text-sm font-semibold tracking-wide text-gray-400">Loading...</span>
        </div>
      </div>
    );
  }

  return (
    <div className={`min-h-screen bg-[#020617] text-white flex flex-col justify-start ${step === "setup" ? "overflow-y-auto" : "sm:justify-center overflow-hidden"} items-center pt-14 pb-6 sm:py-6 px-4 relative select-none`}>
      {/* Low-opacity subtle glowing backdrops */}
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-cyan-500/5 rounded-full blur-3xl -z-10" />
      <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-indigo-500/5 rounded-full blur-3xl -z-10" />

      {step === "setup" ? (
        /* STEP 2: SPACIOUS SETUP WITH GRID FLUID SINGLE PAGE SCROLLING */
        <div className="w-full max-w-2xl space-y-8 py-6 flex flex-col min-h-[500px] animate-fadeIn">
          {/* Form Section - Matches Add Contact fields exactly */}
          <div className="bg-[#0b1120]/45 border border-gray-800/80 backdrop-blur-md rounded-3xl p-6 sm:p-10 shadow-2xl space-y-6">
            <div>
              <h3 className="text-2xl font-extrabold text-white tracking-tight mb-2">Add your first 5 contacts</h3>
              <p className="text-xs text-slate-400">
                You can add more contacts later.
              </p>
            </div>

            <form onSubmit={handleAddContact} className="space-y-4">
              {successMessage && (
                 <div className="p-3 bg-emerald-950/45 border border-emerald-800 text-emerald-400 rounded-md text-xs animate-fadeIn flex justify-between items-center shadow-lg shadow-emerald-950/20">
                   <span>{successMessage}</span>
                   <button
                     type="button"
                     onClick={() => setSuccessMessage("")}
                     className="text-emerald-400 hover:text-emerald-200 font-bold text-sm leading-none"
                   >
                     ×
                   </button>
                 </div>
               )}

              {error && (
                <div className="p-3 bg-red-900/20 border border-red-800 text-red-400 rounded-md text-xs animate-fadeIn">
                  {error}
                </div>
              )}

              {/* Name Input - Required (*) */}
              <div>
                <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
                  Name *
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                  placeholder="John Doe"
                  className="w-full px-4 py-2 bg-[#111827] border border-gray-700 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-cyan-500 text-sm"
                />
              </div>



              {/* Form Actions */}
              <div className="flex justify-end gap-3 pt-4 border-t border-gray-800/80 shrink-0">
                <button
                  type="button"
                  onClick={editingContactId ? handleCancelEdit : handleClearForm}
                  className="w-12 h-12 flex items-center justify-center text-gray-400 hover:text-white border border-gray-700 rounded-full hover:border-gray-600 hover:bg-[#111827] transition-all duration-200 cursor-pointer"
                  title={editingContactId ? "Cancel Edit" : "Clear Form"}
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>

                <button
                  type="submit"
                  disabled={saving || !name.trim()}
                  className="w-12 h-12 flex items-center justify-center text-cyan-400 hover:text-white border border-cyan-500/50 rounded-full hover:border-cyan-500 hover:bg-cyan-500/10 transition-all duration-200 disabled:opacity-50 cursor-pointer"
                  title={editingContactId ? "Save Changes" : "Add Contact"}
                >
                  {saving ? (
                    <svg className="animate-spin h-5 w-5 text-cyan-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                  ) : editingContactId ? (
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                    </svg>
                  ) : (
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                    </svg>
                  )}
                </button>
              </div>
            </form>
          </div>

          {/* Section 2: Added Contacts List */}
          {contacts.length > 0 && (
            <div className="bg-[#0b1120]/45 border border-gray-800/80 backdrop-blur-md rounded-3xl p-6 sm:p-10 shadow-2xl space-y-6 animate-fadeIn">
              <div className="flex items-center justify-between">
                <h4 className="text-xl font-bold text-white flex items-center gap-2">
                  <span>Added Contacts</span>
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-900 border border-slate-800 text-cyan-400 font-semibold">
                    {contacts.length} total
                  </span>
                </h4>
              </div>

              {/* List items container - strictly bounded to show max of 5 */}
              {displayedContacts.length === 0 ? (
                <div className="bg-slate-900/10 border border-dashed border-slate-800/80 rounded-2xl p-6 text-center animate-fadeIn">
                  <p className="text-[10px] text-slate-500 max-w-[150px] leading-relaxed mx-auto">
                    No contacts added yet.
                  </p>
                </div>
              ) : (
                <div className="space-y-3 max-h-[300px] overflow-y-auto pr-2 custom-scrollbar">
                  {displayedContacts.map((contact) => (
                    <div
                      key={contact.id}
                      className="bg-[#111827]/40 border border-slate-800/80 hover:border-slate-700/80 rounded-2xl p-3.5 flex justify-between items-center transition-all duration-200 animate-scaleUp"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-9 h-9 rounded-full bg-slate-800 flex items-center justify-center font-bold text-cyan-400 border border-cyan-500/10 text-xs shrink-0 font-sans">
                          {contact.name.charAt(0).toUpperCase()}
                        </div>
                        <div className="min-w-0">
                          <h5 className="font-bold text-white text-[11px] leading-none mb-1.5 truncate">{contact.name}</h5>
                          <div className="flex gap-1.5">
                            <span className="text-[9px] text-slate-400 font-semibold px-2 py-0.5 bg-slate-900 rounded border border-slate-800 leading-none">
                              {contact.relationship}
                            </span>
                            <span className="text-[9px] text-cyan-400 font-semibold px-2 py-0.5 bg-slate-900 rounded border border-slate-800 leading-none">
                              {contact.cadence_days}d
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Edit and Remove Icons aligned on the right */}
                      <div className="flex items-center gap-1.5 shrink-0 ml-4">
                        <button
                          onClick={() => handleStartEditContact(contact)}
                          className="w-8 h-8 flex items-center justify-center text-slate-400 hover:text-cyan-400 border border-slate-800 hover:border-cyan-500/20 rounded-full hover:bg-cyan-500/5 transition-all duration-200 cursor-pointer"
                          title="Edit Contact"
                        >
                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L6.832 19.82a4.5 4.5 0 01-1.897 1.13l-2.685.8.8-2.685a4.5 4.5 0 011.13-1.897L16.863 4.487zm0 0L19.5 7.125" />
                          </svg>
                        </button>

                        <button
                          onClick={() => handleDeleteContact(contact.id!)}
                          className="w-8 h-8 flex items-center justify-center text-slate-500 hover:text-red-400 border border-slate-800 hover:border-red-500/20 rounded-full hover:bg-red-500/5 transition-all duration-200 cursor-pointer"
                          title="Remove Contact"
                        >
                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
                          </svg>
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Section 3: Wizard Navigation Footer */}
          <div className="bg-[#0b1120]/45 border border-gray-800/80 backdrop-blur-md rounded-3xl p-5 flex justify-between items-center shadow-2xl shrink-0 animate-fadeIn">
            {/* Back Button */}
            <button
              onClick={() => setStep("welcome")}
              className="w-12 h-12 flex items-center justify-center text-gray-400 hover:text-white border border-gray-700 rounded-full hover:border-gray-650 hover:bg-[#111827] transition-all duration-200 cursor-pointer"
              title="Back to Intro"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
              </svg>
            </button>

            {/* Finish Button */}
            <button
              onClick={handleFinishAttempt}
              disabled={contacts.length === 0}
              className="px-6 py-3 bg-gradient-to-r from-cyan-500 to-indigo-500 hover:from-cyan-600 hover:to-indigo-600 text-white rounded-xl font-bold text-xs shadow-md shadow-cyan-950/20 transition-all duration-200 disabled:opacity-45 disabled:cursor-not-allowed cursor-pointer"
            >
              Finish Adding Contacts
            </button>
          </div>
        </div>
      ) : (
        /* Welcome and Done screens are shown in the elegant centered card modal */
        <main className="w-full max-w-2xl bg-[#0b1120]/45 border border-gray-800/80 backdrop-blur-md rounded-3xl p-4 sm:p-10 shadow-2xl flex flex-col justify-between min-h-[500px] my-auto">
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
              <h2 className="text-2xl font-bold text-white mb-3">
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

          {/* STEP 3: SIMPLE DONE SCREEN */}
          {step === "done" && (
            <div className="flex flex-col items-center justify-center text-center py-10 max-w-sm mx-auto my-auto animate-scaleUp">
              <div className="w-14 h-14 rounded-full bg-cyan-950 border border-cyan-500/40 flex items-center justify-center text-cyan-400 text-2xl mb-6 shadow-[0_0_20px_rgba(6,182,212,0.1)] shrink-0">
                ✓
              </div>
              <h3 className="text-xl font-bold text-white mb-2">Setup Complete!</h3>
              <p className="text-slate-400 text-xs leading-relaxed mb-8">
                You have successfully added <strong className="text-white font-bold">{contacts.length} contact{contacts.length !== 1 ? 's' : ''}</strong>! Time to stay in touch.
              </p>

              <button
                onClick={handleFinish}
                className="px-8 py-3.5 bg-gradient-to-r from-cyan-500 to-indigo-500 hover:from-cyan-600 hover:to-indigo-600 text-white rounded-full font-bold shadow-[0_4px_20px_rgba(6,182,212,0.2)] transition-all duration-200 cursor-pointer text-sm"
              >
                Enter Dashboard
              </button>
            </div>
          )}
        </main>
      )}

      {/* SMART INTERCEPT UNSAVED MODAL */}
      {showUnsavedModal && (
        <div
          className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 z-50 animate-fadeIn"
          onClick={() => setShowUnsavedModal(false)}
        >
          <div
            className="bg-[#0b1120] border border-gray-800 rounded-3xl max-w-md w-full overflow-hidden animate-scaleUp shadow-2xl p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-xl font-bold text-white mb-2">Unsaved Contact Details</h3>
            <p className="text-xs text-gray-400 mb-6 leading-relaxed">
              You are currently editing details for <span className="text-white font-semibold">{name || "this contact"}</span>. Would you like to add them to your contacts first before completing your setup?
            </p>
            <div className="flex flex-col sm:flex-row gap-3 justify-end">
              <button
                onClick={() => setShowUnsavedModal(false)}
                className="px-4 py-2 border border-gray-700 hover:border-gray-650 hover:bg-[#111827] text-gray-400 hover:text-white rounded-xl text-xs font-bold transition-all duration-200 cursor-pointer"
              >
                Keep Editing
              </button>
              <button
                onClick={() => {
                  // Discard & Finish
                  setName("");
                  setShowUnsavedModal(false);
                  setStep("done");
                }}
                className="px-4 py-2 border border-red-500/30 hover:border-red-500 hover:bg-red-500/5 text-red-400 hover:text-white rounded-xl text-xs font-bold transition-all duration-200 cursor-pointer"
              >
                Discard & Finish
              </button>
              <button
                onClick={async () => {
                  // Save & Finish
                  const fakeEvent = { preventDefault: () => {} } as React.FormEvent;
                  await handleAddContact(fakeEvent);
                  setShowUnsavedModal(false);
                  setStep("done");
                }}
                className="px-4 py-2 bg-gradient-to-r from-cyan-500 to-indigo-500 hover:from-cyan-600 hover:to-indigo-600 text-white rounded-xl font-bold text-xs shadow-md transition-all duration-200 cursor-pointer"
              >
                Save & Finish
              </button>
            </div>
          </div>
        </div>
      )}


    </div>
  );
}
