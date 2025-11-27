"use client";

import { useEffect, useState, useMemo, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import { useRouter } from "next/navigation";
import type { User } from "@supabase/supabase-js";
import cityTimezones from "city-timezones";

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
  const [openContactMenu, setOpenContactMenu] = useState<string | null>(null);
  const router = useRouter();

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

  // Close contact menu when clicking outside
  useEffect(() => {
    const handleClickOutside = () => {
      setOpenContactMenu(null);
    };
    if (openContactMenu) {
      document.addEventListener("click", handleClickOutside);
      return () => document.removeEventListener("click", handleClickOutside);
    }
  }, [openContactMenu]);

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
        .select("contact_id, contact_date, channel")
        .in("contact_id", contactIds)
        .order("contact_date", { ascending: false });

      if (touchpointsError) throw touchpointsError;

      // Group touchpoints by contact_id and get the latest one for each
      const lastTouchpointMap = new Map<string, { contact_date: string; channel: string }>();
      if (allTouchpoints) {
        allTouchpoints.forEach(tp => {
          if (!lastTouchpointMap.has(tp.contact_id)) {
            lastTouchpointMap.set(tp.contact_id, {
              contact_date: tp.contact_date,
              channel: tp.channel
            });
          }
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

  // Map locations to timezones using city-timezones library
  const getTimezoneFromCityCountry = (city?: string | null, country?: string | null): string | null => {
    if (!city && !country) return null;
    
    // If we have both city and country, use them for precise lookup
    if (city && country) {
      const cityMatches = cityTimezones.lookupViaCity(city);
      if (cityMatches && cityMatches.length > 0) {
        // Filter by country if multiple matches
        if (cityMatches.length > 1) {
          const countryMatch = cityMatches.find(match => {
            const matchStr = JSON.stringify(match).toLowerCase();
            return matchStr.includes(country.toLowerCase());
          });
          if (countryMatch) {
            return countryMatch.timezone;
          }
        }
        return cityMatches[0].timezone;
      }
    }
    
    // Fallback to city only
    if (city) {
      const cityMatches = cityTimezones.lookupViaCity(city);
      if (cityMatches && cityMatches.length > 0) {
        return cityMatches[0].timezone;
      }
    }
    
    return null;
  };

  // Legacy function for backward compatibility with location field
  const getTimezoneFromLocation = (location?: string | null): string | null => {
    if (!location) return null;
    
    const locationLower = location.toLowerCase().trim();
    const locationOriginal = location.trim();
    
    // US state abbreviations mapping (full names and abbreviations)
    const stateAbbreviations: { [key: string]: string } = {
      "california": "CA",
      "ca": "CA",
      "new york": "NY",
      "ny": "NY",
      "texas": "TX",
      "tx": "TX",
      "florida": "FL",
      "fl": "FL",
      "illinois": "IL",
      "il": "IL",
      "pennsylvania": "PA",
      "pa": "PA",
      "ohio": "OH",
      "oh": "OH",
      "georgia": "GA",
      "ga": "GA",
      "north carolina": "NC",
      "nc": "NC",
      "michigan": "MI",
      "mi": "MI",
    };
    
    // Helper function to extract state from location
    const extractState = (loc: string): { stateAbbr: string | null; stateName: string | null } => {
      const locLower = loc.toLowerCase();
      let stateAbbr: string | null = null;
      let stateName: string | null = null;
      
      if (loc.includes(',')) {
        const parts = loc.split(',');
        const statePart = parts[parts.length - 1].trim().toLowerCase();
        stateAbbr = stateAbbreviations[statePart] || statePart.toUpperCase();
        stateName = statePart;
      } else {
        const words = locLower.split(/\s+/);
        const lastWord = words[words.length - 1];
        if (stateAbbreviations[lastWord]) {
          stateAbbr = stateAbbreviations[lastWord];
          stateName = lastWord;
        } else if (lastWord.length === 2) {
          stateAbbr = lastWord.toUpperCase();
        } else {
          // Check if it's a full state name
          for (const [key, abbr] of Object.entries(stateAbbreviations)) {
            if (locLower.includes(key) && key.length > 2) {
              stateAbbr = abbr;
              stateName = key;
              break;
            }
          }
        }
      }
      
      return { stateAbbr, stateName };
    };
    
    // Helper function to check if a match is in the specified state
    const isMatchInState = (match: any, stateAbbr: string | null, stateName: string | null): boolean => {
      if (!stateAbbr && !stateName) return false;
      
      // Check multiple possible fields
      const matchStr = JSON.stringify(match).toLowerCase();
      const stateAbbrLower = stateAbbr?.toLowerCase() || '';
      const stateNameLower = stateName?.toLowerCase() || '';
      
      // Check if any field contains the state abbreviation or name
      if (stateAbbrLower && matchStr.includes(stateAbbrLower)) return true;
      if (stateNameLower && matchStr.includes(stateNameLower)) return true;
      
      // Check specific fields that might exist
      if (match.province) {
        const provinceUpper = match.province.toUpperCase();
        if (stateAbbr && provinceUpper === stateAbbr) return true;
        if (stateName && match.province.toLowerCase().includes(stateNameLower)) return true;
      }
      
      if (match.state) {
        const stateUpper = match.state.toUpperCase();
        if (stateAbbr && stateUpper === stateAbbr) return true;
        if (stateName && match.state.toLowerCase().includes(stateNameLower)) return true;
      }
      
      if (match.iso2 && stateAbbr && match.iso2.toUpperCase() === stateAbbr) return true;
      
      return false;
    };
    
    // Extract city name from location
    let cityName: string | null = null;
    
    if (locationOriginal.includes(',')) {
      // Format: "City, State"
      cityName = locationOriginal.split(',')[0].trim();
    } else {
      // Format: "City State" - extract city name
      const words = locationOriginal.split(/\s+/);
      if (words.length >= 2) {
        const lastWord = words[words.length - 1].toLowerCase();
        // Check if last word is a state
        if (stateAbbreviations[lastWord] || lastWord.length === 2) {
          cityName = words.slice(0, -1).join(' ');
        } else {
          // Check if location contains a state name
          const { stateName: extractedStateName } = extractState(locationOriginal);
          if (extractedStateName && locationLower.includes(extractedStateName)) {
            // Remove state name from location to get city
            cityName = locationOriginal.replace(new RegExp(extractedStateName, 'i'), '').trim();
          } else {
            // Try first two words as city name
            cityName = words.slice(0, 2).join(' ');
          }
        }
      } else {
        cityName = locationOriginal;
      }
    }
    
    // Extract state information
    const { stateAbbr, stateName } = extractState(locationOriginal);
    
    // Try to find matches using the extracted city name
    if (cityName) {
      let cityMatches = cityTimezones.lookupViaCity(cityName);
      
      if (cityMatches && cityMatches.length > 0) {
        // If we have state info and multiple matches, filter by state
        if (cityMatches.length > 1 && (stateAbbr || stateName)) {
          const stateMatch = cityMatches.find(match => 
            isMatchInState(match, stateAbbr, stateName)
          );
          if (stateMatch) {
            return stateMatch.timezone;
          }
        }
        
        // For US cities, prioritize Pacific timezone for California
        if (stateAbbr === "CA" || stateName === "california") {
          const caMatch = cityMatches.find(match => 
            match.timezone === "America/Los_Angeles" || 
            match.timezone?.includes("Los_Angeles") ||
            isMatchInState(match, "CA", "california")
          );
          if (caMatch) {
            return caMatch.timezone;
          }
        }
        
        // Return first match if no state filtering worked
        return cityMatches[0].timezone;
      }
    }
    
    // Fallback: try the original location string
    let cityMatches = cityTimezones.lookupViaCity(locationOriginal);
    if (cityMatches && cityMatches.length > 0) {
      if (cityMatches.length > 1 && (stateAbbr || stateName)) {
        const stateMatch = cityMatches.find(match => 
          isMatchInState(match, stateAbbr, stateName)
        );
        if (stateMatch) {
          return stateMatch.timezone;
        }
      }
      return cityMatches[0].timezone;
    }
    
    // Try common abbreviations and aliases
    const abbreviations: { [key: string]: string } = {
      "ny": "New York",
      "nyc": "New York",
      "la": "Los Angeles",
      "sf": "San Francisco",
      "dc": "Washington",
    };
    
    if (abbreviations[locationLower]) {
      const cityMatches3 = cityTimezones.lookupViaCity(abbreviations[locationLower]);
      if (cityMatches3 && cityMatches3.length > 0) {
        return cityMatches3[0].timezone;
      }
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

    // Prefer city + country over location
    let timezone: string | null = null;
    if (city || country) {
      timezone = getTimezoneFromCityCountry(city, country);
    }
    // Fallback to location for backward compatibility
    if (!timezone && location) {
      timezone = getTimezoneFromLocation(location);
    }
    
    if (!timezone) {
      localTimeCacheRef.set(cacheKey, null);
      return null;
    }

    try {
      const now = new Date();
      const formatter = new Intl.DateTimeFormat("en-US", {
        timeZone: timezone,
        hour: "numeric",
        minute: "2-digit",
        hour12: true,
      });
      const result = formatter.format(now);
      localTimeCacheRef.set(cacheKey, result);
      return result;
    } catch (error) {
      localTimeCacheRef.set(cacheKey, null);
      return null;
    }
  }, [localTimeCacheRef]);

  // Filter contacts by search query
  const filterContacts = (contactList: Contact[]) => {
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
  };

  const allComingUpContacts = contacts.filter((c) => c.status === "coming_up" || c.status === "overdue");
  const allOnTrackContacts = contacts.filter((c) => c.status === "on_track");
  
  // Sort contacts
  const sortContacts = (contactList: Contact[], sortMode: "next_touch" | "name"): Contact[] => {
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
  };
  
  const comingUpContacts = sortContacts(filterContacts(allComingUpContacts), comingUpSort);
  const onTrackContacts = sortContacts(filterContacts(allOnTrackContacts), onTrackSort);

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
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {comingUpContacts.map((contact) => {
                const birthdayInfo = getBirthdayInfo(contact.birthday);
                const hasUpcomingBirthday = birthdayInfo !== null;
                const isPinned = contact.is_pinned === true;
                
                return (
                <div
                  key={contact.id}
                  className={`bg-[#0b1120] rounded-lg p-4 opacity-90 hover:opacity-100 transition-all relative ${
                    hasUpcomingBirthday 
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

                  <div className="flex gap-2">
                    <button
                      onClick={() => router.push(`/log-touchpoint?contactId=${contact.id}`)}
                      className="flex-[1_1_0%] box-border bg-cyan-500 hover:bg-cyan-600 text-white py-2 px-3 rounded-md text-sm font-medium transition-colors border border-transparent"
                    >
                      Log
                    </button>
                    <button
                      onClick={() => router.push(`/contacts/${contact.id}`)}
                      className="flex-[1_1_0%] box-border py-2 px-3 text-sm text-gray-400 hover:text-white border border-gray-700 rounded-md hover:border-gray-600 transition-colors"
                    >
                      View
                    </button>
                    {isMobile && (
                      <div className="relative flex-[1_1_0%] min-w-0 box-border">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setOpenContactMenu(openContactMenu === contact.id ? null : contact.id);
                          }}
                          className="w-full box-border py-2 px-3 text-sm text-gray-400 hover:text-white border border-gray-700 rounded-md hover:border-gray-600 transition-colors"
                        >
                          Contact
                        </button>
                        {openContactMenu === contact.id && (
                          <div className="absolute bottom-full left-0 mb-2 w-full bg-[#0b1120] border border-gray-700 rounded-lg shadow-lg overflow-hidden z-30">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setOpenContactMenu(null);
                                
                                // Programmatically open phone dialer
                                // iOS requires a number for tel: to work, so we use a minimal placeholder
                                // Using "0" as a minimal number - user can clear it in the dialer
                                const isChromeIOS = /CriOS/.test(navigator.userAgent);
                                const telLink = 'tel:0';
                                
                                if (isChromeIOS) {
                                  // Chrome on iOS: use window.open
                                  window.open(telLink, '_self');
                                } else {
                                  // Safari and other browsers: create and click a link programmatically
                                  // This ensures it's treated as a user-initiated action
                                  const link = document.createElement('a');
                                  link.href = telLink;
                                  link.style.position = 'absolute';
                                  link.style.left = '-9999px';
                                  document.body.appendChild(link);
                                  link.click();
                                  // Clean up immediately
                                  setTimeout(() => {
                                    if (document.body.contains(link)) {
                                      document.body.removeChild(link);
                                    }
                                  }, 0);
                                }
                              }}
                              className="w-full px-4 py-2 text-sm text-gray-300 hover:bg-[#111827] hover:text-white transition-colors flex items-center gap-2 text-left"
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 6.75c0 8.284 6.716 15 15 15h2.25a2.25 2.25 0 002.25-2.25v-1.372c0-.516-.351-.966-.852-1.091l-4.423-1.106c-.44-.11-.902.055-1.173.417l-.97 1.293c-.282.376-.769.542-1.21.38a12.035 12.035 0 01-7.143-7.143c-.162-.441.004-.928.38-1.21l1.293-.97c.363-.271.527-.734.417-1.173L6.963 3.102a1.125 1.125 0 00-1.091-.852H4.5A2.25 2.25 0 002.25 4.5v2.25z" />
                              </svg>
                              Call
                            </button>
                            <a
                              href="sms:"
                              onClick={(e) => {
                                e.stopPropagation();
                                setOpenContactMenu(null);
                              }}
                              className="block px-4 py-2 text-sm text-gray-300 hover:bg-[#111827] hover:text-white transition-colors flex items-center gap-2 border-t border-gray-700"
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M8.625 12a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H8.25m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H12m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0h-.375M21 12c0 4.556-4.03 8.25-9 8.25a9.764 9.764 0 01-2.555-.337A5.972 5.972 0 015.41 20.97a5.969 5.969 0 01-.474-.065 4.48 4.48 0 00.978-2.025c.09-.457-.133-.901-.467-1.226C3.93 16.178 3 14.189 3 12c0-4.556 4.03-8.25 9-8.25s9 3.694 9 8.25z" />
                              </svg>
                              Text
                            </a>
                          </div>
                        )}
                      </div>
                    )}
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
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {onTrackContacts.map((contact) => {
                const birthdayInfo = getBirthdayInfo(contact.birthday);
                const hasUpcomingBirthday = birthdayInfo !== null;
                const isPinned = contact.is_pinned === true;
                
                return (
                <div
                  key={contact.id}
                  className={`bg-[#0b1120] rounded-lg p-4 opacity-75 hover:opacity-100 transition-all relative ${
                    hasUpcomingBirthday 
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

                  <div className="flex gap-2">
                    <button
                      onClick={() => router.push(`/log-touchpoint?contactId=${contact.id}`)}
                      className="flex-1 bg-cyan-500 hover:bg-cyan-600 text-white py-2 px-3 rounded-md text-sm font-medium transition-colors"
                    >
                      Log
                    </button>
                    {isMobile && (
                      <div className="relative flex-1">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setOpenContactMenu(openContactMenu === contact.id ? null : contact.id);
                          }}
                          className="w-full py-2 px-3 text-sm text-gray-400 hover:text-white border border-gray-700 rounded-md hover:border-gray-600 transition-colors"
                        >
                          Contact
                        </button>
                        {openContactMenu === contact.id && (
                          <div className="absolute bottom-full left-0 mb-2 w-full bg-[#0b1120] border border-gray-700 rounded-lg shadow-lg overflow-hidden z-30">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setOpenContactMenu(null);
                                
                                // Programmatically open phone dialer
                                // iOS requires a number for tel: to work, so we use a minimal placeholder
                                // Using "0" as a minimal number - user can clear it in the dialer
                                const isChromeIOS = /CriOS/.test(navigator.userAgent);
                                const telLink = 'tel:0';
                                
                                if (isChromeIOS) {
                                  // Chrome on iOS: use window.open
                                  window.open(telLink, '_self');
                                } else {
                                  // Safari and other browsers: create and click a link programmatically
                                  // This ensures it's treated as a user-initiated action
                                  const link = document.createElement('a');
                                  link.href = telLink;
                                  link.style.position = 'absolute';
                                  link.style.left = '-9999px';
                                  document.body.appendChild(link);
                                  link.click();
                                  // Clean up immediately
                                  setTimeout(() => {
                                    if (document.body.contains(link)) {
                                      document.body.removeChild(link);
                                    }
                                  }, 0);
                                }
                              }}
                              className="w-full px-4 py-2 text-sm text-gray-300 hover:bg-[#111827] hover:text-white transition-colors flex items-center gap-2 text-left"
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 6.75c0 8.284 6.716 15 15 15h2.25a2.25 2.25 0 002.25-2.25v-1.372c0-.516-.351-.966-.852-1.091l-4.423-1.106c-.44-.11-.902.055-1.173.417l-.97 1.293c-.282.376-.769.542-1.21.38a12.035 12.035 0 01-7.143-7.143c-.162-.441.004-.928.38-1.21l1.293-.97c.363-.271.527-.734.417-1.173L6.963 3.102a1.125 1.125 0 00-1.091-.852H4.5A2.25 2.25 0 002.25 4.5v2.25z" />
                              </svg>
                              Call
                            </button>
                            <a
                              href="sms:"
                              onClick={(e) => {
                                e.stopPropagation();
                                setOpenContactMenu(null);
                              }}
                              className="block px-4 py-2 text-sm text-gray-300 hover:bg-[#111827] hover:text-white transition-colors flex items-center gap-2 border-t border-gray-700"
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M8.625 12a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H8.25m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H12m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0h-.375M21 12c0 4.556-4.03 8.25-9 8.25a9.764 9.764 0 01-2.555-.337A5.972 5.972 0 015.41 20.97a5.969 5.969 0 01-.474-.065 4.48 4.48 0 00.978-2.025c.09-.457-.133-.901-.467-1.226C3.93 16.178 3 14.189 3 12c0-4.556 4.03-8.25 9-8.25s9 3.694 9 8.25z" />
                              </svg>
                              Text
                            </a>
                          </div>
                        )}
                      </div>
                    )}
                    <button
                      onClick={() => router.push(`/contacts/${contact.id}`)}
                      className="flex-[1_1_0%] box-border py-2 px-3 text-sm text-gray-400 hover:text-white border border-gray-700 rounded-md hover:border-gray-600 transition-colors"
                    >
                      View
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
      </div>
    </div>
  );
}
