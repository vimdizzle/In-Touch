"use client";

import { useEffect, useState, useMemo, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import { useRouter } from "next/navigation";
import type { User } from "@supabase/supabase-js";
import { 
  getLocalTime as getLocalTimeUtil, 
  formatBirthdayForDB, 
  parseBirthday, 
  parseVCard,
  RELATIONSHIPS,
  CADENCE_PRESETS,
  MONTHS,
  getDaysInMonth,
  Contact,
  Touchpoint,
  ImportingContactDraft
} from "@/lib/utils";
import VCardImportReviewModal from "@/app/components/VCardImportReviewModal";

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

  // ==========================================
  // SPA MODAL & PROFILE DRAWER STATES
  // ==========================================

  // 1. Add Contact Modal States
  const [isAddContactOpen, setIsAddContactOpen] = useState(false);
  const [addName, setAddName] = useState("");
  const [addRelationship, setAddRelationship] = useState("Friend");
  const [addPhone, setAddPhone] = useState("");
  const [addEmail, setAddEmail] = useState("");
  const [addCadenceDays, setAddCadenceDays] = useState(30);
  const [addCity, setAddCity] = useState("");
  const [addCountry, setAddCountry] = useState("");
  const [addBirthdayMonth, setAddBirthdayMonth] = useState("");
  const [addBirthdayDay, setAddBirthdayDay] = useState("");
  const [addNotes, setAddNotes] = useState("");
  const [addLastTouchpointDate, setAddLastTouchpointDate] = useState("");
  const [addSaving, setAddSaving] = useState(false);
  const [addError, setAddError] = useState("");
  const [addSuccess, setAddSuccess] = useState<string | null>(null);

  // Automated Importing states

  const [importingContacts, setImportingContacts] = useState<ImportingContactDraft[]>([]);
  const [isImportReviewOpen, setIsImportReviewOpen] = useState(false);
  const [isImportGuideOpen, setIsImportGuideOpen] = useState(false);
  const [importGuideTab, setImportGuideTab] = useState<"google" | "android" | "ios">("google");
  const [importStatus, setImportStatus] = useState<{ type: "success" | "error" | "warning"; message: string } | null>(null);


  // 2. Settings Modal States
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [settingsName, setSettingsName] = useState("");
  const [settingsDefaultCadence, setSettingsDefaultCadence] = useState(30);
  const [settingsSaving, setSettingsSaving] = useState(false);
  const [settingsSuccess, setSettingsSuccess] = useState(false);
  const [settingsError, setSettingsError] = useState("");
  const [showSettingsDeleteConfirm, setShowSettingsDeleteConfirm] = useState(false);
  const [settingsDeleting, setSettingsDeleting] = useState(false);

  // 3. Log Touchpoint Modal States
  const [logTouchpointContactId, setLogTouchpointContactId] = useState<string | null>(null);
  const [logChannel, setLogChannel] = useState("call");
  const [logDate, setLogDate] = useState(new Date().toISOString().split("T")[0]);
  const [logNote, setLogNote] = useState("");
  const [logSaving, setLogSaving] = useState(false);
  const [logError, setLogError] = useState("");

  // 4. Upgraded Profile Drawer States
  const [isEditingContact, setIsEditingContact] = useState(false);
  const [editName, setEditName] = useState("");
  const [editRelationship, setEditRelationship] = useState("Friend");
  const [editPhone, setEditPhone] = useState("");
  const [editEmail, setEditEmail] = useState("");
  const [editCadenceDays, setEditCadenceDays] = useState(30);
  const [editCity, setEditCity] = useState("");
  const [editCountry, setEditCountry] = useState("");
  const [editBirthdayMonth, setEditBirthdayMonth] = useState("");
  const [editBirthdayDay, setEditBirthdayDay] = useState("");
  const [editNotes, setEditNotes] = useState("");
  
  const [isEditingNotes, setIsEditingNotes] = useState(false);
  const [notesText, setNotesText] = useState("");
  const [notesSaving, setNotesSaving] = useState(false);

  const [drawerVisibleCount, setDrawerVisibleCount] = useState(3);
  
  const [editingTouchpointId, setEditingTouchpointId] = useState<string | null>(null);
  const [editTouchpointChannel, setEditTouchpointChannel] = useState("call");
  const [editTouchpointDate, setEditTouchpointDate] = useState("");
  const [editTouchpointNote, setEditTouchpointNote] = useState("");
  
  const [showDeleteTouchpointConfirm, setShowDeleteTouchpointConfirm] = useState<string | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [drawerSaving, setDrawerSaving] = useState(false);
  const [drawerError, setDrawerError] = useState("");

  const toggleExpand = (id: string) => {
    setExpandedId(prev => prev === id ? null : id);
    // Reset editing states on switch
    setIsEditingContact(false);
    setIsEditingNotes(false);
    setDrawerVisibleCount(3);
    setEditingTouchpointId(null);
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
    // Detect if this page load is an OAuth callback (hash fragment from implicit flow)
    const isOAuthCallback = typeof window !== "undefined" && (
      window.location.hash.includes("access_token") || 
      window.location.search.includes("code=")
    );

    if (isOAuthCallback) {
      console.log("OAuth callback detected on main page — Supabase will auto-process the token");
      // DO NOT clean the URL here — Supabase needs to read the hash fragment first
    }

    // Fail-safe timeout for OAuth callbacks
    const fallbackTimer = setTimeout(() => {
      if (isOAuthCallback && loading) {
        console.warn("OAuth callback timed out after 12 seconds.");
        // Clean URL and stop loading so user isn't stuck
        window.history.replaceState({}, "", window.location.pathname);
        setLoading(false);
      }
    }, 12000);

    // Check for an existing session
    // With implicit flow + detectSessionInUrl, Supabase auto-parses the #access_token
    // during client init, so getSession() should already have the session
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (session) {
        clearTimeout(fallbackTimer);
        console.log("Session found for user:", session.user.email);
        // Clean URL if it has OAuth params
        if (isOAuthCallback) {
          window.history.replaceState({}, "", window.location.pathname);
        }
        setUser(session.user);
        await loadContacts(session.user.id);
        setLoading(false);
      } else if (!isOAuthCallback) {
        clearTimeout(fallbackTimer);
        router.push("/auth");
        setLoading(false);
      }
      // If isOAuthCallback but no session yet, onAuthStateChange below will catch it
    });

    // Listen for auth state changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (_event, session) => {
      console.log("Auth state change:", _event, session ? "has session" : "no session");
      if (session) {
        clearTimeout(fallbackTimer);
        // Clean URL if it has OAuth params
        if (typeof window !== "undefined" && (window.location.hash.includes("access_token") || window.location.search.includes("code="))) {
          window.history.replaceState({}, "", window.location.pathname);
        }
        setUser(session.user);
        await loadContacts(session.user.id);
        setLoading(false);
      } else if (_event === "SIGNED_OUT") {
        clearTimeout(fallbackTimer);
        setUser(null);
        router.push("/auth");
        setLoading(false);
      }
    });

    return () => {
      clearTimeout(fallbackTimer);
      subscription.unsubscribe();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
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




  // vCard (.vcf) File Parser for dashboard
  const handleVcfUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setAddError("");
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
        setIsImportReviewOpen(true);
      } catch (err: any) {
        console.error("vCard parsing error:", err);
        setImportStatus({
          type: "error",
          message: "Failed to parse .vcf file. Make sure it is in valid vCard format.",
        });
      }
    };
    reader.readAsText(file);
    e.target.value = "";
  };



  // ==========================================
  // SPA MODAL & DRAWER INTERACTION HANDLERS
  // ==========================================

  // 1. Add Contact Modal Submission
  const handleAddContactSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!addName.trim() || !user) return;
    setAddSaving(true);
    setAddError("");
    try {
      const birthdayForDB = formatBirthdayForDB(addBirthdayMonth, addBirthdayDay);
      const { data, error } = await supabase
        .from("contacts")
        .insert([
          {
            user_id: user.id,
            name: addName.trim(),
            relationship: addRelationship,
            cadence_days: addCadenceDays,
            city: addCity.trim() || null,
            country: addCountry.trim() || null,
            birthday: birthdayForDB,
            notes: addNotes.trim() || null,
            phone: addPhone.trim() || null,
            email: addEmail.trim() || null,
          },
        ])
        .select()
        .single();

      if (error) throw error;

      // If last touchpoint date is provided, create a touchpoint
      if (addLastTouchpointDate && data.id) {
        const { error: touchpointError } = await supabase
          .from("touchpoints")
          .insert([
            {
              contact_id: data.id,
              channel: "other",
              contact_date: addLastTouchpointDate,
              note: "Initial touchpoint",
            },
          ]);

        if (touchpointError) {
          console.error("Error creating touchpoint:", touchpointError);
        }
      }

      await loadContacts(user.id);
      
      // Close modal and reset
      setIsAddContactOpen(false);
      setAddName("");
      setAddCity("");
      setAddCountry("");
      setAddBirthdayMonth("");
      setAddBirthdayDay("");
      setAddNotes("");
      setAddPhone("");
      setAddEmail("");
      setAddLastTouchpointDate("");
      setAddRelationship("Friend");
      setAddCadenceDays(30);
    } catch (err: any) {
      setAddError(err.message || "Failed to add contact");
    } finally {
      setAddSaving(false);
    }
  };

  // 2. Settings Modal Helpers
  const handleOpenSettings = async () => {
    if (!user) return;
    setIsSettingsOpen(true);
    setSettingsError("");
    setSettingsSuccess(false);
    try {
      const { data, error } = await supabase
        .from("users")
        .select("*")
        .eq("id", user.id)
        .single();
      
      if (error && error.code !== "PGRST116") {
        console.error("Error loading settings:", error);
      }
      
      if (data) {
        setSettingsName(data.name || "");
        setSettingsDefaultCadence(data.default_cadence_days || 30);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setSettingsSaving(true);
    setSettingsError("");
    setSettingsSuccess(false);
    try {
      const updateData = {
        name: settingsName.trim() || null,
        default_cadence_days: settingsDefaultCadence,
      };
      
      const { error } = await supabase
        .from("users")
        .update(updateData)
        .eq("id", user.id);

      if (error) throw error;
      setSettingsSuccess(true);
      
      // Sync contacts to update standard sorting cadence fallback if needed
      await loadContacts(user.id);
      
      setTimeout(() => {
        setSettingsSuccess(false);
        setIsSettingsOpen(false);
      }, 1500);
    } catch (err: any) {
      setSettingsError(err.message || "Failed to save settings");
    } finally {
      setSettingsSaving(false);
    }
  };

  const handleDeleteAccount = async () => {
    if (!user) return;
    setSettingsDeleting(true);
    setSettingsError("");
    try {
      const { error: contactsError } = await supabase
        .from("contacts")
        .delete()
        .eq("user_id", user.id);
      if (contactsError) throw contactsError;

      const { error: userError } = await supabase
        .from("users")
        .delete()
        .eq("id", user.id);
      if (userError) throw userError;

      try {
        await supabase.rpc('delete_auth_user');
      } catch (e) {
        console.error("Error calling delete_auth_user RPC:", e);
      }

      await supabase.auth.signOut();
      router.push("/auth");
    } catch (err: any) {
      setSettingsError(err.message || "Failed to delete account");
      setSettingsDeleting(false);
      setShowSettingsDeleteConfirm(false);
    }
  };

  // 3. Log Touchpoint Modal Submission
  const handleOpenLogTouchpoint = (contactId: string) => {
    setLogTouchpointContactId(contactId);
    setLogChannel("call");
    setLogDate(new Date().toISOString().split("T")[0]);
    setLogNote("");
    setLogError("");
  };

  const handleLogTouchpointSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!logTouchpointContactId || !user) return;
    setLogSaving(true);
    setLogError("");
    try {
      const { error: insertError } = await supabase
        .from("touchpoints")
        .insert([
          {
            contact_id: logTouchpointContactId,
            channel: logChannel,
            contact_date: logDate,
            note: logNote.trim() || null,
          },
        ]);
      
      if (insertError) throw insertError;

      // Unpin contact if pinned
      const currentContact = contacts.find(c => c.id === logTouchpointContactId);
      if (currentContact?.is_pinned) {
        await supabase
          .from("contacts")
          .update({ is_pinned: false })
          .eq("id", logTouchpointContactId)
          .eq("user_id", user.id);
      }

      await loadContacts(user.id);
      setLogTouchpointContactId(null);
      setLogNote("");
    } catch (err: any) {
      setLogError(err.message || "Failed to log touchpoint");
    } finally {
      setLogSaving(false);
    }
  };

  // 4. Upgraded Profile Drawer Handlers
  const handleOpenEditContact = (contact: Contact) => {
    setEditName(contact.name);
    setEditRelationship(contact.relationship || "Friend");
    setEditPhone(contact.phone || "");
    setEditEmail(contact.email || "");
    setEditCadenceDays(contact.cadence_days || 30);
    setEditCity(contact.city || "");
    setEditCountry(contact.country || "");
    
    const parsedBday = parseBirthday(contact.birthday);
    setEditBirthdayMonth(parsedBday.month);
    setEditBirthdayDay(parsedBday.day);
    setEditNotes(contact.notes || "");
    setDrawerError("");
    setIsEditingContact(true);
  };

  const handleSaveEditContact = async () => {
    if (!user || !selectedContact) return;
    setDrawerSaving(true);
    setDrawerError("");
    try {
      const birthdayForDB = formatBirthdayForDB(editBirthdayMonth, editBirthdayDay);
      const { error } = await supabase
        .from("contacts")
        .update({
          name: editName.trim(),
          relationship: editRelationship,
          cadence_days: editCadenceDays,
          city: editCity.trim() || null,
          country: editCountry.trim() || null,
          birthday: birthdayForDB,
          notes: editNotes.trim() || null,
          phone: editPhone.trim() || null,
          email: editEmail.trim() || null,
        })
        .eq("id", selectedContact.id)
        .eq("user_id", user.id);

      if (error) throw error;
      await loadContacts(user.id);
      setIsEditingContact(false);
    } catch (err: any) {
      setDrawerError(err.message || "Failed to save contact details");
    } finally {
      setDrawerSaving(false);
    }
  };

  const handleDeleteContact = async () => {
    if (!user || !selectedContact) return;
    setDeleting(true);
    setDrawerError("");
    try {
      const { error } = await supabase
        .from("contacts")
        .delete()
        .eq("id", selectedContact.id)
        .eq("user_id", user.id);
      
      if (error) throw error;
      setExpandedId(null);
      setShowDeleteConfirm(false);
      await loadContacts(user.id);
    } catch (err: any) {
      setDrawerError(err.message || "Failed to delete contact");
    } finally {
      setDeleting(false);
    }
  };

  const handleSaveNotes = async () => {
    if (!user || !selectedContact) return;
    setNotesSaving(true);
    try {
      const { error } = await supabase
        .from("contacts")
        .update({ notes: notesText.trim() || null })
        .eq("id", selectedContact.id)
        .eq("user_id", user.id);
      
      if (error) throw error;
      await loadContacts(user.id);
      setIsEditingNotes(false);
    } catch (err) {
      console.error(err);
    } finally {
      setNotesSaving(false);
    }
  };

  const handleStartEditNotes = (contact: Contact) => {
    setNotesText(contact.notes || "");
    setIsEditingNotes(true);
  };

  const handleStartEditTouchpoint = (tp: Touchpoint) => {
    setEditingTouchpointId(tp.id);
    setEditTouchpointChannel(tp.channel);
    setEditTouchpointDate(tp.contact_date);
    setEditTouchpointNote(tp.note || "");
  };

  const handleSaveEditTouchpoint = async () => {
    if (!user || !selectedContact || !editingTouchpointId) return;
    setNotesSaving(true);
    try {
      const { error } = await supabase
        .from("touchpoints")
        .update({
          channel: editTouchpointChannel,
          contact_date: editTouchpointDate,
          note: editTouchpointNote.trim() || null,
        })
        .eq("id", editingTouchpointId);

      if (error) throw error;
      await loadContacts(user.id);
      setEditingTouchpointId(null);
    } catch (err) {
      console.error(err);
    } finally {
      setNotesSaving(false);
    }
  };

  const handleDeleteTouchpoint = async (tpId: string) => {
    if (!user || !selectedContact) return;
    setNotesSaving(true);
    try {
      const { error } = await supabase
        .from("touchpoints")
        .delete()
        .eq("id", tpId);
      
      if (error) throw error;
      await loadContacts(user.id);
      setShowDeleteTouchpointConfirm(null);
    } catch (err) {
      console.error(err);
    } finally {
      setNotesSaving(false);
    }
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
                className="w-10 h-10 flex items-center justify-center text-gray-400 hover:text-white border border-gray-700 rounded-full hover:border-gray-600 hover:bg-[#111827] transition-all duration-200"
                title="Search"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </button>
              {/* Add Contact button - Chrome-style + icon */}
              <button
                onClick={() => setIsAddContactOpen(true)}
                className="w-10 h-10 flex items-center justify-center bg-cyan-500 hover:bg-cyan-600 text-white rounded-full hover:bg-cyan-600 transition-all duration-200"
                title="Add Contact"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
                </svg>
              </button>
              {/* Settings icon button */}
              <button
                onClick={handleOpenSettings}
                className="w-10 h-10 flex items-center justify-center text-gray-400 hover:text-white border border-gray-700 rounded-full hover:border-gray-600 hover:bg-[#111827] transition-all duration-200"
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
                className="w-10 h-10 flex items-center justify-center text-gray-400 hover:text-white border border-gray-700 rounded-full hover:border-gray-600 hover:bg-[#111827] transition-all duration-200"
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
                className="w-10 h-10 flex items-center justify-center text-gray-400 hover:text-white border border-gray-700 rounded-full hover:border-gray-600 hover:bg-[#111827] transition-all duration-200"
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
                        handleOpenLogTouchpoint(contact.id);
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
                className="w-10 h-10 flex items-center justify-center text-gray-400 hover:text-white border border-gray-700 rounded-full hover:border-gray-600 hover:bg-[#111827] transition-all duration-200"
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
                        handleOpenLogTouchpoint(contact.id);
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
            className="fixed inset-0 z-50 flex flex-col md:flex-row justify-end items-end md:items-stretch animate-fadeIn"
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
              <div className="p-6 border-b border-gray-800/80 flex justify-between items-start gap-4 shrink-0">
                <div>
                  <h3 className="text-xl font-bold text-white leading-tight">
                    {selectedContact.name}
                  </h3>
                  <p className="text-sm text-gray-400 mt-1">
                    {selectedContact.relationship}
                    {` • ${formatCadence(selectedContact.cadence_days)}`}
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {/* Clustered Pin Button */}
                  <button
                    onClick={() => handleTogglePin(selectedContact.id)}
                    className={`w-10 h-10 flex items-center justify-center border rounded-full transition-all duration-200 ${
                      selectedContact.is_pinned 
                        ? "border-cyan-500/50 text-cyan-400 hover:border-cyan-500 hover:bg-cyan-500/10" 
                        : "border-gray-700 text-gray-500 hover:border-gray-600 hover:text-gray-400 hover:bg-[#111827]"
                    }`}
                    title={selectedContact.is_pinned ? "Unpin contact" : "Pin contact"}
                  >
                    <svg className="w-5 h-5" fill={selectedContact.is_pinned ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                      <circle cx="12" cy="7" r="3.5" fill={selectedContact.is_pinned ? "currentColor" : "none"}/>
                      <path d="M12 10.5v11M9 21.5h6" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                    </svg>
                  </button>
                  {/* Close panel button */}
                  <button
                    onClick={() => setExpandedId(null)}
                    className="w-10 h-10 flex items-center justify-center text-gray-400 hover:text-white border border-gray-700 rounded-full hover:border-gray-600 hover:bg-[#111827] transition-all duration-200"
                    title="Close panel"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              </div>

              {/* Scrollable Content */}
              <div className="flex-1 overflow-y-auto p-6 space-y-6">
                {isEditingContact ? (
                  /* ==========================================
                     A. CONTACT EDIT FORM STATE
                     ========================================== */
                  <div className="space-y-4 animate-fadeIn">
                    <div>
                      <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
                        Name *
                      </label>
                      <input
                        type="text"
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        required
                        className="w-full px-4 py-2 bg-[#111827] border border-gray-700 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-cyan-500 text-sm"
                        placeholder="John Doe"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
                        Relationship
                      </label>
                      <select
                        value={editRelationship}
                        onChange={(e) => setEditRelationship(e.target.value)}
                        className="w-full px-4 py-2 bg-[#111827] border border-gray-700 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-cyan-500 text-sm"
                      >
                        {RELATIONSHIPS.map((rel) => (
                          <option key={rel} value={rel}>
                            {rel}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
                          Phone
                        </label>
                        <input
                          type="tel"
                          value={editPhone}
                          onChange={(e) => setEditPhone(e.target.value)}
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
                          value={editEmail}
                          onChange={(e) => setEditEmail(e.target.value)}
                          className="w-full px-4 py-2 bg-[#111827] border border-gray-700 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-cyan-500 text-sm"
                          placeholder="example@email.com"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
                        Cadence
                      </label>
                      <div className="flex flex-wrap gap-2 mb-2">
                        {CADENCE_PRESETS.map((preset) => (
                          <button
                            key={preset.days}
                            type="button"
                            onClick={() => setEditCadenceDays(preset.days)}
                            className={`px-3 py-1 text-xs rounded-md border transition-colors cursor-pointer ${
                              editCadenceDays === preset.days
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
                            if ([7, 30, 90, 365].includes(editCadenceDays)) {
                              setEditCadenceDays(45); // Set custom default to 45
                            }
                          }}
                          className={`px-3 py-1 text-xs rounded-md border transition-colors cursor-pointer ${
                            ![7, 30, 90, 365].includes(editCadenceDays)
                              ? "bg-cyan-500 border-cyan-500 text-white"
                              : "bg-[#111827] border-gray-700 text-gray-300 hover:border-gray-600"
                          }`}
                        >
                          Custom
                        </button>
                      </div>
                      
                      {/* Custom numerical input field - only shown when Custom selected */}
                      {![7, 30, 90, 365].includes(editCadenceDays) && (
                        <div className="flex items-center gap-2 animate-fadeIn mt-2 pl-1">
                          <input
                            type="number"
                            value={editCadenceDays}
                            onChange={(e) => {
                              const val = e.target.value;
                              if (val === "") setEditCadenceDays(0);
                              else {
                                const num = parseInt(val);
                                if (!isNaN(num) && num > 0) setEditCadenceDays(num);
                              }
                            }}
                            min="1"
                            className="w-24 px-4 py-2 bg-[#111827] border border-gray-700 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-cyan-500 text-sm"
                          />
                          <span className="text-gray-400 text-sm">days</span>
                        </div>
                      )}
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
                          City
                        </label>
                        <input
                          type="text"
                          value={editCity}
                          onChange={(e) => setEditCity(e.target.value)}
                          className="w-full px-4 py-2 bg-[#111827] border border-gray-700 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-cyan-500 text-sm"
                          placeholder="San Jose"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
                          Country
                        </label>
                        <input
                          type="text"
                          value={editCountry}
                          onChange={(e) => setEditCountry(e.target.value)}
                          className="w-full px-4 py-2 bg-[#111827] border border-gray-700 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-cyan-500 text-sm"
                          placeholder="United States"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
                        Birthday
                      </label>
                      <div className="grid grid-cols-2 gap-3">
                        <select
                          value={editBirthdayMonth}
                          onChange={(e) => {
                            setEditBirthdayMonth(e.target.value);
                            if (e.target.value) {
                              const days = getDaysInMonth(e.target.value);
                              if (editBirthdayDay && parseInt(editBirthdayDay) > days.length) {
                                setEditBirthdayDay("");
                              }
                            } else {
                              setEditBirthdayDay("");
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
                          value={editBirthdayDay}
                          onChange={(e) => setEditBirthdayDay(e.target.value)}
                          disabled={!editBirthdayMonth}
                          className="w-full px-3 py-2 bg-[#111827] border border-gray-700 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-cyan-500 text-sm disabled:opacity-50"
                        >
                          <option value="">Day</option>
                          {editBirthdayMonth && getDaysInMonth(editBirthdayMonth).map((d) => (
                            <option key={d} value={String(d).padStart(2, '0')}>{d}</option>
                          ))}
                        </select>
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
                        Notes
                      </label>
                      <textarea
                        value={editNotes}
                        onChange={(e) => setEditNotes(e.target.value)}
                        rows={3}
                        className="w-full px-4 py-2 bg-[#111827] border border-gray-700 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-cyan-500 text-sm"
                        placeholder="Prefers WhatsApp..."
                      />
                    </div>

                    {drawerError && (
                      <div className="p-3 bg-red-900/20 border border-red-800 text-red-400 rounded-md text-xs">
                        {drawerError}
                      </div>
                    )}
                  </div>
                ) : (
                  /* ==========================================
                     B. STANDARD PREVIEW STATE
                     ========================================== */
                  <div className="space-y-6 animate-fadeIn">
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
                              <path strokeLinecap="round" strokeLinejoin="round" d="M12 8.25v-1.5m0 1.5c-1.355 0-2.697-.056-4.024-.166C6.845 7.96 6 6.99 6 5.89V5.25c0-1.1.9-2 2-2h8c1.1 0 2 .9 2 2v.64c0 1.1-.845 2.07-1.976 2.194A42.14 42.14 0 0112 8.25zm0 0v1.5m0-1.5c1.355 0 2.697.056 4.024.166C17.156 8.52 18 9.49 18 10.59v6.66a2.25 2.25 0 01-2.25 2.25H8.25A2.25 2.25 0 016 17.25v-6.66c0-1.1.844-2.07 1.976-2.194C9.303 8.306 10.645 8.25 12 8.25z" />
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

                    {/* Personal Notes Card */}
                    <div className="space-y-2">
                      <div className="flex justify-between items-center">
                        <h4 className="text-xs font-semibold text-cyan-400 uppercase tracking-wider">Personal Notes</h4>
                        {!isEditingNotes && (
                          <button
                            onClick={() => handleStartEditNotes(selectedContact)}
                            className="w-8 h-8 flex items-center justify-center text-cyan-400 hover:text-white border border-cyan-500/30 rounded-full hover:bg-cyan-500/10 transition-colors"
                            title="Edit Notes"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L6.832 19.82a4.5 4.5 0 01-1.897 1.13l-2.685.8.8-2.685a4.5 4.5 0 011.13-1.897L16.863 4.487zm0 0L19.5 7.125" />
                            </svg>
                          </button>
                        )}
                      </div>

                      {isEditingNotes ? (
                        <div className="space-y-3 mt-2 animate-fadeIn">
                          <textarea
                            value={notesText}
                            onChange={(e) => setNotesText(e.target.value)}
                            rows={4}
                            className="w-full px-4 py-2 bg-[#111827] border border-gray-700 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-cyan-500 text-sm"
                            placeholder="Prefers WhatsApp, Ask about new job..."
                          />
                          <div className="flex gap-2 justify-end">
                            <button
                              onClick={() => setIsEditingNotes(false)}
                              className="w-8 h-8 flex items-center justify-center text-red-500 hover:text-white border border-red-500/50 rounded-full hover:border-red-500 hover:bg-red-500/10 transition-all duration-200"
                              title="Cancel"
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                              </svg>
                            </button>
                            <button
                              onClick={handleSaveNotes}
                              disabled={notesSaving}
                              className="w-8 h-8 flex items-center justify-center text-cyan-400 hover:text-white border border-cyan-500/50 rounded-full hover:border-cyan-500 hover:bg-cyan-500/10 transition-all duration-200 disabled:opacity-50"
                              title="Save Notes"
                            >
                              {notesSaving ? (
                                <svg className="animate-spin h-4 w-4 text-cyan-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                </svg>
                              ) : (
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                                </svg>
                              )}
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="bg-[#111827]/30 border border-gray-800/50 rounded-xl p-4 text-sm text-gray-300 italic whitespace-pre-wrap leading-relaxed">
                          {selectedContact.notes || "No notes yet. Click Edit to add some."}
                        </div>
                      )}
                    </div>

                    {/* Timeline History Block */}
                    <div className="space-y-3">
                      <div className="flex justify-between items-center">
                        <h4 className="text-xs font-semibold text-cyan-400 uppercase tracking-wider">Touchpoint History</h4>
                        <button
                          onClick={() => handleOpenLogTouchpoint(selectedContact.id)}
                          className="w-8 h-8 flex items-center justify-center bg-cyan-500 hover:bg-cyan-600 text-white rounded-full transition-all duration-200"
                          title="Log Touchpoint"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                          </svg>
                        </button>
                      </div>

                      {selectedContact.touchpoints && selectedContact.touchpoints.length > 0 ? (
                        <div className="space-y-4">
                          {selectedContact.touchpoints.slice(0, drawerVisibleCount).map((tp: Touchpoint) => (
                            <div key={tp.id} className="border-b border-gray-800/80 pb-4 last:border-0 last:pb-0">
                              {editingTouchpointId === tp.id ? (
                                /* Inline Touchpoint Edit Form */
                                <div className="space-y-3 p-3 bg-[#111827]/40 rounded-xl border border-gray-800/80 animate-fadeIn">
                                  <div>
                                    <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">
                                      Channel *
                                    </label>
                                    <select
                                      value={editTouchpointChannel}
                                      onChange={(e) => setEditTouchpointChannel(e.target.value)}
                                      className="w-full px-3 py-1.5 bg-[#111827] border border-gray-700 rounded-md text-white focus:outline-none focus:ring-1 focus:ring-cyan-500 text-xs"
                                    >
                                      <option value="call">Call</option>
                                      <option value="text">Text</option>
                                      <option value="video">Video</option>
                                      <option value="in_person">In Person</option>
                                      <option value="email">Email</option>
                                      <option value="other">Other</option>
                                    </select>
                                  </div>
                                  <div>
                                    <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">
                                      Date *
                                    </label>
                                    <input
                                      type="date"
                                      value={editTouchpointDate}
                                      onChange={(e) => setEditTouchpointDate(e.target.value)}
                                      required
                                      className="block w-full min-w-full px-3 py-1.5 bg-[#111827] border border-gray-700 rounded-md text-white focus:outline-none focus:ring-1 focus:ring-cyan-500 text-xs appearance-none"
                                    />
                                  </div>
                                  <div>
                                    <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">
                                      Note
                                    </label>
                                    <textarea
                                      value={editTouchpointNote}
                                      onChange={(e) => setEditTouchpointNote(e.target.value)}
                                      rows={2}
                                      className="w-full px-3 py-1.5 bg-[#111827] border border-gray-700 rounded-md text-white focus:outline-none focus:ring-1 focus:ring-cyan-500 text-xs"
                                      placeholder="Notes..."
                                    />
                                  </div>
                                  <div className="flex gap-2 justify-end">
                                    <button
                                      onClick={() => setEditingTouchpointId(null)}
                                      className="w-8 h-8 flex items-center justify-center text-red-500 hover:text-white border border-red-500/50 rounded-full hover:border-red-500 hover:bg-red-500/10 transition-all duration-200"
                                      title="Cancel"
                                    >
                                      <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                                      </svg>
                                    </button>
                                    <button
                                      onClick={handleSaveEditTouchpoint}
                                      disabled={notesSaving}
                                      className="w-8 h-8 flex items-center justify-center text-cyan-400 hover:text-white border border-cyan-500/50 rounded-full hover:border-cyan-500 hover:bg-cyan-500/10 transition-all duration-200 disabled:opacity-50"
                                      title="Save Touchpoint"
                                    >
                                      <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                                      </svg>
                                    </button>
                                  </div>
                                </div>
                              ) : (
                                /* Normal Touchpoint View */
                                <div className="text-sm flex flex-col bg-[#111827]/20 p-4 rounded-2xl border border-gray-800/40 relative group/row">
                                  <div className="flex justify-between items-start text-gray-300">
                                    <div>
                                      <span className="font-semibold capitalize text-xs bg-gray-800 px-2 py-0.5 rounded text-cyan-400">
                                        {tp.channel === 'in_person' ? 'In Person' : tp.channel}
                                      </span>
                                      <p className="text-[11px] text-gray-500 mt-1">
                                        {new Date(tp.contact_date).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                                      </p>
                                    </div>
                                    
                                    {/* Action Buttons for Row */}
                                    <div className="flex gap-2 opacity-0 group-hover/row:opacity-100 transition-opacity duration-200">
                                      <button
                                        onClick={() => handleStartEditTouchpoint(tp)}
                                        className="w-7 h-7 flex items-center justify-center text-gray-400 hover:text-cyan-400 border border-gray-800 rounded-full hover:bg-gray-800/60 transition-colors"
                                        title="Edit touchpoint"
                                      >
                                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                                          <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L6.832 19.82a4.5 4.5 0 01-1.897 1.13l-2.685.8.8-2.685a4.5 4.5 0 011.13-1.897L16.863 4.487zm0 0L19.5 7.125" />
                                        </svg>
                                      </button>
                                      <button
                                        onClick={() => setShowDeleteTouchpointConfirm(tp.id)}
                                        className="w-7 h-7 flex items-center justify-center text-gray-400 hover:text-red-400 border border-gray-800 rounded-full hover:bg-gray-800/60 transition-colors"
                                        title="Delete touchpoint"
                                      >
                                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                                          <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
                                        </svg>
                                      </button>
                                    </div>
                                  </div>
                                  {tp.note && (
                                    <p className="text-xs text-gray-400 italic mt-2.5 leading-relaxed border-l border-cyan-500/30 pl-2">
                                      {tp.note}
                                    </p>
                                  )}
                                </div>
                              )}
                            </div>
                          ))}
                          
                          {/* Timeline Paging Load More */}
                          {selectedContact.touchpoints.length > drawerVisibleCount && (
                            <div className="text-center pt-2">
                              <button
                                onClick={() => setDrawerVisibleCount(prev => prev + 10)}
                                className="w-9 h-9 flex items-center justify-center text-cyan-400 hover:text-cyan-300 border border-cyan-500/40 rounded-full hover:bg-cyan-500/10 mx-auto transition-all duration-200"
                                title="Load More History"
                              >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
                                </svg>
                              </button>
                            </div>
                          )}
                        </div>
                      ) : (
                        <div className="text-center py-6 border border-dashed border-gray-800 rounded-xl">
                          <p className="text-sm text-gray-500 italic">No touchpoints logged yet.</p>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* Bottom Actions Footer */}
              <div className="p-6 bg-[#070b14]/50 border-t border-gray-800/80 flex justify-between items-center shrink-0">
                <div className="flex gap-2">
                  {/* Edit Contact Button */}
                  <button
                    onClick={() => {
                      if (isEditingContact) {
                        handleSaveEditContact();
                      } else {
                        handleOpenEditContact(selectedContact);
                      }
                    }}
                    disabled={drawerSaving}
                    className={`w-10 h-10 flex items-center justify-center rounded-full border transition-all duration-200 ${
                      isEditingContact
                        ? "bg-cyan-500 border-cyan-500 text-white hover:bg-cyan-600"
                        : "text-cyan-400 border-cyan-500/40 hover:border-cyan-500 hover:text-white hover:bg-cyan-500/10"
                    }`}
                    title={isEditingContact ? "Save Details" : "Edit Contact"}
                  >
                    {drawerSaving ? (
                      <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                    ) : isEditingContact ? (
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                      </svg>
                    ) : (
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L6.832 19.82a4.5 4.5 0 01-1.897 1.13l-2.685.8.8-2.685a4.5 4.5 0 011.13-1.897L16.863 4.487zm0 0L19.5 7.125" />
                      </svg>
                    )}
                  </button>

                  {/* Delete Contact Button */}
                  <button
                    onClick={() => {
                      if (isEditingContact) {
                        setIsEditingContact(false);
                      } else {
                        setShowDeleteConfirm(true);
                      }
                    }}
                    className="w-10 h-10 flex items-center justify-center text-red-500 hover:text-white border border-red-500/50 rounded-full hover:border-red-500 hover:bg-red-500/10 transition-all duration-200"
                    title={isEditingContact ? "Cancel Editing" : "Delete Contact"}
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                      {isEditingContact ? (
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M6 18L18 6M6 6l12 12" />
                      ) : (
                        <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
                      )}
                    </svg>
                  </button>
                </div>
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
                    onClick={() => handleOpenLogTouchpoint(selectedContact.id)}
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
              <div className="p-6 bg-[#070b14]/50 border-t border-gray-800/80 flex items-center justify-center gap-4 w-full">
                <button
                  onClick={() => {
                    setExpandedId(activeContactMenu.id);
                    setIsEditingContact(true);
                    setActiveContactMenu(null);
                  }}
                  className="w-12 h-12 flex items-center justify-center text-cyan-400 hover:text-white border border-cyan-500/50 rounded-full hover:border-cyan-500 hover:bg-cyan-500/10 transition-all duration-200"
                  title="Edit Contact"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L6.832 19.82a4.5 4.5 0 01-1.897 1.13l-2.685.8.8-2.685a4.5 4.5 0 011.13-1.897L16.863 4.487zm0 0L19.5 7.125" />
                  </svg>
                </button>
                <button
                  onClick={() => setActiveContactMenu(null)}
                  className="w-12 h-12 flex items-center justify-center text-gray-400 hover:text-white border border-gray-700 rounded-full hover:border-gray-600 hover:bg-gray-800/80 transition-all duration-200"
                  title="Close"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Delete Contact Confirmation Modal */}
        {showDeleteConfirm && (
          <div 
            className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 z-50 animate-fadeIn cursor-default"
            onClick={() => setShowDeleteConfirm(false)}
          >
            <div 
              className="bg-[#0b1120] border border-gray-800 rounded-3xl max-w-sm w-full overflow-hidden animate-scaleUp shadow-2xl p-6"
              onClick={(e) => e.stopPropagation()}
            >
              <h3 className="text-xl font-bold text-white mb-2">Delete Contact</h3>
              <p className="text-sm text-gray-400 mb-6">
                Are you sure you want to delete <span className="text-white font-semibold">{selectedContact?.name}</span>? This action is permanent and will delete all their touchpoints and history.
              </p>
              <div className="flex items-center justify-center gap-4">
                {/* Delete button */}
                <button
                  onClick={handleDeleteContact}
                  disabled={deleting}
                  className="w-12 h-12 flex items-center justify-center text-red-500 hover:text-white border border-red-500/50 rounded-full hover:border-red-500 hover:bg-red-500/10 transition-all duration-200 disabled:opacity-50"
                  title="Confirm Delete"
                >
                  {deleting ? (
                    <svg className="animate-spin h-5 w-5 text-red-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                  ) : (
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  )}
                </button>
                {/* Cancel button */}
                <button
                  onClick={() => setShowDeleteConfirm(false)}
                  className="w-12 h-12 flex items-center justify-center text-gray-400 hover:text-white border border-gray-700 rounded-full hover:border-gray-600 hover:bg-gray-800/80 transition-all duration-200"
                  title="Cancel"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Add Contact Modal */}
        {isAddContactOpen && (
          <div 
            className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 z-50 animate-fadeIn cursor-default"
            onClick={() => setIsAddContactOpen(false)}
          >
            <div 
              className="bg-[#0b1120] border border-gray-800 rounded-3xl max-w-lg w-full overflow-hidden animate-scaleUp shadow-2xl flex flex-col max-h-[90vh]"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header */}
              <div className="px-6 py-5 border-b border-gray-800/80 flex justify-between items-center shrink-0">
                <h3 className="text-xl font-bold text-white">Add Contact</h3>
              </div>

              {/* Automate Import Action Bar */}
              <div className="px-6 py-4 bg-[#0d1527] border-b border-gray-800/80 space-y-3">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                  <div>
                    <h4 className="text-xs font-semibold text-gray-300 uppercase tracking-wider">Automate Import</h4>
                    <p className="text-[10px] text-slate-400 mt-0.5">Import from your device contacts or upload a .vcf file.</p>
                  </div>
                  <div className="flex items-center gap-2 w-full sm:w-auto">


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
                      onClick={() => setIsImportGuideOpen(true)}
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

              {/* Form */}
              <form onSubmit={handleAddContactSubmit} className="flex-1 overflow-y-auto p-6 space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
                    Name *
                  </label>
                  <input
                    type="text"
                    value={addName}
                    onChange={(e) => setAddName(e.target.value)}
                    required
                    className="w-full px-4 py-2 bg-[#111827] border border-gray-700 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-cyan-500 text-sm"
                    placeholder="John Doe"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
                    Relationship
                  </label>
                  <select
                    value={addRelationship}
                    onChange={(e) => setAddRelationship(e.target.value)}
                    className="w-full px-4 py-2 bg-[#111827] border border-gray-700 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-cyan-500 text-sm"
                  >
                    {RELATIONSHIPS.map((rel) => (
                      <option key={rel} value={rel}>
                        {rel}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
                      Phone
                    </label>
                    <input
                      type="tel"
                      value={addPhone}
                      onChange={(e) => setAddPhone(e.target.value)}
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
                      value={addEmail}
                      onChange={(e) => setAddEmail(e.target.value)}
                      className="w-full px-4 py-2 bg-[#111827] border border-gray-700 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-cyan-500 text-sm"
                      placeholder="example@email.com"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
                    Cadence
                  </label>
                  <div className="flex flex-wrap gap-2 mb-2">
                    {CADENCE_PRESETS.map((preset) => (
                      <button
                        key={preset.days}
                        type="button"
                        onClick={() => setAddCadenceDays(preset.days)}
                        className={`px-3 py-1 text-xs rounded-md border transition-colors cursor-pointer ${
                          addCadenceDays === preset.days
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
                        if ([7, 30, 90, 365].includes(addCadenceDays)) {
                          setAddCadenceDays(45); // Set custom default to 45
                        }
                      }}
                      className={`px-3 py-1 text-xs rounded-md border transition-colors cursor-pointer ${
                        ![7, 30, 90, 365].includes(addCadenceDays)
                          ? "bg-cyan-500 border-cyan-500 text-white"
                          : "bg-[#111827] border-gray-700 text-gray-300 hover:border-gray-600"
                      }`}
                    >
                      Custom
                    </button>
                  </div>
                  
                  {/* Custom numerical input field - only shown when Custom selected */}
                  {![7, 30, 90, 365].includes(addCadenceDays) && (
                    <div className="flex items-center gap-2 animate-fadeIn mt-2 pl-1">
                      <input
                        type="number"
                        value={addCadenceDays}
                        onChange={(e) => {
                          const val = e.target.value;
                          if (val === "") setAddCadenceDays(0);
                          else {
                            const num = parseInt(val);
                            if (!isNaN(num) && num > 0) setAddCadenceDays(num);
                          }
                        }}
                        min="1"
                        className="w-24 px-4 py-2 bg-[#111827] border border-gray-700 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-cyan-500 text-sm"
                      />
                      <span className="text-gray-400 text-sm">days</span>
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
                      City
                    </label>
                    <input
                      type="text"
                      value={addCity}
                      onChange={(e) => setAddCity(e.target.value)}
                      className="w-full px-4 py-2 bg-[#111827] border border-gray-700 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-cyan-500 text-sm"
                      placeholder="San Jose"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
                      Country
                    </label>
                    <input
                      type="text"
                      value={addCountry}
                      onChange={(e) => setAddCountry(e.target.value)}
                      className="w-full px-4 py-2 bg-[#111827] border border-gray-700 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-cyan-500 text-sm"
                      placeholder="United States"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
                      Birthday
                    </label>
                    <div className="grid grid-cols-2 gap-2">
                      <select
                        value={addBirthdayMonth}
                        onChange={(e) => {
                          setAddBirthdayMonth(e.target.value);
                          if (e.target.value) {
                            const days = getDaysInMonth(e.target.value);
                            if (addBirthdayDay && parseInt(addBirthdayDay) > days.length) {
                              setAddBirthdayDay("");
                            }
                          } else {
                            setAddBirthdayDay("");
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
                        value={addBirthdayDay}
                        onChange={(e) => setAddBirthdayDay(e.target.value)}
                        disabled={!addBirthdayMonth}
                        className="w-full px-3 py-2 bg-[#111827] border border-gray-700 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-cyan-500 text-sm disabled:opacity-50"
                      >
                        <option value="">Day</option>
                        {addBirthdayMonth && getDaysInMonth(addBirthdayMonth).map((d) => (
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
                      value={addLastTouchpointDate}
                      onChange={(e) => setAddLastTouchpointDate(e.target.value)}
                      className="block w-full min-w-full px-4 py-2 bg-[#111827] border border-gray-700 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-cyan-500 text-sm appearance-none"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
                    Notes
                  </label>
                  <textarea
                    value={addNotes}
                    onChange={(e) => setAddNotes(e.target.value)}
                    rows={2}
                    className="w-full px-4 py-2 bg-[#111827] border border-gray-700 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-cyan-500 text-sm"
                    placeholder="Notes..."
                  />
                </div>

                {addError && (
                  <div className="p-3 bg-red-900/20 border border-red-800 text-red-400 rounded-md text-xs">
                    {addError}
                  </div>
                )}

                {/* Footer Buttons */}
                <div className="pt-4 border-t border-gray-800/80 flex justify-end gap-3 shrink-0">
                  <button
                    type="button"
                    onClick={() => setIsAddContactOpen(false)}
                    className="w-12 h-12 flex items-center justify-center text-gray-400 hover:text-white border border-gray-700 rounded-full hover:border-gray-600 hover:bg-[#111827] transition-all duration-200"
                    title="Cancel"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                  <button
                    type="submit"
                    disabled={addSaving}
                    className="w-12 h-12 flex items-center justify-center text-cyan-400 hover:text-white border border-cyan-500/50 rounded-full hover:border-cyan-500 hover:bg-cyan-500/10 transition-all duration-200 disabled:opacity-50"
                    title="Add Contact"
                  >
                    {addSaving ? (
                      <svg className="animate-spin h-5 w-5 text-cyan-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                    ) : (
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                      </svg>
                    )}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Settings Modal */}
        {isSettingsOpen && (
          <div 
            className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 z-50 animate-fadeIn cursor-default"
            onClick={() => setIsSettingsOpen(false)}
          >
            <div 
              className="bg-[#0b1120] border border-gray-800 rounded-3xl max-w-md w-full overflow-hidden animate-scaleUp shadow-2xl flex flex-col"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header */}
              <div className="px-6 py-5 border-b border-gray-800/80 flex justify-between items-center shrink-0">
                <h3 className="text-xl font-bold text-white">Settings</h3>
              </div>

              {/* Form */}
              <form onSubmit={handleSaveSettings} className="p-6 space-y-6">
                {showSettingsDeleteConfirm ? (
                  <div className="space-y-4 animate-fadeIn">
                    <h4 className="text-red-500 font-semibold text-base">Delete Your Account?</h4>
                    <p className="text-sm text-gray-400 leading-relaxed">
                      This is a destructive action. This will permanently delete your user account, profile settings, and <span className="text-white font-semibold">all {contacts.length} contacts</span> along with their touchpoint histories.
                    </p>
                    <div className="flex gap-3 justify-end pt-2">
                      <button
                        type="button"
                        onClick={() => setShowSettingsDeleteConfirm(false)}
                        className="w-12 h-12 flex items-center justify-center text-gray-400 hover:text-white border border-gray-700 rounded-full hover:border-gray-600 hover:bg-[#111827] transition-all duration-200"
                        title="Cancel"
                      >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                      <button
                        type="button"
                        onClick={handleDeleteAccount}
                        disabled={settingsDeleting}
                        className="w-12 h-12 flex items-center justify-center text-red-500 hover:text-white border border-red-500/50 rounded-full hover:border-red-500 hover:bg-red-500/10 transition-all duration-200 disabled:opacity-50"
                        title="Confirm Permanent Delete"
                      >
                        {settingsDeleting ? (
                          <svg className="animate-spin h-5 w-5 text-red-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                          </svg>
                        ) : (
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        )}
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div>
                      <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
                        Preferred Name
                      </label>
                      <input
                        type="text"
                        value={settingsName}
                        onChange={(e) => setSettingsName(e.target.value)}
                        className="w-full px-4 py-2 bg-[#111827] border border-gray-700 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-cyan-500 text-sm"
                        placeholder="John Doe"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
                        Default Touchpoint Cadence
                      </label>
                      <div className="flex items-center gap-2">
                        <input
                          type="number"
                          value={settingsDefaultCadence}
                          onChange={(e) => {
                            const val = e.target.value;
                            if (val === "") setSettingsDefaultCadence(0);
                            else {
                              const num = parseInt(val);
                              if (!isNaN(num) && num > 0) setSettingsDefaultCadence(num);
                            }
                          }}
                          min="1"
                          className="w-24 px-4 py-2 bg-[#111827] border border-gray-700 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-cyan-500 text-sm"
                        />
                        <span className="text-gray-400 text-sm">days</span>
                      </div>
                    </div>

                    {settingsSuccess && (
                      <div className="p-3 bg-green-900/20 border border-green-800 text-green-400 rounded-md text-xs">
                        Settings saved successfully!
                      </div>
                    )}
                    {settingsError && (
                      <div className="p-3 bg-red-900/20 border border-red-800 text-red-400 rounded-md text-xs">
                        {settingsError}
                      </div>
                    )}

                    <div className="pt-4 border-t border-gray-800/80 flex items-center justify-between">
                      <button
                        type="button"
                        onClick={() => setShowSettingsDeleteConfirm(true)}
                        className="text-xs text-red-500 hover:text-red-400 hover:underline font-semibold"
                      >
                        Delete Account
                      </button>

                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => setIsSettingsOpen(false)}
                          className="w-12 h-12 flex items-center justify-center text-gray-400 hover:text-white border border-gray-700 rounded-full hover:border-gray-600 hover:bg-[#111827] transition-all duration-200"
                          title="Cancel"
                        >
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                        <button
                          type="submit"
                          disabled={settingsSaving}
                          className="w-12 h-12 flex items-center justify-center text-cyan-400 hover:text-white border border-cyan-500/50 rounded-full hover:border-cyan-500 hover:bg-cyan-500/10 transition-all duration-200 disabled:opacity-50"
                          title="Save Settings"
                        >
                          {settingsSaving ? (
                            <svg className="animate-spin h-5 w-5 text-cyan-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                            </svg>
                          ) : (
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                            </svg>
                          )}
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </form>
            </div>
          </div>
        )}

        {/* Log Touchpoint Modal */}
        {logTouchpointContactId && (
          <div 
            className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 z-50 animate-fadeIn cursor-default"
            onClick={() => setLogTouchpointContactId(null)}
          >
            <div 
              className="bg-[#0b1120] border border-gray-800 rounded-3xl max-w-md w-full overflow-hidden animate-scaleUp shadow-2xl flex flex-col"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header */}
              <div className="px-6 py-5 border-b border-gray-800/80 flex justify-between items-center shrink-0">
                <h3 className="text-xl font-bold text-white">
                  Log Touchpoint
                </h3>
              </div>

              {/* Form */}
              <form onSubmit={handleLogTouchpointSubmit} className="p-6 space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
                    Method
                  </label>
                  <select
                    value={logChannel}
                    onChange={(e) => setLogChannel(e.target.value)}
                    className="w-full px-4 py-2 bg-[#111827] border border-gray-700 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-cyan-500 text-sm"
                  >
                    <option value="call">Call</option>
                    <option value="text">Text Message</option>
                    <option value="video">Video Call</option>
                    <option value="in_person">In Person</option>
                    <option value="email">Email</option>
                    <option value="other">Other</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
                    Date
                  </label>
                  <input
                    type="date"
                    value={logDate}
                    onChange={(e) => setLogDate(e.target.value)}
                    required
                    className="block w-full min-w-full px-4 py-2 bg-[#111827] border border-gray-700 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-cyan-500 text-sm appearance-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
                    Notes
                  </label>
                  <textarea
                    value={logNote}
                    onChange={(e) => setLogNote(e.target.value)}
                    rows={3}
                    className="w-full px-4 py-2 bg-[#111827] border border-gray-700 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-cyan-500 text-sm"
                    placeholder="What did you talk about?"
                  />
                </div>

                {logError && (
                  <div className="p-3 bg-red-900/20 border border-red-800 text-red-400 rounded-md text-xs">
                    {logError}
                  </div>
                )}

                {/* Footer Buttons */}
                <div className="pt-4 border-t border-gray-800/80 flex justify-end gap-3 shrink-0">
                  <button
                    type="button"
                    onClick={() => setLogTouchpointContactId(null)}
                    className="w-12 h-12 flex items-center justify-center text-gray-400 hover:text-white border border-gray-700 rounded-full hover:border-gray-600 hover:bg-[#111827] transition-all duration-200"
                    title="Cancel"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                  <button
                    type="submit"
                    disabled={logSaving}
                    className="w-12 h-12 flex items-center justify-center text-cyan-400 hover:text-white border border-cyan-500/50 rounded-full hover:border-cyan-500 hover:bg-cyan-500/10 transition-all duration-200 disabled:opacity-50"
                    title="Log Connection"
                  >
                    {logSaving ? (
                      <svg className="animate-spin h-5 w-5 text-cyan-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                    ) : (
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                      </svg>
                    )}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>

      {/* DASHBOARD EXPORT INSTRUCTIONS GUIDE MODAL */}
      {isImportGuideOpen && (
        <div
          className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 z-50 animate-fadeIn"
          onClick={() => setIsImportGuideOpen(false)}
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
                onClick={() => setIsImportGuideOpen(false)}
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
                  onClick={() => setImportGuideTab("google")}
                  className={`flex-1 py-2 text-center text-xs font-bold rounded-lg transition-all cursor-pointer ${
                    importGuideTab === "google"
                      ? "bg-gradient-to-r from-cyan-500 to-indigo-500 text-white shadow-md"
                      : "text-gray-400 hover:text-white"
                  }`}
                >
                  Google
                </button>
                <button
                  onClick={() => setImportGuideTab("android")}
                  className={`flex-1 py-2 text-center text-xs font-bold rounded-lg transition-all cursor-pointer ${
                    importGuideTab === "android"
                      ? "bg-gradient-to-r from-cyan-500 to-indigo-500 text-white shadow-md"
                      : "text-gray-400 hover:text-white"
                  }`}
                >
                  Android
                </button>
                <button
                  onClick={() => setImportGuideTab("ios")}
                  className={`flex-1 py-2 text-center text-xs font-bold rounded-lg transition-all cursor-pointer ${
                    importGuideTab === "ios"
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
              {importGuideTab === "google" && (
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

              {importGuideTab === "android" && (
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

              {importGuideTab === "ios" && (
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
          setIsAddContactOpen(false); // Close the Add Contact modal on successful import
        }}
        onImportError={(errorMsg) => {
          setAddError(errorMsg);
        }}
      />
    </div>
  );
}
