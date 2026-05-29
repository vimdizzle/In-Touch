"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { useRouter } from "next/navigation";
import type { User } from "@supabase/supabase-js";
import { 
  formatBirthdayForDB, 
  parseBirthday, 
  parseVCard,
  RELATIONSHIPS,
  MONTHS,
  getDaysInMonth,
  Contact,
  ImportingContactDraft
} from "@/lib/utils";
import VCardImportReviewModal from "@/app/components/VCardImportReviewModal";

type OnboardingStep = "welcome" | "setup" | "done";

const SANDBOX_GOOGLE_CONTACTS: ImportingContactDraft[] = [
  {
    name: "Grace Hopper",
    relationship: "Mentor",
    cadence_days: 7,
    phone: "+1 (555) 1947-0909",
    email: "grace.hopper@navy.mil",
    city: "Arlington",
    country: "United States",
    notes: "Amazing computer scientist. Remind me to ask about compiler design, COBOL, and the first computer bug.",
    selected: true,
  },
  {
    name: "Alan Turing",
    relationship: "Mentor",
    cadence_days: 30,
    phone: "+44 7700 900077",
    email: "alan.turing@bletchley.org.uk",
    city: "London",
    country: "United Kingdom",
    notes: "Enigma codebreaker. Check in about computational theory, Turing machines, and artificial intelligence.",
    selected: true,
  },
  {
    name: "Ada Lovelace",
    relationship: "Friend",
    cadence_days: 90,
    phone: "+44 20 7946 0958",
    email: "ada@analyticalengine.com",
    city: "London",
    country: "United Kingdom",
    notes: "First programmer in history. Talk about Bernoulli numbers, mechanical computing, and music generation algorithms.",
    selected: true,
  },
  {
    name: "Linus Torvalds",
    relationship: "Coworker",
    cadence_days: 30,
    phone: "+1 (555) 987-6543",
    email: "torvalds@linuxfoundation.org",
    city: "Portland",
    country: "United States",
    notes: "Creator of Linux and Git. Ask about the kernel development status and git submodules.",
    selected: true,
  },
  {
    name: "Katherine Johnson",
    relationship: "Mentor",
    cadence_days: 7,
    phone: "+1 (555) 1962-0220",
    email: "katherine.johnson@nasa.gov",
    city: "Hampton",
    country: "United States",
    notes: "NASA mathematician. Incredible orbital mechanics work. Remind me to congratulate her on Friendship 7 calculations!",
    selected: true,
  }
];

export default function OnboardingPage() {
  const [user, setUser] = useState<User | null>(null);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const router = useRouter();

  // 3-Step Wizard state
  const [step, setStep] = useState<OnboardingStep>("welcome");

  // Onboarding Sidebar Search State
  const [searchQuery, setSearchQuery] = useState("");

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

  // Automated Importing states

  const [importingContacts, setImportingContacts] = useState<ImportingContactDraft[]>([]);
  const [isReviewModalOpen, setIsReviewModalOpen] = useState(false);
  const [isGuideModalOpen, setIsGuideModalOpen] = useState(false);
  const [guideTab, setGuideTab] = useState<"google" | "android" | "ios">("google");
  const [importStatus, setImportStatus] = useState<{ type: "success" | "error" | "warning"; message: string } | null>(null);

  // Google Importing portal states
  const [importingFromGoogle, setImportingFromGoogle] = useState(false);
  const [isGooglePortalOpen, setIsGooglePortalOpen] = useState(false);
  const [googleLoadStep, setGoogleLoadStep] = useState<"idle" | "connecting" | "decide" | "loading_sandbox" | "loading_live">("idle");
  const [googleLoadStatusText, setGoogleLoadStatusText] = useState("");

  const handleGoogleContactsImport = async () => {
    setImportingFromGoogle(true);
    setError("");
    setImportStatus(null);
    setGoogleLoadStep("idle");

    try {
      const { data: { session } } = await supabase.auth.getSession();
      const providerToken = session?.provider_token;

      if (providerToken) {
        setGoogleLoadStep("loading_live");
        setIsGooglePortalOpen(true);
        setGoogleLoadStatusText("Connecting to Google Account...");
        
        await new Promise(resolve => setTimeout(resolve, 800));
        setGoogleLoadStatusText("Requesting Contacts permissions...");
        
        await new Promise(resolve => setTimeout(resolve, 800));
        setGoogleLoadStatusText("Fetching Google Connections...");

        try {
          const response = await fetch(
            "https://people.googleapis.com/v1/people/me/connections?personFields=names,emailAddresses,phoneNumbers,birthdays,addresses,biographies&pageSize=100",
            {
              headers: {
                Authorization: `Bearer ${providerToken}`,
              },
            }
          );

          if (!response.ok) {
            throw new Error(`Google API responded with status ${response.status}`);
          }

          const data = await response.json();
          const connections = data.connections || [];
          
          if (connections.length === 0) {
            setImportStatus({
              type: "warning",
              message: "No contacts found in your Google account.",
            });
            setIsGooglePortalOpen(false);
            setGoogleLoadStep("idle");
            return;
          }

          const mappedContacts: ImportingContactDraft[] = connections.map((conn: any) => {
            const name = conn.names?.[0]?.displayName || "Unnamed Contact";
            const phone = conn.phoneNumbers?.[0]?.value || "";
            const email = conn.emailAddresses?.[0]?.value || "";
            const birthdayObj = conn.birthdays?.[0]?.date;
            let birthday = "";
            if (birthdayObj && birthdayObj.month && birthdayObj.day) {
              birthday = `${String(birthdayObj.month).padStart(2, '0')}-${String(birthdayObj.day).padStart(2, '0')}`;
            }
            const addressObj = conn.addresses?.[0];
            const city = addressObj?.locality || "";
            const country = addressObj?.country || "";
            const notes = conn.biographies?.[0]?.value || "";

            return {
              name,
              phone,
              email,
              city,
              country,
              birthday,
              notes,
              relationship: "Friend",
              cadence_days: 30,
              selected: true,
            };
          });

          setImportingContacts(mappedContacts);
          setIsGooglePortalOpen(false);
          setIsReviewModalOpen(true);
        } catch (apiErr: any) {
          console.error("Failed to fetch live Google Contacts:", apiErr);
          setGoogleLoadStep("decide");
        }
      } else {
        setGoogleLoadStep("decide");
        setIsGooglePortalOpen(true);
      }
    } catch (err: any) {
      console.error("Auth session check error:", err);
      setGoogleLoadStep("decide");
      setIsGooglePortalOpen(true);
    } finally {
      setImportingFromGoogle(false);
    }
  };

  const handleConnectSandbox = async () => {
    setGoogleLoadStep("loading_sandbox");
    setGoogleLoadStatusText("Initializing Sandbox environment...");
    await new Promise(resolve => setTimeout(resolve, 600));
    setGoogleLoadStatusText("Decrypting secure contacts payload...");
    await new Promise(resolve => setTimeout(resolve, 600));
    setGoogleLoadStatusText("Staging sandbox relationships...");
    await new Promise(resolve => setTimeout(resolve, 600));
    
    setImportingContacts(SANDBOX_GOOGLE_CONTACTS);
    setIsGooglePortalOpen(false);
    setGoogleLoadStep("idle");
    setIsReviewModalOpen(true);
  };

  const handleLinkGoogleAccount = async () => {
    setGoogleLoadStep("connecting");
    setGoogleLoadStatusText("Redirecting to Google OAuth...");
    try {
      const { error: googleError } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          scopes: "https://www.googleapis.com/auth/contacts.readonly",
          redirectTo: `${window.location.origin}/auth/callback`,
        },
      });
      if (googleError) throw googleError;
    } catch (err: any) {
      setError(err.message || "Failed to link Google account.");
      console.error("Link Google Error:", err);
      setGoogleLoadStep("idle");
      setIsGooglePortalOpen(false);
    }
  };


  useEffect(() => {
    // If we are currently handling an OAuth redirect hash (containing access_token),
    // let Supabase's client-side listener handle it and do NOT immediately redirect to /auth!
    const isOAuthCallback = typeof window !== "undefined" && (
      window.location.hash.includes("access_token") || 
      window.location.search.includes("code=")
    );

    // Fail-safe timeout: if auth check or database load takes too long, redirect to auth to prevent getting stuck
    const fallbackTimer = setTimeout(() => {
      if (loading) {
        console.warn("Onboarding auth check timed out. Safely redirecting to /auth.");
        router.push("/auth");
        setLoading(false);
      }
    }, 10000);

    supabase.auth.getSession()
      .then(async ({ data: { session } }) => {
        if (session) {
          clearTimeout(fallbackTimer);
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
        } else if (!isOAuthCallback) {
          clearTimeout(fallbackTimer);
          router.push("/auth");
          setLoading(false);
        }
      })
      .catch((err) => {
        console.error("Error getting session on onboarding page:", err);
        clearTimeout(fallbackTimer);
        router.push("/auth");
        setLoading(false);
      });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (_event, session) => {
      if (session) {
        clearTimeout(fallbackTimer);
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
      } else if (!isOAuthCallback) {
        clearTimeout(fallbackTimer);
        router.push("/auth");
        setLoading(false);
      }
    });

    return () => {
      clearTimeout(fallbackTimer);
      subscription.unsubscribe();
    };
  }, [router]);



  // vCard (.vcf) File Parser
  const handleVcfUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setError("");
    setImportStatus(null);

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const text = event.target?.result as string;
        const parsed = parseVCard(text);
        
        if (parsed.length === 0) {
          setImportStatus({
            type: "warning",
            message: "No valid contacts found in the .vcf file.",
          });
          return;
        }

        const drafts = parsed.map((c) => ({
          ...c,
          selected: true,
        }));

        setImportingContacts(drafts);
        setIsReviewModalOpen(true);
      } catch (err: any) {
        console.error("vCard parsing error:", err);
        setImportStatus({
          type: "error",
          message: "Failed to parse .vcf file. Make sure it is in valid vCard format.",
        });
      }
    };
    reader.readAsText(file);
    // Clear input so same file can be uploaded again
    e.target.value = "";
  };



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

  // Filter contacts by search
  const filteredContacts = contacts.filter((c) => {
    if (!searchQuery.trim()) return true;
    const query = searchQuery.toLowerCase().trim();
    return (
      c.name.toLowerCase().includes(query) ||
      c.relationship.toLowerCase().includes(query) ||
      c.city?.toLowerCase().includes(query) ||
      c.country?.toLowerCase().includes(query)
    );
  });

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
    <div className="min-h-screen bg-[#020617] text-white flex flex-col justify-start sm:justify-center items-center pt-14 pb-6 sm:py-6 px-4 relative overflow-hidden select-none">
      {/* Low-opacity subtle glowing backdrops */}
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-cyan-500/5 rounded-full blur-3xl -z-10" />
      <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-indigo-500/5 rounded-full blur-3xl -z-10" />

      {/* Main unified onboarding container */}
      <main className="w-full max-w-2xl bg-[#0b1120]/45 border border-gray-800/80 backdrop-blur-md rounded-3xl p-4 sm:p-10 shadow-2xl flex flex-col justify-between min-h-[500px] max-h-[92vh]">
        
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

        {/* STEP 2: SPACIOUS VERTICAL SETUP */}
        {step === "setup" && (
          <div className="flex-1 flex flex-col overflow-hidden animate-fadeIn justify-between">
            {/* Scrollable Single Column Wrapper with Safe Padding to prevent cut-offs */}
            <div className="flex-1 overflow-y-auto px-4 pr-3 custom-scrollbar max-h-[62vh] space-y-8">
              
              {/* Form Section - Matches Add Contact fields exactly */}
              <div>
                <h3 className="text-xl font-bold text-white mb-0.5">Onboard Contacts</h3>
                <p className="text-[11px] text-slate-400 mb-5">
                  Add the people in your circle. Form fields match the Add Contact dashboard modal exactly.
                </p>

                {/* Automate Import Action Bar */}
                <div className="bg-[#111827]/40 border border-slate-800/80 rounded-2xl p-4 mb-6 space-y-3">
                  <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                    <div>
                      <h4 className="text-xs font-semibold text-gray-300 uppercase tracking-wider">Automate Import</h4>
                      <p className="text-[10px] text-slate-400 mt-0.5">Import from your device contacts or upload a .vcf file.</p>
                    </div>
                    <div className="flex items-center gap-2 w-full sm:w-auto">

                      {/* Google import button */}
                      <button
                        type="button"
                        onClick={handleGoogleContactsImport}
                        disabled={importingFromGoogle}
                        className="flex-1 sm:flex-initial flex items-center justify-center gap-1.5 px-3 py-2 bg-cyan-500/10 hover:bg-cyan-500/20 border border-cyan-500/30 hover:border-cyan-500 text-cyan-400 hover:text-white rounded-lg text-xs font-bold cursor-pointer transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed shrink-0"
                      >
                        {importingFromGoogle ? (
                          <svg className="animate-spin h-3.5 w-3.5 text-cyan-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                          </svg>
                        ) : (
                          <svg className="w-3.5 h-3.5" viewBox="0 0 24 24">
                            <path
                              fill="currentColor"
                              d="M12.24 10.285V14.4h6.887c-.648 2.41-2.519 4.114-5.136 4.114A5.99 5.99 0 0 1 8 12.5a5.99 5.99 0 0 1 5.99-6.013c1.558 0 2.973.57 4.077 1.512l3.078-3.078A10.15 10.15 0 0 0 13.99 2 10.19 10.19 0 0 0 3.8 12.19a10.19 10.19 0 0 0 10.19 10.19c5.69 0 10.14-4 10.14-10.19 0-.616-.057-1.21-.16-1.785H12.24Z"
                            />
                          </svg>
                        )}
                        Import from Google
                      </button>

                      <label className="flex-1 sm:flex-initial flex items-center justify-center gap-1.5 px-3 py-2 bg-indigo-500/10 hover:bg-indigo-500/20 border border-indigo-500/30 hover:border-indigo-500 text-indigo-400 hover:text-white rounded-lg text-xs font-bold cursor-pointer transition-all duration-200">
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
                        </svg>
                        Upload .vcf
                        <input
                          type="file"
                          accept=".vcf"
                          onChange={handleVcfUpload}
                          className="hidden"
                        />
                      </label>

                      <button
                        type="button"
                        onClick={() => setIsGuideModalOpen(true)}
                        className="flex items-center justify-center p-2 bg-[#111827] border border-gray-700 hover:border-gray-500 text-gray-400 hover:text-white rounded-lg transition-all duration-200 cursor-pointer"
                        title="VCF Export Instructions Guide"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M9.879 7.519c1.171-1.025 3.071-1.025 4.242 0 1.172 1.025 1.172 2.687 0 3.712-.203.179-.43.326-.67.442-.745.361-1.45.999-1.45 1.827v.75M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9 5.25h.008v.008H12v-.008z" />
                        </svg>
                      </button>
                    </div>
                  </div>

                  {importStatus && (
                    <div className={`p-2.5 rounded-lg text-[10px] font-semibold flex justify-between items-center animate-fadeIn ${
                      importStatus.type === "success"
                        ? "bg-emerald-950/30 border border-emerald-800/80 text-emerald-400"
                        : importStatus.type === "error"
                        ? "bg-red-950/30 border border-red-800/80 text-red-400"
                        : "bg-amber-950/30 border border-amber-800/80 text-amber-400"
                    }`}>
                      <span>{importStatus.message}</span>
                      <button
                        type="button"
                        onClick={() => setImportStatus(null)}
                        className="text-gray-400 hover:text-white font-bold text-xs"
                      >
                        ×
                      </button>
                    </div>
                  )}
                </div>


                <form onSubmit={handleAddContact} className="space-y-4">
                  {error && (
                    <div className="p-3 bg-red-900/20 border border-red-800 text-red-400 rounded-md text-xs">
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

                  {/* Relationship selector */}
                  <div>
                    <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
                      Relationship
                    </label>
                    <select
                      value={relationship}
                      onChange={(e) => setRelationship(e.target.value)}
                      className="w-full px-4 py-2 bg-[#111827] border border-gray-700 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-cyan-500 text-sm"
                    >
                      {RELATIONSHIPS.map((rel) => (
                        <option key={rel} value={rel}>
                          {rel}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Phone & Email Row */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
                        Phone
                      </label>
                      <input
                        type="tel"
                        value={phone}
                        onChange={(e) => setPhone(e.target.value)}
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
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        className="w-full px-4 py-2 bg-[#111827] border border-gray-700 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-cyan-500 text-sm"
                        placeholder="example@email.com"
                      />
                    </div>
                  </div>

                  {/* Cadence Selector - Custom button hidden unless selected */}
                  <div>
                    <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
                      Cadence
                    </label>
                    <div className="flex flex-wrap gap-2 mb-2">
                      {[
                        { label: "Weekly", days: 7 },
                        { label: "Monthly", days: 30 },
                        { label: "Quarterly", days: 90 },
                        { label: "Yearly", days: 365 },
                      ].map((preset) => (
                        <button
                          key={preset.days}
                          type="button"
                          onClick={() => setCadenceDays(preset.days)}
                          className={`px-3 py-1 text-xs rounded-md border transition-colors cursor-pointer ${
                            cadenceDays === preset.days
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
                          if ([7, 30, 90, 365].includes(cadenceDays)) {
                            setCadenceDays(45); // Set custom default to 45
                          }
                        }}
                        className={`px-3 py-1 text-xs rounded-md border transition-colors cursor-pointer ${
                          ![7, 30, 90, 365].includes(cadenceDays)
                            ? "bg-cyan-500 border-cyan-500 text-white"
                            : "bg-[#111827] border-gray-700 text-gray-300 hover:border-gray-600"
                        }`}
                      >
                        Custom
                      </button>
                    </div>
                    
                    {/* Custom days input field - ONLY shown when Custom is selected */}
                    {![7, 30, 90, 365].includes(cadenceDays) && (
                      <div className="flex items-center gap-2 animate-fadeIn mt-2">
                        <input
                          type="number"
                          value={cadenceDays}
                          onChange={(e) => {
                            const val = e.target.value;
                            if (val === "") setCadenceDays(0);
                            else {
                              const num = parseInt(val);
                              if (!isNaN(num) && num > 0) setCadenceDays(num);
                            }
                          }}
                          min="1"
                          className="w-24 px-4 py-2 bg-[#111827] border border-gray-700 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-cyan-500 text-sm"
                        />
                        <span className="text-gray-400 text-sm">days</span>
                      </div>
                    )}
                  </div>

                  {/* City & Country Location Row */}
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
                        City
                      </label>
                      <input
                        type="text"
                        value={city}
                        onChange={(e) => setCity(e.target.value)}
                        placeholder="San Jose"
                        className="w-full px-4 py-2 bg-[#111827] border border-gray-700 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-cyan-500 text-sm"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
                        Country
                      </label>
                      <input
                        type="text"
                        value={country}
                        onChange={(e) => setCountry(e.target.value)}
                        placeholder="United States"
                        className="w-full px-4 py-2 bg-[#111827] border border-gray-700 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-cyan-500 text-sm"
                      />
                    </div>
                  </div>

                  {/* Birthday & Last Contact Date Row */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
                        Birthday
                      </label>
                      <div className="grid grid-cols-2 gap-2">
                        <select
                          value={birthdayMonth}
                          onChange={(e) => {
                            setBirthdayMonth(e.target.value);
                            if (e.target.value) {
                              const days = getDaysInMonth(e.target.value);
                              if (birthdayDay && parseInt(birthdayDay) > days.length) {
                                setBirthdayDay("");
                              }
                            } else {
                              setBirthdayDay("");
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
                          value={birthdayDay}
                          onChange={(e) => setBirthdayDay(e.target.value)}
                          disabled={!birthdayMonth}
                          className="w-full px-3 py-2 bg-[#111827] border border-gray-700 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-cyan-500 text-sm disabled:opacity-50"
                        >
                          <option value="">Day</option>
                          {birthdayMonth && getDaysInMonth(birthdayMonth).map((d) => (
                            <option key={d} value={String(d).padStart(2, '0')}>{d}</option>
                          ))}
                        </select>
                      </div>
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
                        Last Contact Date
                      </label>
                      <input
                        type="date"
                        value={lastTouchpointDate}
                        onChange={(e) => setLastTouchpointDate(e.target.value)}
                        className="block w-full min-w-full px-4 py-2 bg-[#111827] border border-gray-700 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-cyan-500 text-sm appearance-none"
                      />
                    </div>
                  </div>

                  {/* Notes Field */}
                  <div>
                    <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
                      Notes
                    </label>
                    <textarea
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      rows={2}
                      placeholder="Notes..."
                      className="w-full px-4 py-2 bg-[#111827] border border-gray-700 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-cyan-500 text-sm"
                    />
                  </div>

                  {/* Form Actions - Circular Icon buttons aligned to bottom-right */}
                  <div className="flex justify-end gap-3 pt-2">
                    {/* Clear/Cancel Button */}
                    {(name || relationship !== "Friend" || cadenceDays !== 30 || phone || email || city || country || birthdayMonth || lastTouchpointDate || notes) && (
                      <button
                        type="button"
                        onClick={handleClearForm}
                        className="w-12 h-12 flex items-center justify-center text-gray-400 hover:text-white border border-gray-700 rounded-full hover:border-gray-600 hover:bg-[#111827] transition-all duration-200 cursor-pointer"
                        title="Clear Form"
                      >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    )}

                    {/* Circular Add to Circle plus-icon button */}
                    <button
                      type="submit"
                      disabled={saving || !name.trim()}
                      className="w-12 h-12 flex items-center justify-center text-cyan-400 hover:text-white border border-cyan-500/50 rounded-full hover:border-cyan-500 hover:bg-cyan-500/10 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed shadow-[0_0_15px_rgba(6,182,212,0.1)] cursor-pointer shrink-0"
                      title="Add to Circle"
                    >
                      {saving ? (
                        <svg className="animate-spin h-5 w-5 text-cyan-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
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

              {/* Added Contacts List Section - Shown directly under the form */}
              {contacts.length > 0 && (
                <div className="pt-6 border-t border-slate-800/80 space-y-4">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xl font-bold text-white flex items-center gap-2">
                      <span>Added Contacts</span>
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-900 border border-slate-800 text-cyan-400 font-semibold">
                        {contacts.length} total
                      </span>
                    </h4>
                  </div>

                  {/* Sidebar Search Bar matching the look and feel from the Home page search bar */}
                  <div className="relative">
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="Search contacts..."
                      className="w-full px-4 py-2 bg-[#111827] border border-gray-700 rounded-md text-white text-xs focus:outline-none focus:ring-2 focus:ring-cyan-500 placeholder-gray-500"
                    />
                    {searchQuery.trim() && (
                      <button
                        onClick={() => setSearchQuery("")}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white cursor-pointer"
                        title="Clear search"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    )}
                  </div>

                  {/* List items grid */}
                  {filteredContacts.length === 0 ? (
                    <div className="bg-slate-900/10 border border-dashed border-slate-800/80 rounded-2xl p-6 text-center animate-fadeIn min-h-[80px]">
                      <p className="text-[10px] text-slate-500 max-w-[150px] leading-relaxed mx-auto">
                        No matching contacts found.
                      </p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pb-4">
                      {filteredContacts.map((contact) => (
                        <div
                          key={contact.id}
                          className="bg-[#111827]/40 border border-slate-800/80 hover:border-slate-700/80 rounded-2xl p-3 flex justify-between items-center transition-all duration-200 animate-scaleUp"
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            <div className="w-9 h-9 rounded-full bg-slate-800 flex items-center justify-center font-bold text-cyan-400 border border-cyan-500/10 text-xs shrink-0">
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

                          {/* Tidy circular trash button */}
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

        {/* Wizard Navigation Footer - Circular Icon buttons to match main dashboard styles */}
        {step === "setup" && (
          <div className="mt-6 pt-5 border-t border-slate-800/80 flex justify-between items-center shrink-0">
            {/* Back Button - Left Arrow Circular icon */}
            <button
              onClick={() => setStep("welcome")}
              className="w-12 h-12 flex items-center justify-center text-gray-400 hover:text-white border border-gray-700 rounded-full hover:border-gray-600 hover:bg-[#111827] transition-all duration-200 cursor-pointer"
              title="Back to Intro"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
              </svg>
            </button>

            {/* Finish Button - Green checkmark circular icon */}
            <button
              onClick={() => setStep("done")}
              disabled={contacts.length === 0}
              className="w-12 h-12 flex items-center justify-center text-cyan-400 hover:text-white border border-cyan-500/40 rounded-full hover:border-cyan-500 hover:bg-cyan-500/10 transition-all duration-200 disabled:opacity-45 disabled:cursor-not-allowed cursor-pointer"
              title="Finish Setup"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
              </svg>
            </button>
          </div>
        )}
      </main>

      {/* EXPORT INSTRUCTIONS GUIDE MODAL */}
      {isGuideModalOpen && (
        <div
          className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 z-50 animate-fadeIn"
          onClick={() => setIsGuideModalOpen(false)}
        >
          <div
            className="bg-[#0b1120] border border-gray-800 rounded-3xl max-w-lg w-full overflow-hidden animate-scaleUp shadow-2xl flex flex-col max-h-[85vh]"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="px-6 py-5 border-b border-gray-800/80 flex justify-between items-center shrink-0">
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <svg className="w-5 h-5 text-indigo-400" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 016 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 016-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0018 18a8.967 8.967 0 00-6 2.292m0-14.25v14.25" />
                </svg>
                Export Contacts Guide
              </h3>
              <button
                onClick={() => setIsGuideModalOpen(false)}
                className="w-8 h-8 flex items-center justify-center text-gray-400 hover:text-white border border-gray-800 rounded-full hover:bg-[#111827] cursor-pointer"
                title="Close Guide"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Tabs */}
            <div className="flex p-3 bg-[#0d1527] border-b border-gray-850/60 shrink-0">
              <div className="flex bg-[#111827] p-1 rounded-xl w-full">
                <button
                  onClick={() => setGuideTab("google")}
                  className={`flex-1 py-2 text-center text-xs font-bold rounded-lg transition-all cursor-pointer ${
                    guideTab === "google"
                      ? "bg-gradient-to-r from-cyan-500 to-indigo-500 text-white shadow-md"
                      : "text-gray-400 hover:text-white"
                  }`}
                >
                  Google
                </button>
                <button
                  onClick={() => setGuideTab("android")}
                  className={`flex-1 py-2 text-center text-xs font-bold rounded-lg transition-all cursor-pointer ${
                    guideTab === "android"
                      ? "bg-gradient-to-r from-cyan-500 to-indigo-500 text-white shadow-md"
                      : "text-gray-400 hover:text-white"
                  }`}
                >
                  Android
                </button>
                <button
                  onClick={() => setGuideTab("ios")}
                  className={`flex-1 py-2 text-center text-xs font-bold rounded-lg transition-all cursor-pointer ${
                    guideTab === "ios"
                      ? "bg-gradient-to-r from-cyan-500 to-indigo-500 text-white shadow-md"
                      : "text-gray-400 hover:text-white"
                  }`}
                >
                  iPhone (iOS)
                </button>
              </div>
            </div>

            {/* Tab Content */}
            <div className="flex-1 overflow-y-auto p-6 space-y-4">
              {guideTab === "google" && (
                <div className="space-y-4 animate-fadeIn">
                  <p className="text-xs text-gray-400 leading-relaxed">
                    Follow these simple steps to export your Google Contacts as a <strong>.vcf (vCard)</strong> file on your computer or mobile browser:
                  </p>
                  <ol className="space-y-3.5 text-xs text-gray-300">
                    <li className="flex gap-3">
                      <span className="w-5 h-5 rounded-full bg-cyan-500/10 border border-cyan-500/30 text-cyan-400 flex items-center justify-center font-bold text-[10px] shrink-0 font-sans">1</span>
                      <span>Navigate to <a href="https://contacts.google.com" target="_blank" rel="noreferrer" className="text-cyan-400 hover:underline font-semibold">Google Contacts</a>.</span>
                    </li>
                    <li className="flex gap-3">
                      <span className="w-5 h-5 rounded-full bg-cyan-500/10 border border-cyan-500/30 text-cyan-400 flex items-center justify-center font-bold text-[10px] shrink-0 font-sans">2</span>
                      <span>Hover over the contacts you want to export and select them via their checkboxes, or to select all, click the checkbox at the top-left menu.</span>
                    </li>
                    <li className="flex gap-3">
                      <span className="w-5 h-5 rounded-full bg-cyan-500/10 border border-cyan-500/30 text-cyan-400 flex items-center justify-center font-bold text-[10px] shrink-0 font-sans">3</span>
                      <span>Click the <strong className="text-white">Export</strong> button in the left sidebar or the top options action bar.</span>
                    </li>
                    <li className="flex gap-3">
                      <span className="w-5 h-5 rounded-full bg-cyan-500/10 border border-cyan-500/30 text-cyan-400 flex items-center justify-center font-bold text-[10px] shrink-0 font-sans">4</span>
                      <span>In the pop-up, choose the <strong className="text-white">vCard (for iOS Contacts)</strong> format. Do NOT choose Google CSV.</span>
                    </li>
                    <li className="flex gap-3">
                      <span className="w-5 h-5 rounded-full bg-cyan-500/10 border border-cyan-500/30 text-cyan-400 flex items-center justify-center font-bold text-[10px] shrink-0 font-sans">5</span>
                      <span>Click <strong className="text-white">Export</strong> and save the file to upload it here.</span>
                    </li>
                  </ol>
                </div>
              )}

              {guideTab === "android" && (
                <div className="space-y-4 animate-fadeIn">
                  <p className="text-xs text-gray-400 leading-relaxed">
                    Follow these steps to export contacts from your Android device directly as a <strong>.vcf</strong> file:
                  </p>
                  <ol className="space-y-3.5 text-xs text-gray-300">
                    <li className="flex gap-3">
                      <span className="w-5 h-5 rounded-full bg-indigo-500/10 border border-indigo-500/30 text-indigo-400 flex items-center justify-center font-bold text-[10px] shrink-0 font-sans">1</span>
                      <span>Open the default <strong className="text-white">Contacts</strong> app on your Android device.</span>
                    </li>
                    <li className="flex gap-3">
                      <span className="w-5 h-5 rounded-full bg-indigo-500/10 border border-indigo-500/30 text-indigo-400 flex items-center justify-center font-bold text-[10px] shrink-0 font-sans">2</span>
                      <span>Tap on the <strong className="text-white">Fix & manage</strong> or <strong className="text-white">Organize / Settings</strong> tab at the bottom or top menu.</span>
                    </li>
                    <li className="flex gap-3">
                      <span className="w-5 h-5 rounded-full bg-indigo-500/10 border border-indigo-500/30 text-indigo-400 flex items-center justify-center font-bold text-[10px] shrink-0 font-sans">3</span>
                      <span>Select the <strong className="text-white">Export to file</strong> option.</span>
                    </li>
                    <li className="flex gap-3">
                      <span className="w-5 h-5 rounded-full bg-indigo-500/10 border border-indigo-500/30 text-indigo-400 flex items-center justify-center font-bold text-[10px] shrink-0 font-sans">4</span>
                      <span>Choose the account(s) you wish to export, tap <strong className="text-white">Export to .vcf</strong>, and select a folder to save it.</span>
                    </li>
                    <li className="flex gap-3">
                      <span className="w-5 h-5 rounded-full bg-indigo-500/10 border border-indigo-500/30 text-indigo-400 flex items-center justify-center font-bold text-[10px] shrink-0 font-sans">5</span>
                      <span>Transfer that `.vcf` file to your computer or upload it directly from your phone's browser.</span>
                    </li>
                  </ol>
                </div>
              )}

              {guideTab === "ios" && (
                <div className="space-y-4 animate-fadeIn">
                  <p className="text-xs text-gray-400 leading-relaxed">
                    Follow these steps on your iPhone or iCloud to export your Apple Contacts as a <strong>vCard (.vcf)</strong> file:
                  </p>
                  <ol className="space-y-3.5 text-xs text-gray-300">
                    <li className="flex gap-3">
                      <span className="w-5 h-5 rounded-full bg-cyan-500/10 border border-cyan-500/30 text-cyan-400 flex items-center justify-center font-bold text-[10px] shrink-0 font-sans">1</span>
                      <span>Open the native <strong className="text-white">Contacts</strong> app on your iPhone.</span>
                    </li>
                    <li className="flex gap-3">
                      <span className="w-5 h-5 rounded-full bg-cyan-500/10 border border-cyan-500/30 text-cyan-400 flex items-center justify-center font-bold text-[10px] shrink-0 font-sans">2</span>
                      <span>Tap <strong className="text-white">Lists</strong> in the top-left corner.</span>
                    </li>
                    <li className="flex gap-3">
                      <span className="w-5 h-5 rounded-full bg-cyan-500/10 border border-cyan-500/30 text-cyan-400 flex items-center justify-center font-bold text-[10px] shrink-0 font-sans">3</span>
                      <span>Press and hold on <strong className="text-white">All Contacts</strong> (or any list you'd like to import) until the context menu pops up.</span>
                    </li>
                    <li className="flex gap-3">
                      <span className="w-5 h-5 rounded-full bg-cyan-500/10 border border-cyan-500/30 text-cyan-400 flex items-center justify-center font-bold text-[10px] shrink-0 font-sans">4</span>
                      <span>Tap <strong className="text-white">Export</strong>, and choose <strong className="text-white">Save to Files</strong> (or email/AirDrop it to your desktop).</span>
                    </li>
                    <li className="flex gap-3">
                      <span className="w-5 h-5 rounded-full bg-cyan-500/10 border border-cyan-500/30 text-cyan-400 flex items-center justify-center font-bold text-[10px] shrink-0 font-sans">5</span>
                      <span>Select the file when uploading on this page.</span>
                    </li>
                  </ol>
                  <div className="pt-2 border-t border-gray-800 text-[10px] text-gray-400">
                    💡 <strong>Alternate iCloud web method</strong>: Log in to <a href="https://icloud.com" target="_blank" rel="noreferrer" className="text-cyan-400 hover:underline">iCloud.com</a>, open Contacts, click the gear settings icon on the bottom left, and choose <strong>Export vCard...</strong>.
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* GOOGLE PORTAL DIALOG */}
      {isGooglePortalOpen && (
        <div
          className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 z-50 animate-fadeIn"
          onClick={() => {
            if (googleLoadStep === "idle" || googleLoadStep === "decide") {
              setIsGooglePortalOpen(false);
              setGoogleLoadStep("idle");
            }
          }}
        >
          <div
            className="bg-[#0b1120] border border-gray-800 rounded-3xl max-w-md w-full overflow-hidden animate-scaleUp shadow-2xl p-6 sm:p-8 flex flex-col items-center text-center relative"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Close button */}
            {(googleLoadStep === "idle" || googleLoadStep === "decide") && (
              <button
                onClick={() => {
                  setIsGooglePortalOpen(false);
                  setGoogleLoadStep("idle");
                }}
                className="absolute top-4 right-4 w-8 h-8 flex items-center justify-center text-slate-400 hover:text-white border border-slate-800 rounded-full hover:bg-[#111827] cursor-pointer"
                title="Close"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            )}

            {/* Step 1: Animated loading states for sandbox or live API */}
            {(googleLoadStep === "loading_sandbox" || googleLoadStep === "loading_live" || googleLoadStep === "connecting") ? (
              <div className="py-10 flex flex-col items-center justify-center space-y-4 animate-fadeIn">
                <svg className="animate-spin h-10 w-10 text-cyan-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                <div className="space-y-1.5">
                  <h4 className="text-sm font-bold text-white uppercase tracking-wider">Syncing with Google</h4>
                  <p className="text-xs text-cyan-400 font-semibold animate-pulse">{googleLoadStatusText}</p>
                </div>
              </div>
            ) : (
              /* Step 2: The Portal Decision interface */
              <div className="space-y-6 w-full animate-fadeIn">
                <div className="w-14 h-14 mx-auto rounded-full bg-cyan-950/50 border border-cyan-500/20 flex items-center justify-center text-cyan-400 mb-2 shadow-[0_0_20px_rgba(6,182,212,0.05)]">
                  <svg className="w-6 h-6" viewBox="0 0 24 24">
                    <path
                      fill="currentColor"
                      d="M12.24 10.285V14.4h6.887c-.648 2.41-2.519 4.114-5.136 4.114A5.99 5.99 0 0 1 8 12.5a5.99 5.99 0 0 1 5.99-6.013c1.558 0 2.973.57 4.077 1.512l3.078-3.078A10.15 10.15 0 0 0 13.99 2 10.19 10.19 0 0 0 3.8 12.19a10.19 10.19 0 0 0 10.19 10.19c5.69 0 10.14-4 10.14-10.19 0-.616-.057-1.21-.16-1.785H12.24Z"
                    />
                  </svg>
                </div>

                <div className="space-y-1">
                  <h3 className="text-lg font-bold text-white">Google Contacts Connector</h3>
                  <p className="text-xs text-slate-400 max-w-xs mx-auto leading-relaxed">
                    Choose how you would like to import your contacts into your circle.
                  </p>
                </div>

                {/* Main options panel */}
                <div className="space-y-3.5 pt-2">
                  {/* Option A: Sandbox (Instant demo) */}
                  <button
                    type="button"
                    onClick={handleConnectSandbox}
                    className="w-full text-left p-4 bg-[#111827]/40 hover:bg-[#111827]/80 border border-cyan-500/20 hover:border-cyan-500 rounded-2xl transition-all duration-200 group flex items-start gap-3.5 cursor-pointer shadow-[0_0_15px_rgba(6,182,212,0.02)]"
                  >
                    <div className="w-8 h-8 rounded-full bg-cyan-500/10 text-cyan-400 flex items-center justify-center font-bold text-xs shrink-0 group-hover:bg-cyan-500 group-hover:text-white transition-all duration-200">
                      ⚡
                    </div>
                    <div className="space-y-0.5 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <h4 className="text-xs font-bold text-white">Connect Sandbox (Instant)</h4>
                        <span className="text-[9px] bg-cyan-500/10 text-cyan-400 font-bold px-1.5 py-0.5 rounded uppercase leading-none">Demo</span>
                      </div>
                      <p className="text-[10px] text-slate-400 leading-normal">
                        Instantly load 5 famous developers (Ada Lovelace, Grace Hopper, etc.) to explore. No setup required!
                      </p>
                    </div>
                  </button>

                  {/* Option B: Real Live Connect */}
                  <button
                    type="button"
                    onClick={handleLinkGoogleAccount}
                    className="w-full text-left p-4 bg-[#111827]/40 hover:bg-[#111827]/80 border border-gray-800 hover:border-indigo-500/50 rounded-2xl transition-all duration-200 group flex items-start gap-3.5 cursor-pointer"
                  >
                    <div className="w-8 h-8 rounded-full bg-indigo-500/10 text-indigo-400 flex items-center justify-center font-bold text-xs shrink-0 group-hover:bg-indigo-500 group-hover:text-white transition-all duration-200">
                      🔗
                    </div>
                    <div className="space-y-0.5 min-w-0">
                      <h4 className="text-xs font-bold text-white">Link Live Google Account</h4>
                      <p className="text-[10px] text-slate-400 leading-normal">
                        Authorize this app to read your actual Google Connections via secure Google OAuth.
                      </p>
                    </div>
                  </button>
                </div>

                <div className="pt-2 text-[10px] text-slate-500 text-center leading-normal">
                  💡 Note: Real Google syncing requires you to have configured OAuth client IDs inside your Supabase dashboard settings.
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* IMPORT REVIEW AND CUSTOMIZATION MODAL */}
      <VCardImportReviewModal
        isOpen={isReviewModalOpen}
        onClose={() => setIsReviewModalOpen(false)}
        importingContacts={importingContacts}
        userId={user?.id || ""}
        onImportSuccess={(imported) => {
          setContacts((prev) => [...imported, ...prev]);
          setImportStatus({
            type: "success",
            message: `Successfully imported ${imported.length} contact${imported.length !== 1 ? "s" : ""}!`,
          });
          setIsReviewModalOpen(false);
        }}
        onImportError={(errorMsg) => {
          setError(errorMsg);
        }}
      />
    </div>
  );
}
