"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useRouter } from "next/navigation";
import type { User } from "@supabase/supabase-js";
import cityTimezones from "city-timezones";

interface Contact {
  id: string;
  name: string;
  relationship: string;
  location?: string;
  cadence_days: number;
  last_contact_date?: string;
  last_contact_channel?: string;
  days_since_last_contact?: number;
  status: "overdue" | "coming_up" | "on_track";
  days_until_due?: number;
  days_overdue?: number;
}

export default function Home() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const router = useRouter();

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
      // Fetch all contacts
      const { data: contactsData, error: contactsError } = await supabase
        .from("contacts")
        .select("*")
        .eq("user_id", userId)
        .order("name", { ascending: true });

      if (contactsError) throw contactsError;
      if (!contactsData) return;

      // For each contact, get the last touchpoint
      const contactsWithStatus = await Promise.all(
        contactsData.map(async (contact) => {
          const { data: lastTouchpoint } = await supabase
            .from("touchpoints")
            .select("contact_date, channel")
            .eq("contact_id", contact.id)
            .order("contact_date", { ascending: false })
            .limit(1)
            .single();

          const today = new Date();
          today.setHours(0, 0, 0, 0);
          
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

          return {
            ...contact,
            last_contact_date: lastTouchpoint?.contact_date,
            last_contact_channel: lastTouchpoint?.channel,
            days_since_last_contact: daysSinceLastContact,
            status,
            days_until_due: daysUntilDue,
            days_overdue: daysOverdue,
          };
        })
      );

      setContacts(contactsWithStatus);
    } catch (error) {
      console.error("Error loading contacts:", error);
    }
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    router.push("/auth");
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
      return "Last touch: Never contacted";
    }
    const days = contact.days_since_last_contact || 0;
    const channel = contact.last_contact_channel || "unknown";
    if (days === 0) return "Last touch: Today";
    if (days === 1) return "Last touch: Yesterday";
    return `Last touch: ${days} days ago (${channel})`;
  };

  // Map locations to timezones using city-timezones library
  const getTimezoneFromLocation = (location?: string): string | null => {
    if (!location) return null;
    
    const locationLower = location.toLowerCase().trim();
    
    // Try to find the city in the location string
    // Handle formats like "New York, NY", "NYC", "New York", etc.
    
    // First, try to find an exact or partial match using city-timezones
    const cityMatches = cityTimezones.lookupViaCity(location);
    
    if (cityMatches && cityMatches.length > 0) {
      // Return the first match's timezone
      return cityMatches[0].timezone;
    }
    
    // If no direct match, try to extract city name from common formats
    // e.g., "New York, NY" -> "New York"
    const cityName = locationLower.split(',')[0].trim();
    if (cityName && cityName !== locationLower) {
      const cityMatches2 = cityTimezones.lookupViaCity(cityName);
      if (cityMatches2 && cityMatches2.length > 0) {
        return cityMatches2[0].timezone;
      }
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

  const getLocalTime = (location?: string): string | null => {
    const timezone = getTimezoneFromLocation(location);
    if (!timezone) return null;

    try {
      const now = new Date();
      const formatter = new Intl.DateTimeFormat("en-US", {
        timeZone: timezone,
        hour: "numeric",
        minute: "2-digit",
        hour12: true,
      });
      return formatter.format(now);
    } catch (error) {
      return null;
    }
  };

  // Filter contacts by search query
  const filterContacts = (contactList: Contact[]) => {
    if (!searchQuery.trim()) return contactList;
    
    const query = searchQuery.toLowerCase().trim();
    return contactList.filter((contact) => {
      const nameMatch = contact.name.toLowerCase().includes(query);
      const relationshipMatch = contact.relationship.toLowerCase().includes(query);
      const locationMatch = contact.location?.toLowerCase().includes(query);
      return nameMatch || relationshipMatch || locationMatch;
    });
  };

  const allComingUpContacts = contacts.filter((c) => c.status === "coming_up" || c.status === "overdue");
  const allOnTrackContacts = contacts.filter((c) => c.status === "on_track");
  
  const comingUpContacts = filterContacts(allComingUpContacts);
  const onTrackContacts = filterContacts(allOnTrackContacts);

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
              <button
                onClick={() => router.push("/add-contact")}
                className="px-3 sm:px-4 py-2 text-sm bg-cyan-500 hover:bg-cyan-600 text-white rounded-md transition-colors"
              >
                <span className="hidden sm:inline">+ Add Contact</span>
                <span className="sm:hidden">+ Add</span>
              </button>
              <button
                onClick={() => router.push("/settings")}
                className="p-2 sm:px-3 sm:py-2 text-gray-400 hover:text-white border border-gray-700 rounded-md hover:border-gray-600 transition-colors"
                title="Settings"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
              </button>
              <button
                onClick={handleSignOut}
                className="p-2 sm:px-3 sm:py-2 text-gray-400 hover:text-white border border-gray-700 rounded-md hover:border-gray-600 transition-colors"
                title="Sign Out"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                </svg>
              </button>
            </div>
          </div>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search contacts..."
            className="w-full px-4 py-2 bg-[#111827] border border-gray-700 rounded-md text-white text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500 placeholder-gray-500"
          />
        </div>

        {/* Coming Up Section (includes overdue) */}
        {(comingUpContacts.length > 0 || !searchQuery.trim()) && (
          <div className="mb-8">
            <div className="mb-4">
              <h3 className="text-2xl font-bold text-white">
                Get in touch:
              </h3>
            </div>
            {comingUpContacts.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {comingUpContacts.map((contact) => (
                <div
                  key={contact.id}
                  className="bg-[#0b1120] border border-gray-800 rounded-lg p-6 opacity-90 hover:opacity-100 hover:border-cyan-500/50 transition-all"
                >
                  <div className="mb-4">
                    <h4 className="text-lg font-semibold text-white mb-1">
                      {contact.name}
                    </h4>
                    <p className="text-sm text-gray-400">
                      {contact.relationship}
                      {contact.location && (
                        <>
                          {` • ${contact.location}`}
                          {getLocalTime(contact.location) && ` (${getLocalTime(contact.location)})`}
                        </>
                      )}
                    </p>
                  </div>

                  <div className="space-y-2 mb-4">
                    <p className="text-sm text-gray-300">
                      {formatLastContact(contact)}
                    </p>
                    <div className="flex items-center gap-2">
                      <span className="text-xs px-2 py-1 bg-gray-800 text-gray-300 rounded">
                        {formatCadence(contact.cadence_days)}
                      </span>
                      {contact.status === "overdue" && contact.days_overdue !== undefined ? (
                        <span className="text-xs text-red-400">
                          Overdue by {contact.days_overdue} day
                          {contact.days_overdue !== 1 ? "s" : ""}
                        </span>
                      ) : (
                        <span className="text-xs text-yellow-400">
                          Due in {contact.days_until_due} day
                          {contact.days_until_due !== 1 ? "s" : ""}
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="flex gap-2">
                    <button
                      onClick={() => router.push(`/log-touchpoint?contactId=${contact.id}`)}
                      className="flex-1 bg-cyan-500 hover:bg-cyan-600 text-white py-2 px-3 sm:px-4 rounded-md text-sm font-medium transition-colors"
                    >
                      <span className="hidden sm:inline">Log touchpoint</span>
                      <span className="sm:hidden">Log</span>
                    </button>
                    <button
                      onClick={() => router.push(`/contacts/${contact.id}`)}
                      className="px-4 py-2 text-sm text-gray-400 hover:text-white border border-gray-700 rounded-md hover:border-gray-600 transition-colors"
                    >
                      View
                    </button>
                  </div>
                </div>
              ))}
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
            <h3 className="text-2xl font-bold text-white mb-4">
              Already in touch:
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {onTrackContacts.map((contact) => (
                <div
                  key={contact.id}
                  className="bg-[#0b1120] border border-gray-800 rounded-lg p-6 opacity-75 hover:opacity-100 hover:border-gray-700 transition-all"
                >
                  <div className="mb-4">
                    <h4 className="text-lg font-semibold text-white mb-1">
                      {contact.name}
                    </h4>
                    <p className="text-sm text-gray-400">
                      {contact.relationship}
                      {contact.location && (
                        <>
                          {` • ${contact.location}`}
                          {getLocalTime(contact.location) && ` (${getLocalTime(contact.location)})`}
                        </>
                      )}
                    </p>
                  </div>

                  <div className="space-y-2 mb-4">
                    <p className="text-sm text-gray-300">
                      {formatLastContact(contact)}
                    </p>
                    <div className="flex items-center gap-2">
                      <span className="text-xs px-2 py-1 bg-gray-800 text-gray-300 rounded">
                        {formatCadence(contact.cadence_days)}
                      </span>
                      {contact.days_until_due !== undefined && (
                        <span className="text-xs text-green-400">
                          Due in {contact.days_until_due} days
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="flex gap-2">
                    <button
                      onClick={() => router.push(`/log-touchpoint?contactId=${contact.id}`)}
                      className="flex-1 bg-cyan-500 hover:bg-cyan-600 text-white py-2 px-3 sm:px-4 rounded-md text-sm font-medium transition-colors"
                    >
                      <span className="hidden sm:inline">Log touchpoint</span>
                      <span className="sm:hidden">Log</span>
                    </button>
                    <button
                      onClick={() => router.push(`/contacts/${contact.id}`)}
                      className="px-4 py-2 text-sm text-gray-400 hover:text-white border border-gray-700 rounded-md hover:border-gray-600 transition-colors"
                    >
                      View
                    </button>
                  </div>
                </div>
              ))}
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
