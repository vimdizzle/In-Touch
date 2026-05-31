"use client";

import { useEffect, useState, useMemo, useCallback, useRef, Suspense } from "react";
import { supabase } from "@/lib/supabase";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import type { User } from "@supabase/supabase-js";
import { 
  getLocalTime, 
  Contact, 
  Touchpoint, 
  ImportingContactDraft 
} from "@/lib/utils";

// Extracted Subcomponents
import AddContactModal from "@/app/components/AddContactModal";
import SettingsModal from "@/app/components/SettingsModal";
import LogTouchpointModal from "@/app/components/LogTouchpointModal";
import ConfigurePhoneModal from "@/app/components/ConfigurePhoneModal";
import ImportGuideModal from "@/app/components/ImportGuideModal";
import ProfileDrawer from "@/app/components/ProfileDrawer";
import VCardImportReviewModal from "@/app/components/VCardImportReviewModal";

function HomeContent() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [comingUpSort, setComingUpSort] = useState<"next_touch" | "name">("next_touch");
  const [onTrackSort, setOnTrackSort] = useState<"next_touch" | "name">("next_touch");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [phoneConfigureContact, setPhoneConfigureContact] = useState<Contact | null>(null);
  
  const router = useRouter();
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const hasOpenedInSession = useRef(false);
  const addContactHasOpenedInSession = useRef(false);

  // Sync expandedId state with URL contact query param
  useEffect(() => {
    const contactParam = searchParams.get("contact");
    setExpandedId(contactParam);
  }, [searchParams]);

  // Sync isAddContactOpen state with URL add query param
  useEffect(() => {
    const addParam = searchParams.get("add");
    setIsAddContactOpen(addParam === "true");
  }, [searchParams]);

  // Navigate when selecting or deselecting a contact
  const handleSelectContact = (id: string | null) => {
    if (id) {
      hasOpenedInSession.current = true;
      const params = new URLSearchParams(searchParams.toString());
      params.set("contact", id);
      router.push(`${pathname}?${params.toString()}`, { scroll: false });
    } else {
      if (hasOpenedInSession.current) {
        router.back();
      } else {
        const params = new URLSearchParams(searchParams.toString());
        params.delete("contact");
        router.replace(`${pathname}?${params.toString()}`, { scroll: false });
        setExpandedId(null);
      }
    }
  };

  // Navigate when opening or closing the Add Contact modal
  const handleToggleAddContact = (open: boolean) => {
    if (open) {
      addContactHasOpenedInSession.current = true;
      const params = new URLSearchParams(searchParams.toString());
      params.set("add", "true");
      router.push(`${pathname}?${params.toString()}`, { scroll: false });
    } else {
      if (addContactHasOpenedInSession.current) {
        router.back();
      } else {
        const params = new URLSearchParams(searchParams.toString());
        params.delete("add");
        router.replace(`${pathname}?${params.toString()}`, { scroll: false });
        setIsAddContactOpen(false);
      }
    }
  };

  // Modal and drawer trigger states
  const [isAddContactOpen, setIsAddContactOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isImportGuideOpen, setIsImportGuideOpen] = useState(false);
  const [logTouchpointContactId, setLogTouchpointContactId] = useState<string | null>(null);

  // Timezones cache mapping "city|country|location" -> timezone
  const [timezoneMap, setTimezoneMap] = useState<Record<string, string | null>>({});

  // Load cached timezones on mount to avoid hydration mismatch
  useEffect(() => {
    if (typeof window !== "undefined") {
      const cached = localStorage.getItem("in-touch-timezones");
      if (cached) {
        try {
          setTimezoneMap(JSON.parse(cached));
        } catch (err) {
          console.error("Failed to parse cached timezones:", err);
        }
      }
    }
  }, []);

  // Importing states
  const [importingContacts, setImportingContacts] = useState<ImportingContactDraft[]>([]);
  const [isImportReviewOpen, setIsImportReviewOpen] = useState(false);
  const [importStatus, setImportStatus] = useState<{ type: "success" | "error" | "warning"; message: string } | null>(null);

  const handleCallAction = (contact: Contact) => {
    if (!contact.phone) {
      setPhoneConfigureContact(contact);
    } else {
      window.location.href = `tel:${contact.phone}`;
    }
  };

  const handleTextAction = (contact: Contact) => {
    if (!contact.phone) {
      setPhoneConfigureContact(contact);
    } else {
      window.location.href = `sms:${contact.phone}`;
    }
  };

  // Re-render clocks every 30 seconds
  const [timeTick, setTimeTick] = useState(0);
  useEffect(() => {
    const timer = setInterval(() => {
      setTimeTick((tick) => tick + 1);
    }, 30000);
    return () => clearInterval(timer);
  }, []);

  // 1. Authenticate session & OAuth listeners
  useEffect(() => {
    let isMounted = true;
    const isOAuthCallback = typeof window !== "undefined" && (
      window.location.hash.includes("access_token") || 
      window.location.search.includes("code=")
    );

    const fallbackTimer = setTimeout(() => {
      if (isMounted && loading) {
        console.warn("Auth check timed out. Transitioning out of loading state.");
        if (isOAuthCallback) {
          window.history.replaceState({}, "", window.location.pathname);
        }
        setLoading(false);
      }
    }, 6000);

    supabase.auth.getSession()
      .then(({ data: { session } }) => {
        if (!isMounted) return;
        if (session) {
          clearTimeout(fallbackTimer);
          if (isOAuthCallback) {
            window.history.replaceState({}, "", window.location.pathname);
          }
          setUser(session.user);
        } else if (!isOAuthCallback) {
          clearTimeout(fallbackTimer);
          router.push("/auth");
          setLoading(false);
        }
      })
      .catch((err) => {
        console.error("Error checking session:", err);
        if (isMounted) {
          clearTimeout(fallbackTimer);
          router.push("/auth");
          setLoading(false);
        }
      });

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
    
    const fetchUserData = async () => {
      try {
        // Ensure user profile exists in public.users (critical for Google OAuth)
        const { data: profile, error: profileErr } = await supabase
          .from("users")
          .select("id")
          .eq("id", user.id)
          .maybeSingle();

        if (!profileErr && !profile) {
          console.log("Auto-creating homepage user profile:", user.email);
          await supabase
            .from("users")
            .insert([{ 
              id: user.id, 
              email: user.email || null,
              name: user.user_metadata?.full_name || user.user_metadata?.name || null
            }]);
        }

        await loadContacts(user.id);
      } catch (err) {
        console.error("Error fetching user data in useEffect:", err);
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    fetchUserData();

    return () => {
      isMounted = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  // Safety redirection hook
  useEffect(() => {
    if (!loading && !user) {
      router.push("/auth");
    }
  }, [loading, user, router]);

  const loadContacts = async (userId: string) => {
    try {
      // 1. Fetch contacts
      const { data: contactsData, error: contactsError } = await supabase
        .from("contacts")
        .select("*")
        .eq("user_id", userId)
        .order("name", { ascending: true });

      if (contactsError) throw contactsError;
      if (!contactsData || contactsData.length === 0) {
        setContacts([]);
        return;
      }

      // 2. Fetch touchpoints
      const contactIds = contactsData.map(c => c.id);
      const { data: allTouchpoints, error: touchpointsError } = await supabase
        .from("touchpoints")
        .select("id, contact_id, contact_date, channel, note")
        .in("contact_id", contactIds)
        .order("contact_date", { ascending: false });

      if (touchpointsError) throw touchpointsError;

      // Group touchpoints
      const lastTouchpointMap = new Map<string, { contact_date: string; channel: string }>();
      const touchpointsMap = new Map<string, Touchpoint[]>();
      if (allTouchpoints) {
        allTouchpoints.forEach(tp => {
          if (!lastTouchpointMap.has(tp.contact_id)) {
            lastTouchpointMap.set(tp.contact_id, {
              contact_date: tp.contact_date,
              channel: tp.channel
            });
          }
          if (!touchpointsMap.has(tp.contact_id)) {
            touchpointsMap.set(tp.contact_id, []);
          }
          touchpointsMap.get(tp.contact_id)?.push(tp);
        });
      }

      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const isBirthdayWithin7Days = (birthday: string | null | undefined): boolean => {
        if (!birthday) return false;
        try {
          const birthdayDate = new Date(birthday);
          const currentYear = today.getFullYear();
          const birthdayMonth = birthdayDate.getMonth();
          const birthdayDay = birthdayDate.getDate();
          
          let nextBirthday = new Date(currentYear, birthdayMonth, birthdayDay);
          if (nextBirthday < today) {
            nextBirthday = new Date(currentYear + 1, birthdayMonth, birthdayDay);
          }
          
          const daysUntilBirthday = Math.floor(
            (nextBirthday.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)
          );
          return daysUntilBirthday >= 0 && daysUntilBirthday <= 7;
        } catch {
          return false;
        }
      };

      // Process status checks
      const contactsWithStatus = contactsData.map((contact) => {
        const lastTouchpoint = lastTouchpointMap.get(contact.id);
        const contactTouchpoints = touchpointsMap.get(contact.id) || [];
        
        let daysSinceLastContact: number | undefined;
        let status: "overdue" | "coming_up" | "on_track" = "on_track";
        let daysUntilDue: number | undefined;
        let daysOverdue: number | undefined;

        if (lastTouchpoint) {
          const lastDate = new Date(lastTouchpoint.contact_date);
          lastDate.setHours(0, 0, 0, 0);
          daysSinceLastContact = Math.floor(
            (today.getTime() - lastDate.getTime()) / (1000 * 60 * 60 * 24)
          );

          const daysUntilNextDue = contact.cadence_days - daysSinceLastContact;
          if (daysUntilNextDue < 0) {
            status = "overdue";
            daysOverdue = Math.abs(daysUntilNextDue);
          } else if (daysUntilNextDue <= 7) {
            status = "coming_up";
            daysUntilDue = daysUntilNextDue;
          } else {
            status = "on_track";
            daysUntilDue = daysUntilNextDue;
          }
        } else {
          const createdDate = new Date(contact.created_at);
          createdDate.setHours(0, 0, 0, 0);
          daysSinceLastContact = Math.floor(
            (today.getTime() - createdDate.getTime()) / (1000 * 60 * 60 * 24)
          );

          const daysUntilNextDue = contact.cadence_days - daysSinceLastContact;
          if (daysUntilNextDue < 0) {
            status = "overdue";
            daysOverdue = Math.abs(daysUntilNextDue);
          } else if (daysUntilNextDue <= 7) {
            status = "coming_up";
            daysUntilDue = daysUntilNextDue;
          } else {
            status = "on_track";
            daysUntilDue = daysUntilNextDue;
          }
        }

        if (contact.is_pinned) {
          status = "coming_up";
        }
        if (isBirthdayWithin7Days(contact.birthday) && status === "on_track" && !contact.is_pinned) {
          status = "coming_up";
        }

        return {
          ...contact,
          last_contact_date: lastTouchpoint?.contact_date,
          last_contact_channel: lastTouchpoint?.channel,
          days_since_last_contact: daysSinceLastContact,
          status,
          days_until_due: daysUntilDue,
          days_overdue: daysOverdue,
          is_pinned: contact.is_pinned === true,
          touchpoints: contactTouchpoints,
        };
      });

      setContacts(contactsWithStatus);

      // 3. Batch resolve timezones asynchronously in the background
      const uniqueLocations = Array.from(
        new Set(
          contactsData.map(c => `${c.city || ''}|${c.country || ''}|${c.location || ''}`)
        )
      ).filter(Boolean);

      if (uniqueLocations.length > 0) {
        let cachedMap: Record<string, string | null> = {};
        if (typeof window !== "undefined") {
          const cached = localStorage.getItem("in-touch-timezones");
          if (cached) {
            try {
              cachedMap = JSON.parse(cached);
            } catch {
              cachedMap = {};
            }
          }
        }

        const unresolvedLocations = uniqueLocations.filter(loc => !cachedMap[loc]);

        if (unresolvedLocations.length > 0) {
          fetch("/api/timezones", {
            method: "POST",
            headers: {
              "Content-Type": "application/json"
            },
            body: JSON.stringify({ locations: unresolvedLocations })
          })
            .then(async (res) => {
              if (res.ok) {
                const tzMap = await res.json();
                setTimezoneMap(prev => {
                  const newMap = { ...prev, ...tzMap };
                  if (typeof window !== "undefined") {
                    localStorage.setItem("in-touch-timezones", JSON.stringify(newMap));
                  }
                  return newMap;
                });
              }
            })
            .catch((err) => {
              console.error("Failed to batch resolve timezones in background:", err);
            });
        }
      }
    } catch (error) {
      console.error("Error loading contacts:", error);
    }
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    router.push("/auth");
  };

  const updateContactStatusForPin = (contact: Contact, isPinned: boolean): Contact => {
    let status: "overdue" | "coming_up" | "on_track" = contact.status;
    if (isPinned) {
      status = "coming_up";
    } else {
      if (contact.days_until_due !== undefined) {
        if (contact.days_until_due < 0) {
          status = "overdue";
        } else if (contact.days_until_due <= 7) {
          status = "coming_up";
        } else {
          status = "on_track";
        }
      }
      
      if (status === "on_track" && contact.birthday) {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        try {
          const birthdayDate = new Date(contact.birthday);
          const currentYear = today.getFullYear();
          const birthdayMonth = birthdayDate.getMonth();
          const birthdayDay = birthdayDate.getDate();
          let nextBirthday = new Date(currentYear, birthdayMonth, birthdayDay);
          if (nextBirthday < today) {
            nextBirthday = new Date(currentYear + 1, birthdayMonth, birthdayDay);
          }
          const daysUntilBirthday = Math.floor(
            (nextBirthday.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)
          );
          if (daysUntilBirthday >= 0 && daysUntilBirthday <= 7) {
            status = "coming_up";
          }
        } catch {
          // ignore
        }
      }
    }
    return { ...contact, status, is_pinned: isPinned };
  };

  const handleTogglePin = async (contactId: string) => {
    if (!user) return;
    const currentContact = contacts.find(c => c.id === contactId);
    if (!currentContact) return;

    const newPinStatus = !currentContact.is_pinned;

    // Optimistic UI updates
    setContacts(prev => prev.map(c => c.id === contactId ? updateContactStatusForPin(c, newPinStatus) : c));

    supabase
      .from("contacts")
      .update({ is_pinned: newPinStatus })
      .eq("id", contactId)
      .eq("user_id", user.id)
      .then(({ error }) => {
        if (error) {
          setContacts(prev => prev.map(c => c.id === contactId ? updateContactStatusForPin(c, !newPinStatus) : c));
          console.error("Error toggling pin:", error);
        }
      });
  };

  // Helper selectors
  const formatCadence = (days: number) => {
    if (days === 7) return "Weekly";
    if (days === 30) return "Monthly";
    if (days === 90) return "Quarterly";
    if (days === 365) return "Yearly";
    return `Every ${days} days`;
  };

  const formatLastContact = (contact: Contact) => {
    if (!contact.last_contact_date) return "Never contacted";
    const days = contact.days_since_last_contact || 0;
    if (days === 0) return "Today";
    if (days === 1) return "Yesterday";
    return `${days} days ago`;
  };

  const getNextTouchInfo = (contact: Contact) => {
    if (contact.status === "overdue") return { text: "0 days", color: "text-red-400" };
    if (contact.status === "coming_up" && contact.days_until_due !== undefined) return { text: `${contact.days_until_due} days`, color: "text-yellow-400" };
    if (contact.status === "on_track" && contact.days_until_due !== undefined) return { text: `${contact.days_until_due} days`, color: "text-green-400" };
    return { text: "—", color: "text-gray-400" };
  };

  const getBirthdayInfo = (birthday: string | null | undefined) => {
    if (!birthday) return null;
    try {
      const birthdayDate = new Date(birthday);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      const currentYear = today.getFullYear();
      const birthdayMonth = birthdayDate.getMonth();
      const birthdayDay = birthdayDate.getDate();
      
      let nextBirthday = new Date(currentYear, birthdayMonth, birthdayDay);
      if (nextBirthday < today) {
        nextBirthday = new Date(currentYear + 1, birthdayMonth, birthdayDay);
      }
      
      const daysUntilBirthday = Math.floor((nextBirthday.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
      
      if (daysUntilBirthday >= 0 && daysUntilBirthday <= 7) {
        const formattedDate = nextBirthday.toLocaleDateString("en-US", { month: "long", day: "numeric" });
        return { daysUntil: daysUntilBirthday, formattedDate, isToday: daysUntilBirthday === 0 };
      }
    } catch {
      // ignore
    }
    return null;
  };

  // Clock formatter
  const formatContactLocalTime = (contact: Contact) => {
    const timezone = timezoneMap[`${contact.city || ''}|${contact.country || ''}|${contact.location || ''}`];
    return timezone ? getLocalTime(timezone) : null;
  };

  // Filter and sorting logic
  const filterContacts = useCallback((list: Contact[]) => {
    if (!searchQuery.trim()) return list;
    const query = searchQuery.toLowerCase().trim();
    return list.filter(c => 
      c.name.toLowerCase().includes(query) ||
      c.relationship.toLowerCase().includes(query) ||
      c.city?.toLowerCase().includes(query) ||
      c.country?.toLowerCase().includes(query) ||
      c.location?.toLowerCase().includes(query)
    );
  }, [searchQuery]);

  const sortContacts = useCallback((list: Contact[], mode: "next_touch" | "name") => {
    const sorted = [...list];
    if (mode === "name") {
      return sorted.sort((a, b) => a.name.localeCompare(b.name));
    } else {
      return sorted.sort((a, b) => {
        const getDays = (c: Contact) => {
          if (c.status === "overdue") return 0;
          if (c.days_until_due !== undefined) return c.days_until_due;
          return 999;
        };
        return getDays(a) - getDays(b);
      });
    }
  }, []);

  const comingUpContacts = useMemo(() => 
    sortContacts(filterContacts(contacts.filter(c => c.status === "coming_up" || c.status === "overdue")), comingUpSort),
    [contacts, comingUpSort, filterContacts, sortContacts]
  );

  const onTrackContacts = useMemo(() => 
    sortContacts(filterContacts(contacts.filter(c => c.status === "on_track")), onTrackSort),
    [contacts, onTrackSort, filterContacts, sortContacts]
  );

  const selectedContact = useMemo(() => 
    contacts.find(c => c.id === expandedId) || null,
    [contacts, expandedId]
  );

  const activeLogTouchpointContact = useMemo(() => 
    contacts.find(c => c.id === logTouchpointContactId) || null,
    [contacts, logTouchpointContactId]
  );

  if (loading) {
    return (
      <div className="min-h-screen bg-[#020617] flex items-center justify-center">
        <div className="text-white flex flex-col items-center gap-3 animate-fadeIn">
          <svg className="animate-spin h-8 w-8 text-cyan-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
          <span className="text-sm font-semibold tracking-wide text-gray-400">Loading...</span>
        </div>
      </div>
    );
  }

  if (!user) return null;

  if (contacts.length === 0) {
    router.push("/onboarding");
    return null;
  }

  return (
    <div className="min-h-screen bg-[#020617] text-white">
      <div className="max-w-7xl mx-auto p-4 sm:p-8">
        {/* Header Section */}
        <div className="mb-8">
          <div className="flex justify-between items-center gap-4 mb-4">
            <h1 
              onClick={() => window.location.href = "/"}
              className="text-sm uppercase tracking-widest text-gray-400 hover:text-cyan-400 transition-all duration-200 cursor-pointer select-none font-bold tracking-[0.2em] active:scale-95"
            >
              IN TOUCH
            </h1>
            <div className="flex gap-2 sm:gap-3 items-center">
              <button
                onClick={() => {
                  setIsSearchOpen(!isSearchOpen);
                  if (!isSearchOpen) {
                    setTimeout(() => document.getElementById("search-input")?.focus(), 0);
                  }
                }}
                className="w-10 h-10 flex items-center justify-center text-gray-400 hover:text-white border border-gray-700 rounded-full hover:border-gray-600 hover:bg-[#111827] transition-all duration-200"
                title="Search"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </button>
              <button
                onClick={() => handleToggleAddContact(true)}
                className="w-10 h-10 flex items-center justify-center bg-cyan-500 hover:bg-cyan-600 text-white rounded-full transition-all duration-200"
                title="Add Contact"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
                </svg>
              </button>
              <button
                onClick={() => setIsSettingsOpen(true)}
                className="w-10 h-10 flex items-center justify-center text-gray-400 hover:text-white border border-gray-700 rounded-full hover:border-gray-600 hover:bg-[#111827] transition-all duration-200"
                title="Settings"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
              </button>
              <button
                onClick={handleSignOut}
                className="w-10 h-10 flex items-center justify-center text-gray-400 hover:text-white border border-gray-700 rounded-full hover:border-gray-600 hover:bg-[#111827] transition-all duration-200"
                title="Sign Out"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                </svg>
              </button>
            </div>
          </div>

          {/* Search Input bar */}
          {(isSearchOpen || searchQuery.trim()) && (
            <div className="mb-4 animate-fadeIn">
              <div className="relative">
                <input
                  id="search-input"
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search contacts..."
                  className="w-full px-4 py-2 bg-[#111827] border border-gray-700 rounded-md text-white text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500 placeholder-gray-500"
                />
                {searchQuery.trim() && (
                  <button
                    onClick={() => { setSearchQuery(""); setIsSearchOpen(false); }}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white"
                    title="Clear search"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Global Import feedback notices */}
        {importStatus && (
          <div className={`p-4 mb-6 rounded-xl text-xs font-semibold flex justify-between items-center animate-fadeIn shadow-lg ${
            importStatus.type === "success"
              ? "bg-emerald-950/45 border border-emerald-800 text-emerald-400"
              : importStatus.type === "error"
              ? "bg-red-950/45 border border-red-800 text-red-400"
              : "bg-amber-950/45 border border-amber-800 text-amber-400"
          }`}>
            <span>{importStatus.message}</span>
            <button onClick={() => setImportStatus(null)} className="text-gray-400 hover:text-white font-bold text-sm">×</button>
          </div>
        )}

        {/* 1. Coming Up Section */}
        {(comingUpContacts.length > 0 || !searchQuery.trim()) && (
          <div className="mb-8">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-2xl font-bold text-white">Get in touch</h3>
              <button
                onClick={() => setComingUpSort(prev => prev === "next_touch" ? "name" : "next_touch")}
                className="w-10 h-10 flex items-center justify-center text-gray-400 hover:text-white border border-gray-700 rounded-full hover:border-gray-600 hover:bg-[#111827] transition-all duration-200"
                title={comingUpSort === "next_touch" ? "Sort by: Next Touch" : "Sort by: Name (A-Z)"}
              >
                {comingUpSort === "next_touch" ? (
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                ) : (
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4h13M3 8h9m-9 4h6m4 0l4-4m0 0l4 4m-4-4v12" />
                  </svg>
                )}
              </button>
            </div>
            {comingUpContacts.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 items-start animate-fadeIn">
                {comingUpContacts.map((contact) => {
                  const bdayInfo = getBirthdayInfo(contact.birthday);
                  const isExpanded = expandedId === contact.id;
                  const localTimeStr = formatContactLocalTime(contact);
                  
                  return (
                    <div
                      key={contact.id}
                      onClick={() => handleSelectContact(expandedId === contact.id ? null : contact.id)}
                      className={`bg-[#0b1120] rounded-lg p-6 opacity-90 hover:opacity-100 transition-all relative cursor-pointer select-none border ${
                        isExpanded 
                          ? "border-cyan-500/80 shadow-lg shadow-cyan-950/20 scale-[1.01]" 
                          : bdayInfo 
                            ? "border-2 border-yellow-500/60 hover:border-yellow-500/80" 
                            : "border border-gray-800 hover:border-cyan-500/50"
                      }`}
                    >
                      <div className="absolute top-2 right-2 z-20">
                        <button
                          onClick={(e) => { e.stopPropagation(); handleTogglePin(contact.id); }}
                          className={`bg-[#0b1120] rounded-full p-1 hover:bg-[#111827] transition-colors cursor-pointer ${
                            contact.is_pinned ? "text-cyan-400 hover:text-cyan-300" : "text-gray-500 hover:text-gray-400"
                          }`}
                        >
                          <svg className="w-5 h-5" fill={contact.is_pinned ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                            <circle cx="12" cy="7" r="3.5" fill={contact.is_pinned ? "currentColor" : "none"}/>
                            <path d="M12 10.5v11M9 21.5h6" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                          </svg>
                        </button>
                      </div>
                      {bdayInfo && (
                        <div 
                          className="absolute top-2 right-8 text-xl cursor-help"
                          title={bdayInfo.isToday ? `Birthday today! (${bdayInfo.formattedDate})` : `Birthday in ${bdayInfo.daysUntil} days (${bdayInfo.formattedDate})`}
                          onClick={(e) => e.stopPropagation()}
                        >
                          🎂
                        </div>
                      )}
                      <div className="mb-3">
                        <h4 className="text-lg font-semibold text-white mb-1">{contact.name}</h4>
                        <p className="text-sm text-gray-400">
                          {contact.city || (contact.location ? contact.location.split(',')[0].trim() : '')}
                          {localTimeStr ? ` (${localTimeStr})` : ''}
                          {(contact.city || contact.location || localTimeStr) ? ` • ` : ''}
                          {formatCadence(contact.cadence_days)}
                        </p>
                      </div>
                      <div className="mb-4">
                        <p className="text-xs text-gray-400">
                          Last touch: <span className="text-gray-300">{formatLastContact(contact)}</span>
                          {" • "}
                          Next touch: <span className={getNextTouchInfo(contact).color}>{getNextTouchInfo(contact).text}</span>
                        </p>
                      </div>
                      <div className="flex gap-2 mt-3">
                        <button
                          onClick={(e) => { e.stopPropagation(); handleCallAction(contact); }}
                          className="w-10 h-10 flex items-center justify-center text-emerald-400 hover:text-white border border-emerald-500/40 rounded-full hover:border-emerald-500 hover:bg-emerald-500/10 transition-all duration-200 cursor-pointer"
                          title="Call Contact"
                        >
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 6.75c0 8.284 6.716 15 15 15h2.25a2.25 2.25 0 002.25-2.25v-1.372c0-.516-.351-.966-.852-1.091l-4.423-1.106c-.44-.11-.902.055-1.173.417l-.97 1.293c-.282.376-.769.542-1.21.302a12.01 12.01 0 01-5.907-5.907c-.44-.44-.274-.927.102-1.21l1.293-.97a1.125 1.125 0 00.417-1.173L6.963 3.102a1.125 1.125 0 00-1.091-.852H4.5A2.25 2.25 0 002.25 4.5v2.25z" />
                          </svg>
                        </button>
                        <button
                          onClick={(e) => { e.stopPropagation(); handleTextAction(contact); }}
                          className="w-10 h-10 flex items-center justify-center text-cyan-400 hover:text-white border border-cyan-500/40 rounded-full hover:border-cyan-500 hover:bg-cyan-500/10 transition-all duration-200 cursor-pointer"
                          title="Text Contact"
                        >
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 8.25h9m-9 3H12m-9.75 1.51c0 1.6 1.123 2.994 2.707 3.227 1.129.166 2.27.293 3.423.379.35.026.67.21.865.501L12 21l2.755-4.133a1.14 1.14 0 01.865-.501c1.153-.086 2.294-.21 3.423-.379 1.584-.233 2.707-1.626 2.707-3.228V6.741c0-1.602-1.123-2.995-2.707-3.228A48.394 48.394 0 0012 3c-2.392 0-4.744.175-7.043.513C3.373 3.746 2.25 5.14 2.25 6.741v6.018z" />
                          </svg>
                        </button>
                        <button
                          onClick={(e) => { e.stopPropagation(); setLogTouchpointContactId(contact.id); }}
                          className="w-10 h-10 flex items-center justify-center text-gray-400 hover:text-white border border-gray-700 rounded-full hover:border-gray-600 hover:bg-[#111827] transition-all duration-200 cursor-pointer"
                          title="Log Touchpoint"
                        >
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
                          </svg>
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="bg-[#0b1120] border border-gray-800 rounded-lg p-8 text-center animate-fadeIn">
                <p className="text-gray-400 text-lg">🎉 You're all caught up!</p>
              </div>
            )}
          </div>
        )}

        {/* 2. On Track Section */}
        {(onTrackContacts.length > 0 || !searchQuery.trim()) && (
          <div className="mb-8 animate-fadeIn">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-2xl font-bold text-white">Already in touch</h3>
              <button
                onClick={() => setOnTrackSort(prev => prev === "next_touch" ? "name" : "next_touch")}
                className="w-10 h-10 flex items-center justify-center text-gray-400 hover:text-white border border-gray-700 rounded-full hover:border-gray-600 hover:bg-[#111827] transition-all duration-200"
                title={onTrackSort === "next_touch" ? "Sort by: Next Touch" : "Sort by: Name (A-Z)"}
              >
                {onTrackSort === "next_touch" ? (
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                ) : (
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4h13M3 8h9m-9 4h6m4 0l4-4m0 0l4 4m-4-4v12" />
                  </svg>
                )}
              </button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 items-start">
              {onTrackContacts.map((contact) => {
                const bdayInfo = getBirthdayInfo(contact.birthday);
                const isExpanded = expandedId === contact.id;
                const localTimeStr = formatContactLocalTime(contact);
                
                return (
                  <div
                    key={contact.id}
                    onClick={() => handleSelectContact(expandedId === contact.id ? null : contact.id)}
                    className={`bg-[#0b1120] rounded-lg p-6 opacity-75 hover:opacity-100 transition-all relative cursor-pointer select-none border ${
                      isExpanded 
                        ? "border-cyan-500/80 shadow-lg shadow-cyan-950/20 scale-[1.01]" 
                        : bdayInfo 
                          ? "border-2 border-yellow-500/60 hover:border-yellow-500/80" 
                          : "border border-gray-800 hover:border-gray-700"
                    }`}
                  >
                    <div className="absolute top-2 right-2 z-20">
                      <button
                        onClick={(e) => { e.stopPropagation(); handleTogglePin(contact.id); }}
                        className={`bg-[#0b1120] rounded-full p-1 hover:bg-[#111827] transition-colors cursor-pointer ${
                          contact.is_pinned ? "text-cyan-400 hover:text-cyan-300" : "text-gray-500 hover:text-gray-400"
                        }`}
                      >
                        <svg className="w-5 h-5" fill={contact.is_pinned ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                          <circle cx="12" cy="7" r="3.5" fill={contact.is_pinned ? "currentColor" : "none"}/>
                          <path d="M12 10.5v11M9 21.5h6" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                        </svg>
                      </button>
                    </div>
                    {bdayInfo && (
                      <div 
                        className="absolute top-2 right-8 text-xl cursor-help"
                        title={bdayInfo.isToday ? `Birthday today! (${bdayInfo.formattedDate})` : `Birthday in ${bdayInfo.daysUntil} days (${bdayInfo.formattedDate})`}
                        onClick={(e) => e.stopPropagation()}
                      >
                        🎂
                      </div>
                    )}
                    <div className="mb-3">
                      <h4 className="text-lg font-semibold text-white mb-1">{contact.name}</h4>
                      <p className="text-sm text-gray-400">
                        {contact.city || (contact.location ? contact.location.split(',')[0].trim() : '')}
                        {localTimeStr ? ` (${localTimeStr})` : ''}
                        {(contact.city || contact.location || localTimeStr) ? ` • ` : ''}
                        {formatCadence(contact.cadence_days)}
                      </p>
                    </div>
                    <div className="mb-4">
                      <p className="text-xs text-gray-400">
                        Last touch: <span className="text-gray-300">{formatLastContact(contact)}</span>
                        {" • "}
                        Next touch: <span className={getNextTouchInfo(contact).color}>{getNextTouchInfo(contact).text}</span>
                      </p>
                    </div>
                    <div className="flex gap-2 mt-3">
                      <button
                        onClick={(e) => { e.stopPropagation(); handleCallAction(contact); }}
                        className="w-10 h-10 flex items-center justify-center text-emerald-400 hover:text-white border border-emerald-500/40 rounded-full hover:border-emerald-500 hover:bg-emerald-500/10 transition-all duration-200 cursor-pointer"
                        title="Call Contact"
                      >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 6.75c0 8.284 6.716 15 15 15h2.25a2.25 2.25 0 002.25-2.25v-1.372c0-.516-.351-.966-.852-1.091l-4.423-1.106c-.44-.11-.902.055-1.173.417l-.97 1.293c-.282.376-.769.542-1.21.302a12.01 12.01 0 01-5.907-5.907c-.44-.44-.274-.927.102-1.21l1.293-.97a1.125 1.125 0 00.417-1.173L6.963 3.102a1.125 1.125 0 00-1.091-.852H4.5A2.25 2.25 0 002.25 4.5v2.25z" />
                        </svg>
                      </button>
                      <button
                        onClick={(e) => { e.stopPropagation(); handleTextAction(contact); }}
                        className="w-10 h-10 flex items-center justify-center text-cyan-400 hover:text-white border border-cyan-500/40 rounded-full hover:border-cyan-500 hover:bg-cyan-500/10 transition-all duration-200 cursor-pointer"
                        title="Text Contact"
                      >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 8.25h9m-9 3H12m-9.75 1.51c0 1.6 1.123 2.994 2.707 3.227 1.129.166 2.27.293 3.423.379.35.026.67.21.865.501L12 21l2.755-4.133a1.14 1.14 0 01.865-.501c1.153-.086 2.294-.21 3.423-.379 1.584-.233 2.707-1.626 2.707-3.228V6.741c0-1.602-1.123-2.995-2.707-3.228A48.394 48.394 0 0012 3c-2.392 0-4.744.175-7.043.513C3.373 3.746 2.25 5.14 2.25 6.741v6.018z" />
                        </svg>
                      </button>
                      <button
                        onClick={(e) => { e.stopPropagation(); setLogTouchpointContactId(contact.id); }}
                        className="w-10 h-10 flex items-center justify-center text-gray-400 hover:text-white border border-gray-700 rounded-full hover:border-gray-600 hover:bg-[#111827] transition-all duration-200 cursor-pointer"
                        title="Log Touchpoint"
                      >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
                        </svg>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* RENDER DYNAMIC SUBCOMPONENTS */}

      {/* Add Contact Modal/Drawer */}
      <AddContactModal
        isOpen={isAddContactOpen}
        onClose={() => handleToggleAddContact(false)}
        userId={user.id}
        onSuccess={async () => await loadContacts(user.id)}
        onImportVCards={(drafts) => {
          setImportingContacts(drafts);
          setIsImportReviewOpen(true);
        }}
        onOpenImportGuide={() => setIsImportGuideOpen(true)}
      />

      {/* Settings Modal */}
      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        user={user}
        contactsCount={contacts.length}
        onSuccess={async () => await loadContacts(user.id)}
      />

      {/* Log Touchpoint Modal */}
      <LogTouchpointModal
        isOpen={logTouchpointContactId !== null}
        onClose={() => setLogTouchpointContactId(null)}
        contactId={logTouchpointContactId}
        contactName={activeLogTouchpointContact?.name || null}
        isPinned={activeLogTouchpointContact?.is_pinned === true}
        userId={user.id}
        onSuccess={async () => await loadContacts(user.id)}
      />

      {/* Configure Phone Modal */}
      <ConfigurePhoneModal
        isOpen={phoneConfigureContact !== null}
        onClose={() => setPhoneConfigureContact(null)}
        contact={phoneConfigureContact}
        userId={user.id}
        onSuccess={async () => await loadContacts(user.id)}
      />

      {/* VCF Instructions Guide Modal */}
      <ImportGuideModal
        isOpen={isImportGuideOpen}
        onClose={() => setIsImportGuideOpen(false)}
      />

      {/* Contact Profile Details slide-over drawer */}
      <ProfileDrawer
        isOpen={selectedContact !== null}
        onClose={() => handleSelectContact(null)}
        contact={selectedContact}
        userId={user.id}
        timezoneMap={timezoneMap}
        onSuccess={async () => await loadContacts(user.id)}
        onLogTouchpoint={(id) => setLogTouchpointContactId(id)}
        onCall={(c) => handleCallAction(c)}
        onText={(c) => handleTextAction(c)}
        onTogglePin={(id) => handleTogglePin(id)}
      />

      {/* Automated vCard importing drafts review modal */}
      <VCardImportReviewModal
        isOpen={isImportReviewOpen}
        onClose={() => setIsImportReviewOpen(false)}
        importingContacts={importingContacts}
        userId={user.id}
        onImportSuccess={async (imported) => {
          await loadContacts(user.id);
          setImportStatus({
            type: "success",
            message: `Successfully imported ${imported.length} contact${imported.length !== 1 ? "s" : ""}!`,
          });
          setIsImportReviewOpen(false);
          handleToggleAddContact(false);
        }}
        onImportError={(errorMsg) => {
          setImportStatus({ type: "error", message: errorMsg });
        }}
      />
    </div>
  );
}

export default function Home() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-[#020617] flex items-center justify-center">
        <div className="text-white flex flex-col items-center gap-3 animate-fadeIn">
          <svg className="animate-spin h-8 w-8 text-cyan-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
          <span className="text-sm font-semibold tracking-wide text-gray-400">Loading...</span>
        </div>
      </div>
    }>
      <HomeContent />
    </Suspense>
  );
}
