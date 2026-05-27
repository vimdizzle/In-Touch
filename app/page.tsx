"use client";

import { useEffect, useState, useMemo, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import { useRouter } from "next/navigation";
import type { User } from "@supabase/supabase-js";
import { getLocalTime as getLocalTimeUtil } from "@/lib/utils";

interface Contact {
  id: string;
  name: string;
  relationship: string;
  city?: string | null;
  country?: string | null;
  location?: string | null; // kept for backward compatibility
  birthday?: string | null;
  cadence_days: number;
  last_contact_date?: string;
  last_contact_channel?: string;
  days_since_last_contact?: number;
  status: "overdue" | "coming_up" | "on_track";
  days_until_due?: number;
  days_overdue?: number;
  is_pinned?: boolean;
  phone?: string | null;
  email?: string | null;
  notes?: string | null;
  touchpoints?: any[];
}

export default function Home() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [comingUpSort, setComingUpSort] = useState<"next_touch" | "name">("next_touch");
  const [onTrackSort, setOnTrackSort] = useState<"next_touch" | "name">("next_touch");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [activeContactMenu, setActiveContactMenu] = useState<Contact | null>(null);
  const router = useRouter();

  const toggleExpand = (id: string) => {
    setExpandedId(prev => prev === id ? null : id);
  };

  // A state hook to trigger re-renders every 30 seconds to update local clocks live
  const [timeTick, setTimeTick] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      setTimeTick((tick) => tick + 1);
    }, 30000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    const checkMobile = () => {
      // Check for mobile devices using multiple methods
      const isMobileWidth = window.innerWidth < 640;
      const isTouchDevice = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
      const isMobileUserAgent = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
      setIsMobile(isMobileWidth || (isTouchDevice && isMobileUserAgent));
    };
    checkMobile();
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, []);

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (session) {
        setUser(session.user);
        await loadContacts(session.user.id);
      } else {
        router.push("/auth");
      }
      setLoading(false);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session) {
        setUser(session.user);
        loadContacts(session.user.id);
      } else {
        router.push("/auth");
      }
    });

    return () => subscription.unsubscribe();
  }, [router]);

  const loadContacts = async (userId: string) => {
    try {
      // Fetch all contacts first
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

      // Then fetch all touchpoints for these contacts in one query
      const contactIds = contactsData.map(c => c.id);
      const { data: allTouchpoints, error: touchpointsError } = await supabase
        .from("touchpoints")
        .select("id, contact_id, contact_date, channel, note")
        .in("contact_id", contactIds)
        .order("contact_date", { ascending: false });

      if (touchpointsError) throw touchpointsError;

      // Group touchpoints by contact_id and get the latest one for each
      const lastTouchpointMap = new Map<string, { contact_date: string; channel: string }>();
      const touchpointsMap = new Map<string, any[]>();
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

      // Helper function to check if birthday is within next 7 days
      const isBirthdayWithin7Days = (birthday: string | null | undefined): boolean => {
        if (!birthday) return false;
        
        try {
          const birthdayDate = new Date(birthday);
          const currentYear = today.getFullYear();
          const currentMonth = today.getMonth();
          const currentDay = today.getDate();
          
          // Get birthday month and day (ignore year)
          const birthdayMonth = birthdayDate.getMonth();
          const birthdayDay = birthdayDate.getDate();
          
          // Create birthday date for this year
          let nextBirthday = new Date(currentYear, birthdayMonth, birthdayDay);
          
          // If birthday has already passed this year, use next year
          if (nextBirthday < today) {
            nextBirthday = new Date(currentYear + 1, birthdayMonth, birthdayDay);
          }
          
          // Calculate days until birthday
          const daysUntilBirthday = Math.floor(
            (nextBirthday.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)
          );
          
          return daysUntilBirthday >= 0 && daysUntilBirthday <= 7;
        } catch (error) {
          console.error("Error parsing birthday:", birthday, error);
          return false;
        }
      };

      // Process contacts with their last touchpoint
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
          // No touchpoints yet - consider overdue if cadence has passed since creation
          const createdDate = new Date(contact.created_at);
          createdDate.setHours(0, 0, 0, 0);
          daysSinceLastContact = Math.floor(
            (today.getTime() - createdDate.getTime()) / (1000 * 60 * 60 * 24)
          );

          if (daysSinceLastContact >= contact.cadence_days) {
            status = "overdue";
            daysOverdue = daysSinceLastContact - contact.cadence_days;
          } else if (contact.cadence_days - daysSinceLastContact <= 7) {
            status = "coming_up";
            daysUntilDue = contact.cadence_days - daysSinceLastContact;
          }
        }

        // Override status to "coming_up" if pinned (regardless of cadence)
        if (contact.is_pinned) {
          status = "coming_up";
        }
        
        // Override status to "coming_up" if birthday is within 7 days (regardless of cadence)
        // Note: Pin takes precedence, but birthday can still override if not pinned
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
          is_pinned: contact.is_pinned === true, // Explicitly ensure boolean
          touchpoints: contactTouchpoints,
        };
      });

      setContacts(contactsWithStatus);
    } catch (error) {
      console.error("Error loading contacts:", error);
    }
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    router.push("/auth");
  };

  // Helper function to recalculate status based on pin status
  // Uses existing contact data and only updates status based on pin
  const updateContactStatusForPin = (contact: Contact, isPinned: boolean): Contact => {
    let status: "overdue" | "coming_up" | "on_track" = contact.status;
    
    // If pinning, always set to "coming_up"
    if (isPinned) {
      status = "coming_up";
    } else {
      // If unpinning, recalculate based on existing days_until_due
      // Use the same logic as in loadContacts
      if (contact.days_until_due !== undefined) {
        if (contact.days_until_due < 0) {
          status = "overdue";
        } else if (contact.days_until_due <= 7) {
          status = "coming_up";
        } else {
          status = "on_track";
        }
      } else {
        // Fallback: if no days_until_due, keep current status but check if it should be on_track
        if (contact.status === "coming_up" && !isPinned) {
          // Only change from coming_up to on_track if we have enough info
          // Otherwise keep the status as is
          status = contact.status;
        }
      }
      
      // Check birthday override (only if unpinning and status would be on_track)
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
        } catch (error) {
          // Ignore birthday parsing errors
        }
      }
    }

    return {
      ...contact,
      status,
      is_pinned: isPinned,
    };
  };

  const handleTogglePin = async (contactId: string) => {
    if (!user) return;

    // Find the current contact to get its pin status
    const currentContact = contacts.find(c => c.id === contactId);
    if (!currentContact) return;

    const newPinStatus = !currentContact.is_pinned;

    // Optimistic update: update UI immediately with recalculated status
    setContacts(prevContacts => 
      prevContacts.map(c => {
        if (c.id === contactId) {
          return updateContactStatusForPin(c, newPinStatus);
        }
        return c;
      })
    );

    // Update database in background (don't await)
    supabase
      .from("contacts")
      .update({ is_pinned: newPinStatus })
      .eq("id", contactId)
      .eq("user_id", user.id)
      .then(({ error }) => {
        if (error) {
          // Revert on error
          setContacts(prevContacts => 
            prevContacts.map(c => {
              if (c.id === contactId) {
                return updateContactStatusForPin(c, !newPinStatus);
              }
              return c;
            })
          );
          console.error("Error toggling pin:", error);
        }
      });
  };

  const formatCadence = (days: number) => {
    if (days === 7) return "Weekly";
    if (days === 30) return "Monthly";
    if (days === 90) return "Quarterly";
    if (days === 365) return "Yearly";
    return `Every ${days} days`;
  };

  const formatLastContact = (contact: Contact) => {
    if (!contact.last_contact_date) {
      return "Never contacted";
    }
    const days = contact.days_since_last_contact || 0;
    if (days === 0) return "Today";
    if (days === 1) return "Yesterday";
    return `${days} days ago`;
  };

  const getNextTouchInfo = (contact: Contact) => {
    if (contact.status === "overdue") {
      return { text: "0 days", color: "text-red-400" };
    }
    if (contact.status === "coming_up" && contact.days_until_due !== undefined) {
      return { text: `${contact.days_until_due} days`, color: "text-yellow-400" };
    }
    if (contact.status === "on_track" && contact.days_until_due !== undefined) {
      return { text: `${contact.days_until_due} days`, color: "text-green-400" };
    }
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
      
      // Create birthday date for this year
      let nextBirthday = new Date(currentYear, birthdayMonth, birthdayDay);
      
      // If birthday has already passed this year, use next year
      if (nextBirthday < today) {
        nextBirthday = new Date(currentYear + 1, birthdayMonth, birthdayDay);
      }
      
      // Calculate days until birthday
      const daysUntilBirthday = Math.floor(
        (nextBirthday.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)
      );
      
      if (daysUntilBirthday >= 0 && daysUntilBirthday <= 7) {
        // Format the birthday date (month and day only, no year for privacy)
        const formattedDate = nextBirthday.toLocaleDateString("en-US", {
          month: "long",
          day: "numeric"
        });
        
        return {
          daysUntil: daysUntilBirthday,
          formattedDate,
          isToday: daysUntilBirthday === 0
        };
      }
    } catch (error) {
      console.error("Error parsing birthday:", birthday, error);
    }
    
    return null;
  };

  // Cache for local time calculations (persists across renders)
  const localTimeCacheRef = useMemo(() => new Map<string, string | null>(), []);

  const getLocalTime = useCallback((city?: string | null, country?: string | null, location?: string | null): string | null => {
    // Create cache key
    const cacheKey = `${city || ''}|${country || ''}|${location || ''}`;
    
    // Check cache first
    if (localTimeCacheRef.has(cacheKey)) {
      return localTimeCacheRef.get(cacheKey) || null;
    }

    const time = getLocalTimeUtil(city, country, location);
    localTimeCacheRef.set(cacheKey, time);
    return time;
  }, [localTimeCacheRef]);

  // Filter contacts by search query
  // Memoized filter function
  const filterContacts = useCallback((contactList: Contact[]) => {
    if (!searchQuery.trim()) return contactList;

    const query = searchQuery.toLowerCase().trim();
    return contactList.filter((contact) => {
      const nameMatch = contact.name.toLowerCase().includes(query);
      const relationshipMatch = contact.relationship.toLowerCase().includes(query);
      const cityMatch = contact.city?.toLowerCase().includes(query);
      const countryMatch = contact.country?.toLowerCase().includes(query);
      const locationMatch = contact.location?.toLowerCase().includes(query); // backward compatibility
      return nameMatch || relationshipMatch || cityMatch || countryMatch || locationMatch;
    });
  }, [searchQuery]);

  // Memoized sort function
  const sortContacts = useCallback((contactList: Contact[], sortMode: "next_touch" | "name"): Contact[] => {
    const sorted = [...contactList];
    if (sortMode === "name") {
      return sorted.sort((a, b) => a.name.localeCompare(b.name));
    } else {
      // Sort by "Next touch" - closest to furthest
      return sorted.sort((a, b) => {
        // Get days until next touch for each contact
        const getDaysUntilNextTouch = (contact: Contact): number => {
          if (contact.status === "overdue") return 0; // Overdue = 0 days
          if (contact.status === "coming_up" && contact.days_until_due !== undefined) {
            return contact.days_until_due;
          }
          if (contact.status === "on_track" && contact.days_until_due !== undefined) {
            return contact.days_until_due;
          }
          return 999; // Fallback for contacts without due date
        };
        
        const aDays = getDaysUntilNextTouch(a);
        const bDays = getDaysUntilNextTouch(b);
        return aDays - bDays; // Closest to furthest
      });
    }
  }, []);

  // Memoized filtered and sorted contacts
  const allComingUpContacts = useMemo(() => 
    contacts.filter((c) => c.status === "coming_up" || c.status === "overdue"),
    [contacts]
  );
  const allOnTrackContacts = useMemo(() => 
    contacts.filter((c) => c.status === "on_track"),
    [contacts]
  );
  
  const comingUpContacts = useMemo(() => 
    sortContacts(filterContacts(allComingUpContacts), comingUpSort),
    [allComingUpContacts, filterContacts, sortContacts, comingUpSort]
  );
  const onTrackContacts = useMemo(() => 
    sortContacts(filterContacts(allOnTrackContacts), onTrackSort),
    [allOnTrackContacts, filterContacts, sortContacts, onTrackSort]
  );

  const selectedContact = useMemo(() => {
    return contacts.find(c => c.id === expandedId) || null;
  }, [contacts, expandedId]);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#020617] flex items-center justify-center">
        <div className="text-white">Loading...</div>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  // Check if user has contacts, redirect to onboarding if not
  if (contacts.length === 0) {
    router.push("/onboarding");
    return null;
  }

  return (
    <div className="min-h-screen bg-[#020617] text-white">
      <div className="max-w-7xl mx-auto p-4 sm:p-8">
        <div className="mb-8">
          <div className="flex justify-between items-center gap-4 mb-4">
            <h1 className="text-sm uppercase tracking-widest text-gray-400">
              IN TOUCH
            </h1>
            <div className="flex gap-2 sm:gap-3 items-center">
              {/* Search icon button */}
              <button
                onClick={() => {
                  setIsSearchOpen(!isSearchOpen);
                  if (!isSearchOpen) {
                    // Focus the input when opening
                    setTimeout(() => {
                      const input = document.getElementById("search-input");
                      input?.focus();
                    }, 0);
                  }
                }}
                className="w-10 h-10 flex items-center justify-center text-gray-400 hover:text-white border border-gray-700 rounded-md hover:border-gray-600 transition-colors"
                title="Search"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </button>
              {/* Add Contact button - Chrome-style + icon */}
              <button
                onClick={() => router.push("/add-contact")}
                className="w-10 h-10 flex items-center justify-center bg-cyan-500 hover:bg-cyan-600 text-white rounded-md transition-colors"
                title="Add Contact"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
                </svg>
              </button>
              {/* Settings icon button */}
              <button
                onClick={() => router.push("/settings")}
                className="w-10 h-10 flex items-center justify-center text-gray-400 hover:text-white border border-gray-700 rounded-md hover:border-gray-600 transition-colors"
                title="Settings"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
              </button>
              {/* Sign Out icon button */}
              <button
                onClick={handleSignOut}
                className="w-10 h-10 flex items-center justify-center text-gray-400 hover:text-white border border-gray-700 rounded-md hover:border-gray-600 transition-colors"
                title="Sign Out"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                </svg>
              </button>
            </div>
          </div>
          {/* Search input - expandable on both mobile and desktop */}
          {(isSearchOpen || searchQuery.trim()) && (
            <div className="mb-4">
              <div className="relative">
                <input
                  id="search-input"
                  type="text"
                  value={searchQuery}
                  onChange={(e) => {
                    setSearchQuery(e.target.value);
                    if (e.target.value.trim()) {
                      setIsSearchOpen(true);
                    }
                  }}
                  onBlur={() => {
                    // Keep search open if there's text, close if empty
                    if (!searchQuery.trim()) {
                      setIsSearchOpen(false);
                    }
                  }}
                  placeholder="Search contacts..."
                  className="w-full px-4 py-2 bg-[#111827] border border-gray-700 rounded-md text-white text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500 placeholder-gray-500"
                />
                {searchQuery.trim() && (
                  <button
                    onClick={() => {
                      setSearchQuery("");
                      setIsSearchOpen(false);
                    }}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white"
                    title="Clear search"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Coming Up Section (includes overdue) */}
        {(comingUpContacts.length > 0 || !searchQuery.trim()) && (
          <div className="mb-8">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-2xl font-bold text-white">
                Get in touch:
              </h3>
              <button
                onClick={() => setComingUpSort(comingUpSort === "next_touch" ? "name" : "next_touch")}
                className="p-2 text-gray-400 hover:text-white border border-gray-700 rounded-md hover:border-gray-600 transition-colors"
                title={comingUpSort === "next_touch" ? "Sort by: Next Touch" : "Sort by: Name (A-Z)"}
              >
                {comingUpSort === "next_touch" ? (
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                ) : (
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4h13M3 8h9m-9 4h6m4 0l4-4m0 0l4 4m-4-4v12" />
                  </svg>
                )}
              </button>
            </div>
            {comingUpContacts.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 items-start">
              {comingUpContacts.map((contact) => {
                const birthdayInfo = getBirthdayInfo(contact.birthday);
                const hasUpcomingBirthday = birthdayInfo !== null;
                const isPinned = contact.is_pinned === true;
                
                const isExpanded = expandedId === contact.id;
                
                return (
                <div
                  key={contact.id}
                  onClick={() => toggleExpand(contact.id)}
                  className={`bg-[#0b1120] rounded-lg p-6 opacity-90 hover:opacity-100 transition-all relative cursor-pointer select-none border ${
                    isExpanded 
                      ? "border-cyan-500/80 shadow-lg shadow-cyan-950/20 scale-[1.01]" 
                      : hasUpcomingBirthday 
                        ? "border-2 border-yellow-500/60 hover:border-yellow-500/80" 
                        : "border border-gray-800 hover:border-cyan-500/50"
                  }`}
                >
                  <div className="absolute top-2 right-2 z-20">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleTogglePin(contact.id);
                      }}
                      className={`bg-[#0b1120] rounded-full p-1 hover:bg-[#111827] transition-colors cursor-pointer ${
                        isPinned 
                          ? "text-cyan-400 hover:text-cyan-300" 
                          : "text-gray-500 hover:text-gray-400"
                      }`}
                      title={isPinned ? "Click to unpin" : "Click to pin"}
                    >
                      <svg className="w-5 h-5" fill={isPinned ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                        <circle cx="12" cy="7" r="3.5" fill={isPinned ? "currentColor" : "none"}/>
                        <path d="M12 10.5v11M9 21.5h6" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                      </svg>
                    </button>
                  </div>
                  {hasUpcomingBirthday && (
                    <div 
                      className="absolute top-2 right-8 text-xl cursor-help"
                      title={birthdayInfo.isToday 
                        ? `Birthday today! (${birthdayInfo.formattedDate})` 
                        : `Birthday in ${birthdayInfo.daysUntil} day${birthdayInfo.daysUntil !== 1 ? 's' : ''} (${birthdayInfo.formattedDate})`
                      }
                      onClick={(e) => e.stopPropagation()}
                    >
                      🎂
                    </div>
                  )}
                  <div className="mb-3">
                    <h4 className="text-lg font-semibold text-white mb-1">
                      {contact.name}
                    </h4>
                    <p className="text-sm text-gray-400">
                      {contact.relationship}
                      {contact.city && ` • ${contact.city}`}
                      {!contact.city && contact.location && ` • ${contact.location.includes(',') ? contact.location.split(',')[0].trim() : contact.location.trim()}`}
                      {(() => {
                        const localTime = getLocalTime(contact.city, contact.country, contact.location);
                        return localTime ? ` (${localTime})` : '';
                      })()}
                      {` • ${formatCadence(contact.cadence_days)}`}
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
                    {/* Reach Out Circular Button */}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setActiveContactMenu(contact);
                      }}
                      className="w-10 h-10 flex items-center justify-center text-gray-400 hover:text-white border border-gray-700 rounded-full hover:border-gray-600 hover:bg-[#111827] transition-all duration-200"
                      title="Reach Out"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 8.25h9m-9 3H12m-9.75 1.51c0 1.6 1.123 2.994 2.707 3.227 1.129.166 2.27.293 3.423.379.35.026.67.21.865.501L12 21l2.755-4.133a1.14 1.14 0 01.865-.501c1.153-.086 2.294-.21 3.423-.379 1.584-.233 2.707-1.626 2.707-3.228V6.741c0-1.602-1.123-2.995-2.707-3.228A48.394 48.394 0 0012 3c-2.392 0-4.744.175-7.043.513C3.373 3.746 2.25 5.14 2.25 6.741v6.018z" />
                      </svg>
                    </button>
                    {/* Log Circular Button */}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        router.push(`/log-touchpoint?contactId=${contact.id}`);
                      }}
                      className="w-10 h-10 flex items-center justify-center text-cyan-400 hover:text-white border border-cyan-500/40 rounded-full hover:border-cyan-500 hover:bg-cyan-500/10 transition-all duration-200"
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
            <div className="bg-[#0b1120] border border-gray-800 rounded-lg p-8 text-center">
              <p className="text-gray-400 text-lg">
                🎉 You're all caught up!
              </p>
            </div>
            )}
          </div>
        )}

        {/* On Track Section (optional, can be collapsed) */}
        {(onTrackContacts.length > 0 || !searchQuery.trim()) && (
          <div className="mb-8">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-2xl font-bold text-white">
                Already in touch:
              </h3>
              <button
                onClick={() => setOnTrackSort(onTrackSort === "next_touch" ? "name" : "next_touch")}
                className="p-2 text-gray-400 hover:text-white border border-gray-700 rounded-md hover:border-gray-600 transition-colors"
                title={onTrackSort === "next_touch" ? "Sort by: Next Touch" : "Sort by: Name (A-Z)"}
              >
                {onTrackSort === "next_touch" ? (
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                ) : (
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4h13M3 8h9m-9 4h6m4 0l4-4m0 0l4 4m-4-4v12" />
                  </svg>
                )}
              </button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 items-start">
              {onTrackContacts.map((contact) => {
                const birthdayInfo = getBirthdayInfo(contact.birthday);
                const hasUpcomingBirthday = birthdayInfo !== null;
                const isPinned = contact.is_pinned === true;
                
                const isExpanded = expandedId === contact.id;
                
                return (
                <div
                  key={contact.id}
                  onClick={() => toggleExpand(contact.id)}
                  className={`bg-[#0b1120] rounded-lg p-6 opacity-75 hover:opacity-100 transition-all relative cursor-pointer select-none border ${
                    isExpanded 
                      ? "border-cyan-500/80 shadow-lg shadow-cyan-950/20 scale-[1.01]" 
                      : hasUpcomingBirthday 
                        ? "border-2 border-yellow-500/60 hover:border-yellow-500/80" 
                        : "border border-gray-800 hover:border-gray-700"
                  }`}
                >
                  <div className="absolute top-2 right-2 z-20">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleTogglePin(contact.id);
                      }}
                      className={`bg-[#0b1120] rounded-full p-1 hover:bg-[#111827] transition-colors cursor-pointer ${
                        isPinned 
                          ? "text-cyan-400 hover:text-cyan-300" 
                          : "text-gray-500 hover:text-gray-400"
                      }`}
                      title={isPinned ? "Click to unpin" : "Click to pin"}
                    >
                      <svg className="w-5 h-5" fill={isPinned ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                        <circle cx="12" cy="7" r="3.5" fill={isPinned ? "currentColor" : "none"}/>
                        <path d="M12 10.5v11M9 21.5h6" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                      </svg>
                    </button>
                  </div>
                  {hasUpcomingBirthday && (
                    <div 
                      className="absolute top-2 right-8 text-xl cursor-help"
                      title={birthdayInfo.isToday 
                        ? `Birthday today! (${birthdayInfo.formattedDate})` 
                        : `Birthday in ${birthdayInfo.daysUntil} day${birthdayInfo.daysUntil !== 1 ? 's' : ''} (${birthdayInfo.formattedDate})`
                      }
                      onClick={(e) => e.stopPropagation()}
                    >
                      🎂
                    </div>
                  )}
                  <div className="mb-3">
                    <h4 className="text-lg font-semibold text-white mb-1">
                      {contact.name}
                    </h4>
                    <p className="text-sm text-gray-400">
                      {contact.relationship}
                      {contact.city && ` • ${contact.city}`}
                      {!contact.city && contact.location && ` • ${contact.location.includes(',') ? contact.location.split(',')[0].trim() : contact.location.trim()}`}
                      {(() => {
                        const localTime = getLocalTime(contact.city, contact.country, contact.location);
                        return localTime ? ` (${localTime})` : '';
                      })()}
                      {` • ${formatCadence(contact.cadence_days)}`}
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
                    {/* Reach Out Circular Button */}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setActiveContactMenu(contact);
                      }}
                      className="w-10 h-10 flex items-center justify-center text-gray-400 hover:text-white border border-gray-700 rounded-full hover:border-gray-600 hover:bg-[#111827] transition-all duration-200"
                      title="Reach Out"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 8.25h9m-9 3H12m-9.75 1.51c0 1.6 1.123 2.994 2.707 3.227 1.129.166 2.27.293 3.423.379.35.026.67.21.865.501L12 21l2.755-4.133a1.14 1.14 0 01.865-.501c1.153-.086 2.294-.21 3.423-.379 1.584-.233 2.707-1.626 2.707-3.228V6.741c0-1.602-1.123-2.995-2.707-3.228A48.394 48.394 0 0012 3c-2.392 0-4.744.175-7.043.513C3.373 3.746 2.25 5.14 2.25 6.741v6.018z" />
                      </svg>
                    </button>
                    {/* Log Circular Button */}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        router.push(`/log-touchpoint?contactId=${contact.id}`);
                      }}
                      className="w-10 h-10 flex items-center justify-center text-cyan-400 hover:text-white border border-cyan-500/40 rounded-full hover:border-cyan-500 hover:bg-cyan-500/10 transition-all duration-200"
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

        {/* Empty state */}
        {contacts.length === 0 && (
          <div className="bg-[#0b1120] border border-gray-800 rounded-lg p-8 text-center">
            <p className="text-gray-400 mb-4">No contacts yet.</p>
            <button
              onClick={() => router.push("/onboarding")}
              className="bg-cyan-500 hover:bg-cyan-600 text-white py-2 px-6 rounded-md transition-colors"
            >
              Add Your First Contact
            </button>
          </div>
        )}

        {/* Slide-Over Drawer / Bottom Sheet for Contact Details */}
        {selectedContact && (
          <div 
            className="fixed inset-0 z-50 flex flex-col md:flex-row justify-end items-end md:items-stretch"
            onClick={() => setExpandedId(null)}
          >
            {/* Backdrop with blur */}
            <div className="fixed inset-0 bg-black/60 backdrop-blur-sm transition-opacity" />

            {/* Drawer Panel */}
            <div 
              className="relative w-full h-[85vh] md:h-screen md:max-w-md lg:max-w-lg bg-[#0b1120] border-t md:border-t-0 md:border-l border-gray-800 rounded-t-3xl md:rounded-t-none md:rounded-l-3xl shadow-2xl flex flex-col animate-slideUp md:animate-slideInRight cursor-default"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header */}
              <div className="p-6 border-b border-gray-800/80 flex justify-between items-start gap-4">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="text-xl font-bold text-white leading-tight">
                      {selectedContact.name}
                    </h3>
                    <button
                      onClick={() => handleTogglePin(selectedContact.id)}
                      className={`rounded-full p-1 hover:bg-[#111827] transition-colors ${
                        selectedContact.is_pinned 
                          ? "text-cyan-400" 
                          : "text-gray-500"
                      }`}
                      title={selectedContact.is_pinned ? "Unpin contact" : "Pin contact"}
                    >
                      <svg className="w-5 h-5" fill={selectedContact.is_pinned ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                        <circle cx="12" cy="7" r="3.5" fill={selectedContact.is_pinned ? "currentColor" : "none"}/>
                        <path d="M12 10.5v11M9 21.5h6" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                      </svg>
                    </button>
                  </div>
                  <p className="text-sm text-gray-400">
                    {selectedContact.relationship}
                    {` • ${formatCadence(selectedContact.cadence_days)}`}
                  </p>
                </div>
                <button
                  onClick={() => setExpandedId(null)}
                  className="p-1.5 text-gray-400 hover:text-white rounded-md hover:bg-gray-800/80 transition-colors"
                  title="Close panel"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              {/* Scrollable Content */}
              <div className="flex-1 overflow-y-auto p-6 space-y-6">
                {/* Status Bar */}
                <div className="bg-[#111827]/40 border border-gray-800/60 rounded-xl p-4 flex justify-between items-center text-sm">
                  <div>
                    <span className="text-gray-400 text-xs block mb-0.5">Last touchpoint</span>
                    <span className="font-medium text-gray-200">{formatLastContact(selectedContact)}</span>
                  </div>
                  <div className="text-right">
                    <span className="text-gray-400 text-xs block mb-0.5">Next touch due</span>
                    <span className={`font-semibold ${getNextTouchInfo(selectedContact).color}`}>
                      {getNextTouchInfo(selectedContact).text}
                    </span>
                  </div>
                </div>

                {/* Details Section */}
                <div className="space-y-4">
                  <h4 className="text-xs font-semibold text-cyan-400 uppercase tracking-wider">Contact Info</h4>
                  
                  <div className="space-y-3">
                    {/* Location */}
                    {(selectedContact.city || selectedContact.country || selectedContact.location) && (
                      <div className="flex items-center gap-3 p-3 bg-[#111827]/20 border border-gray-800/40 rounded-xl">
                        <svg className="w-5 h-5 text-gray-400 shrink-0" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0z" />
                          <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25s-7.5-4.108-7.5-11.25a7.5 7.5 0 1115 0z" />
                        </svg>
                        <div className="text-sm">
                          <span className="text-gray-500 text-xs block">Location</span>
                          <span className="text-gray-200">
                            {[selectedContact.city, selectedContact.country].filter(Boolean).join(', ') || selectedContact.location}
                            {(() => {
                              const localTime = getLocalTime(selectedContact.city, selectedContact.country, selectedContact.location);
                              return localTime ? ` (${localTime} local time)` : '';
                            })()}
                          </span>
                        </div>
                      </div>
                    )}

                    {/* Birthday */}
                    {selectedContact.birthday && (
                      <div className="flex items-center gap-3 p-3 bg-[#111827]/20 border border-gray-800/40 rounded-xl">
                        <svg className="w-5 h-5 text-gray-400 shrink-0" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M12 8.25v-1.5m0 1.5c-1.355 0-2.697-.056-4.024-.166C6.845 7.96 6 6.99(6 5.89V5.25c0-1.1.9-2 2-2h8c1.1 0 2 .9 2 2v.64c0 1.1-.845 2.07-1.976 2.194A42.14 42.14 0 0112 8.25zm0 0v1.5m0-1.5c1.355 0 2.697.056 4.024.166C17.156 8.52 18 9.49 18 10.59v6.66a2.25 2.25 0 01-2.25 2.25H8.25A2.25 2.25 0 016 17.25v-6.66c0-1.1.844-2.07 1.976-2.194C9.303 8.306 10.645 8.25 12 8.25z" />
                        </svg>
                        <div className="text-sm">
                          <span className="text-gray-500 text-xs block">Birthday</span>
                          <span className="text-gray-200">
                            {new Date(selectedContact.birthday).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}
                          </span>
                        </div>
                      </div>
                    )}

                    {/* Phone */}
                    {selectedContact.phone && (
                      <div className="flex items-center justify-between p-3 bg-[#111827]/20 border border-gray-800/40 rounded-xl">
                        <div className="flex items-center gap-3">
                          <svg className="w-5 h-5 text-gray-400 shrink-0" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 6.75c0 8.284 6.716 15 15 15h2.25a2.25 2.25 0 002.25-2.25v-1.372c0-.516-.351-.966-.852-1.091l-4.423-1.106c-.44-.11-.902.055-1.173.417l-.97 1.293c-.282.376-.769.542-1.21.302a12.01 12.01 0 01-5.907-5.907c-.44-.44-.274-.927.102-1.21l1.293-.97a1.125 1.125 0 00.417-1.173L6.963 3.102a1.125 1.125 0 00-1.091-.852H4.5A2.25 2.25 0 002.25 4.5v2.25z" />
                          </svg>
                          <div className="text-sm">
                            <span className="text-gray-500 text-xs block">Phone</span>
                            <a href={`tel:${selectedContact.phone}`} className="text-cyan-400 hover:underline font-medium">
                              {selectedContact.phone}
                            </a>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Email */}
                    {selectedContact.email && (
                      <div className="flex items-center justify-between p-3 bg-[#111827]/20 border border-gray-800/40 rounded-xl">
                        <div className="flex items-center gap-3">
                          <svg className="w-5 h-5 text-gray-400 shrink-0" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75" />
                          </svg>
                          <div className="text-sm">
                            <span className="text-gray-500 text-xs block">Email</span>
                            <a href={`mailto:${selectedContact.email}`} className="text-cyan-400 hover:underline font-medium">
                              {selectedContact.email}
                            </a>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Notes Block */}
                {selectedContact.notes && (
                  <div className="space-y-2">
                    <h4 className="text-xs font-semibold text-cyan-400 uppercase tracking-wider">Personal Notes</h4>
                    <div className="bg-[#111827]/30 border border-gray-800/50 rounded-xl p-4 text-sm text-gray-300 italic whitespace-pre-wrap leading-relaxed">
                      {selectedContact.notes}
                    </div>
                  </div>
                )}

                {/* Recent Touchpoints Block */}
                <div className="space-y-3">
                  <h4 className="text-xs font-semibold text-cyan-400 uppercase tracking-wider">Touchpoint History</h4>
                  {selectedContact.touchpoints && selectedContact.touchpoints.length > 0 ? (
                    <div className="space-y-3">
                      {selectedContact.touchpoints.slice(0, 3).map((tp: any) => (
                        <div key={tp.id} className="text-sm flex flex-col bg-[#111827]/40 p-3.5 rounded-xl border border-gray-800/50">
                          <div className="flex justify-between items-center text-gray-300 mb-1">
                            <span className="font-semibold capitalize text-xs bg-gray-800 px-2 py-0.5 rounded text-gray-400">
                              {tp.channel === 'in_person' ? 'In Person' : tp.channel}
                            </span>
                            <span className="text-xs text-gray-500">
                              {new Date(tp.contact_date).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                            </span>
                          </div>
                          {tp.note && <p className="text-xs text-gray-400 italic mt-1.5 leading-relaxed border-l-2 border-cyan-500/30 pl-2">{tp.note}</p>}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-6 border border-dashed border-gray-800 rounded-xl">
                      <p className="text-sm text-gray-500 italic">No touchpoints logged yet.</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Bottom Actions Footer */}
              <div className="p-6 border-t border-gray-800/80 bg-[#070b14]/50 flex items-center justify-between gap-3">
                {/* View Profile Icon Button */}
                <button
                  onClick={() => router.push(`/contacts/${selectedContact.id}`)}
                  className="w-10 h-10 flex items-center justify-center text-cyan-400 hover:text-cyan-300 border border-cyan-500/50 hover:border-cyan-500 rounded-full hover:bg-cyan-500/10 transition-all duration-200"
                  title="View Profile"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
                  </svg>
                </button>
                <div className="flex gap-2">
                  {/* Reach Out Icon Button */}
                  <button
                    onClick={() => setActiveContactMenu(selectedContact)}
                    className="w-10 h-10 flex items-center justify-center text-gray-400 hover:text-white border border-gray-700 rounded-full hover:border-gray-600 hover:bg-[#111827] transition-all duration-200"
                    title="Reach Out"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 8.25h9m-9 3H12m-9.75 1.51c0 1.6 1.123 2.994 2.707 3.227 1.129.166 2.27.293 3.423.379.35.026.67.21.865.501L12 21l2.755-4.133a1.14 1.14 0 01.865-.501c1.153-.086 2.294-.21 3.423-.379 1.584-.233 2.707-1.626 2.707-3.228V6.741c0-1.602-1.123-2.995-2.707-3.228A48.394 48.394 0 0012 3c-2.392 0-4.744.175-7.043.513C3.373 3.746 2.25 5.14 2.25 6.741v6.018z" />
                    </svg>
                  </button>
                  {/* Log Icon Button */}
                  <button
                    onClick={() => router.push(`/log-touchpoint?contactId=${selectedContact.id}`)}
                    className="w-10 h-10 flex items-center justify-center text-cyan-400 hover:text-white border border-cyan-500/40 rounded-full hover:border-cyan-500 hover:bg-cyan-500/10 transition-all duration-200"
                    title="Log Touchpoint"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
                    </svg>
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Premium Redesigned Contact Menu Modal */}
        {activeContactMenu && (
          <div 
            className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 z-50 animate-fadeIn cursor-default"
            onClick={() => setActiveContactMenu(null)}
          >
            <div 
              className="bg-[#0b1120] border border-gray-800 rounded-3xl max-w-sm w-full overflow-hidden animate-scaleUp shadow-2xl flex flex-col"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header */}
              <div className="px-6 pt-6 pb-4 border-b border-gray-800/80">
                <h3 className="text-xl font-bold text-white">{activeContactMenu.name}</h3>
                <p className="text-xs text-gray-400 uppercase tracking-widest mt-0.5">{activeContactMenu.relationship}</p>
              </div>

              {/* Actions List */}
              <div className="divide-y divide-gray-800/80">
                {activeContactMenu.phone ? (
                  <>
                    {/* Call Row */}
                    <a
                      href={`tel:${activeContactMenu.phone}`}
                      onClick={() => setActiveContactMenu(null)}
                      className="w-full flex items-center justify-between px-6 py-4 hover:bg-[#111827] transition-colors group"
                    >
                      <div className="text-left">
                        <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider block">Phone</span>
                        <div className="text-base font-semibold text-white mt-1 group-hover:text-cyan-300 transition-colors">
                          {activeContactMenu.phone}
                        </div>
                      </div>
                      <div className="text-gray-400 group-hover:text-white transition-colors">
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 6.75c0 8.284 6.716 15 15 15h2.25a2.25 2.25 0 002.25-2.25v-1.372c0-.516-.351-.966-.852-1.091l-4.423-1.106c-.44-.11-.902.055-1.173.417l-.97 1.293c-.282.376-.769.542-1.21.302a12.01 12.01 0 01-5.907-5.907c-.44-.44-.274-.927.102-1.21l1.293-.97a1.125 1.125 0 00.417-1.173L6.963 3.102a1.125 1.125 0 00-1.091-.852H4.5A2.25 2.25 0 002.25 4.5v2.25z" />
                        </svg>
                      </div>
                    </a>

                    {/* Text Row */}
                    <a
                      href={`sms:${activeContactMenu.phone}`}
                      onClick={() => setActiveContactMenu(null)}
                      className="w-full flex items-center justify-between px-6 py-4 hover:bg-[#111827] transition-colors group"
                    >
                      <div className="text-left">
                        <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider block">Text Message</span>
                        <div className="text-base font-semibold text-white mt-1 group-hover:text-cyan-300 transition-colors">
                          {activeContactMenu.phone}
                        </div>
                      </div>
                      <div className="text-gray-400 group-hover:text-white transition-colors">
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 8.25h9m-9 3H12m-9.75 1.51c0 1.6 1.123 2.994 2.707 3.227 1.129.166 2.27.293 3.423.379.35.026.67.21.865.501L12 21l2.755-4.133a1.14 1.14 0 01.865-.501c1.153-.086 2.294-.21 3.423-.379 1.584-.233 2.707-1.626 2.707-3.228V6.741c0-1.602-1.123-2.995-2.707-3.228A48.394 48.394 0 0012 3c-2.392 0-4.744.175-7.043.513C3.373 3.746 2.25 5.14 2.25 6.741v6.018z" />
                        </svg>
                      </div>
                    </a>
                  </>
                ) : (
                  <div className="px-6 py-4 text-center">
                    <p className="text-xs text-gray-400 italic">No phone number configured.</p>
                  </div>
                )}

                {activeContactMenu.email ? (
                  /* Email Row */
                  <a
                    href={`mailto:${activeContactMenu.email}`}
                    onClick={() => setActiveContactMenu(null)}
                    className="w-full flex items-center justify-between px-6 py-4 hover:bg-[#111827] transition-colors group"
                  >
                    <div className="text-left">
                      <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider block">Email</span>
                      <div className="text-base font-semibold text-white mt-1 group-hover:text-cyan-300 transition-colors break-all pr-2">
                        {activeContactMenu.email}
                      </div>
                    </div>
                    <div className="text-gray-400 group-hover:text-white transition-colors">
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75" />
                      </svg>
                    </div>
                  </a>
                ) : (
                  <div className="px-6 py-4 text-center">
                    <p className="text-xs text-gray-400 italic">No email configured.</p>
                  </div>
                )}
              </div>

              {/* Close & Edit Profile Button Panel */}
              <div className="p-6 bg-[#070b14]/50 border-t border-gray-800/80 flex items-center justify-between gap-3">
                <button
                  onClick={() => {
                    router.push(`/contacts/${activeContactMenu.id}?edit=true`);
                    setActiveContactMenu(null);
                  }}
                  className="py-2.5 px-4 border border-cyan-500/50 hover:border-cyan-500 text-cyan-400 hover:text-cyan-300 rounded-xl text-sm font-semibold transition-colors text-center flex-1"
                >
                  Edit
                </button>
                <button
                  onClick={() => setActiveContactMenu(null)}
                  className="py-2.5 px-4 bg-gray-800 hover:bg-gray-700 text-white font-semibold rounded-xl transition-colors text-sm flex-1 text-center"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
