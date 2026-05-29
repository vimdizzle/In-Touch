/**
 * Parse birthday string into month and day (no year for privacy)
 */
export const parseBirthday = (birthday: string | null | undefined): { month: string; day: string } => {
  if (!birthday) return { month: "", day: "" };
  try {
    const date = new Date(birthday);
    return {
      month: String(date.getMonth() + 1).padStart(2, '0'),
      day: String(date.getDate()).padStart(2, '0')
    };
  } catch {
    return { month: "", day: "" };
  }
};

/**
 * Format birthday month/day for database storage (uses year 2000 as placeholder)
 */
export const formatBirthdayForDB = (month: string, day: string): string | null => {
  if (!month || !day) return null;
  // Use year 2000 as placeholder (leap year, so Feb 29 works)
  return `2000-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
};

/**
 * Format birthday for display (month and day only, no year for privacy)
 */
export const formatBirthday = (dateString: string): string => {
  const date = new Date(dateString);
  return date.toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
  });
};

/**
 * Get local time string for a pre-resolved timezone
 */
export const getLocalTime = (timezone?: string | null): string | null => {
  if (!timezone) return null;
  
  try {
    const now = new Date();
    const localTime = new Date(now.toLocaleString("en-US", { timeZone: timezone }));
    return localTime.toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    });
  } catch {
    return null;
  }
};


/**
 * Client-side vCard (.vcf) file parser.
 * Supports multiple VCARD entries, FN/N (Name), TEL (Phone), EMAIL (Email),
 * ADR (Address - City/Country), BDAY (Birthday), and NOTE (Notes).
 */
export const parseVCard = (vcardText: string): Array<{
  name: string;
  phone?: string;
  email?: string;
  city?: string;
  country?: string;
  birthday?: string;
  notes?: string;
  relationship: string;
  cadence_days: number;
}> => {
  const contacts: any[] = [];
  const lines = vcardText.split(/\r?\n/);
  let current: any = null;

  for (let i = 0; i < lines.length; i++) {
    let line = lines[i].trim();
    if (!line) continue;

    // Handle line folding (lines starting with space or tab are continuations of previous line)
    while (i + 1 < lines.length && (lines[i + 1].startsWith(" ") || lines[i + 1].startsWith("\t"))) {
      line += lines[i + 1].substring(1);
      i++;
    }

    if (line.toUpperCase() === "BEGIN:VCARD") {
      current = {
        name: "",
        relationship: "Friend",
        cadence_days: 30,
      };
    } else if (line.toUpperCase() === "END:VCARD") {
      if (current && current.name) {
        contacts.push(current);
      }
      current = null;
    } else if (current) {
      const colonIdx = line.indexOf(":");
      if (colonIdx === -1) continue;

      const keyPart = line.substring(0, colonIdx);
      const value = line.substring(colonIdx + 1).trim();
      const key = keyPart.split(";")[0].toUpperCase();

      if (key === "FN") {
        current.name = value.replace(/\\,/g, ",").replace(/\\;/g, ";").trim();
      } else if (key === "N" && !current.name) {
        const parts = value.split(";");
        const family = parts[0] || "";
        const given = parts[1] || "";
        const full = [given, family].filter(Boolean).join(" ").trim();
        if (full) {
          current.name = full.replace(/\\,/g, ",").replace(/\\;/g, ";");
        }
      } else if (key === "TEL") {
        // Clean value: strip common chars like spaces/dashes for standardizing
        const cleanPhone = value.replace(/\\,/g, ",").trim();
        if (!current.phone) {
          current.phone = cleanPhone;
        }
      } else if (key === "EMAIL") {
        const cleanEmail = value.replace(/\\,/g, ",").trim();
        if (!current.email) {
          current.email = cleanEmail;
        }
      } else if (key === "BDAY") {
        // Formats: YYYY-MM-DD, YYYYMMDD, --MMDD, MMDD
        const cleanBday = value.replace(/[-]/g, "");
        if (cleanBday.length === 8) {
          const month = cleanBday.substring(4, 6);
          const day = cleanBday.substring(6, 8);
          current.birthday = `${month}-${day}`;
        } else if (cleanBday.length === 4) {
          const month = cleanBday.substring(0, 2);
          const day = cleanBday.substring(2, 4);
          current.birthday = `${month}-${day}`;
        }
      } else if (key === "NOTE") {
        current.notes = value.replace(/\\n/g, "\n").replace(/\\,/g, ",").replace(/\\;/g, ";").trim();
      } else if (key === "ADR") {
        // ADR structure: POBox;Extended;Street;Locality(City);Region;PostalCode;Country
        const parts = value.split(";");
        const city = (parts[3] || "").trim();
        const country = (parts[6] || "").trim();
        if (city) current.city = city.replace(/\\,/g, ",").replace(/\\;/g, ";");
        if (country) current.country = country.replace(/\\,/g, ",").replace(/\\;/g, ";");
      }
    }
  }

  return contacts;
};

/**
 * Common Interfaces & Types
 */
export interface Touchpoint {
  id: string;
  contact_id: string;
  contact_date: string;
  channel: string;
  note?: string | null;
  created_at?: string;
}

export interface Contact {
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
  touchpoints?: Touchpoint[];
}

export interface ImportingContactDraft {
  name: string;
  phone?: string;
  email?: string;
  city?: string;
  country?: string;
  birthday?: string; // MM-DD
  notes?: string;
  relationship: string;
  cadence_days: number;
  selected: boolean;
}

/**
 * Global Constants
 */
export const RELATIONSHIPS = [
  "Friend",
  "Family",
  "Sibling",
  "Parent",
  "Coworker",
  "Mentor",
  "Other",
];

export const CADENCE_PRESETS = [
  { label: "Weekly", days: 7 },
  { label: "Monthly", days: 30 },
  { label: "Quarterly", days: 90 },
  { label: "Yearly", days: 365 },
];

export const MONTHS = [
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

/**
 * Helper to get days count in a given month
 */
export const getDaysInMonth = (month: string): number[] => {
  if (!month) return [];
  const monthNum = parseInt(month);
  const daysInMonth = new Date(2000, monthNum, 0).getDate(); // Using 2000 (leap year) for Feb 29
  return Array.from({ length: daysInMonth }, (_, i) => i + 1);
};




