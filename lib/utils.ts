import cityTimezones from "city-timezones";

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
 * Get timezone from city and country
 */
export const getTimezoneFromCityCountry = (city?: string | null, country?: string | null): string | null => {
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

/**
 * Get timezone from legacy location string (for backward compatibility)
 */
export const getTimezoneFromLocation = (location?: string | null): string | null => {
  if (!location) return null;
  
  // Handle "City, State" or "City, Country" format
  const parts = location.split(',').map(p => p.trim());
  if (parts.length >= 2) {
    const city = parts[0];
    const stateOrCountry = parts[1];
    
    // Try to match US states first
    const usStates: Record<string, string> = {
      'alabama': 'America/Chicago', 'alaska': 'America/Anchorage', 'arizona': 'America/Phoenix',
      'arkansas': 'America/Chicago', 'california': 'America/Los_Angeles', 'colorado': 'America/Denver',
      'connecticut': 'America/New_York', 'delaware': 'America/New_York', 'florida': 'America/New_York',
      'georgia': 'America/New_York', 'hawaii': 'America/Honolulu', 'idaho': 'America/Denver',
      'illinois': 'America/Chicago', 'indiana': 'America/Indiana/Indianapolis', 'iowa': 'America/Chicago',
      'kansas': 'America/Chicago', 'kentucky': 'America/New_York', 'louisiana': 'America/Chicago',
      'maine': 'America/New_York', 'maryland': 'America/New_York', 'massachusetts': 'America/New_York',
      'michigan': 'America/Detroit', 'minnesota': 'America/Chicago', 'mississippi': 'America/Chicago',
      'missouri': 'America/Chicago', 'montana': 'America/Denver', 'nebraska': 'America/Chicago',
      'nevada': 'America/Los_Angeles', 'new hampshire': 'America/New_York', 'new jersey': 'America/New_York',
      'new mexico': 'America/Denver', 'new york': 'America/New_York', 'north carolina': 'America/New_York',
      'north dakota': 'America/Chicago', 'ohio': 'America/New_York', 'oklahoma': 'America/Chicago',
      'oregon': 'America/Los_Angeles', 'pennsylvania': 'America/New_York', 'rhode island': 'America/New_York',
      'south carolina': 'America/New_York', 'south dakota': 'America/Chicago', 'tennessee': 'America/Chicago',
      'texas': 'America/Chicago', 'utah': 'America/Denver', 'vermont': 'America/New_York',
      'virginia': 'America/New_York', 'washington': 'America/Los_Angeles', 'west virginia': 'America/New_York',
      'wisconsin': 'America/Chicago', 'wyoming': 'America/Denver',
      // Abbreviations
      'al': 'America/Chicago', 'ak': 'America/Anchorage', 'az': 'America/Phoenix', 'ar': 'America/Chicago',
      'ca': 'America/Los_Angeles', 'co': 'America/Denver', 'ct': 'America/New_York', 'de': 'America/New_York',
      'fl': 'America/New_York', 'ga': 'America/New_York', 'hi': 'America/Honolulu', 'id': 'America/Denver',
      'il': 'America/Chicago', 'in': 'America/Indiana/Indianapolis', 'ia': 'America/Chicago', 'ks': 'America/Chicago',
      'ky': 'America/New_York', 'la': 'America/Chicago', 'me': 'America/New_York', 'md': 'America/New_York',
      'ma': 'America/New_York', 'mi': 'America/Detroit', 'mn': 'America/Chicago', 'ms': 'America/Chicago',
      'mo': 'America/Chicago', 'mt': 'America/Denver', 'ne': 'America/Chicago', 'nv': 'America/Los_Angeles',
      'nh': 'America/New_York', 'nj': 'America/New_York', 'nm': 'America/Denver', 'ny': 'America/New_York',
      'nc': 'America/New_York', 'nd': 'America/Chicago', 'oh': 'America/New_York', 'ok': 'America/Chicago',
      'or': 'America/Los_Angeles', 'pa': 'America/New_York', 'ri': 'America/New_York', 'sc': 'America/New_York',
      'sd': 'America/Chicago', 'tn': 'America/Chicago', 'tx': 'America/Chicago', 'ut': 'America/Denver',
      'vt': 'America/New_York', 'va': 'America/New_York', 'wa': 'America/Los_Angeles', 'wv': 'America/New_York',
      'wi': 'America/Chicago', 'wy': 'America/Denver'
    };
    
    const stateLower = stateOrCountry.toLowerCase();
    if (usStates[stateLower]) {
      // Special case: San Jose, CA should use Los Angeles timezone
      if (city.toLowerCase() === 'san jose' && (stateLower === 'ca' || stateLower === 'california')) {
        return 'America/Los_Angeles';
      }
      return usStates[stateLower];
    }
  }
  
  // Try city-timezones library
  const cityMatches = cityTimezones.lookupViaCity(location.split(',')[0].trim());
  if (cityMatches && cityMatches.length > 0) {
    return cityMatches[0].timezone;
  }
  
  return null;
};

/**
 * Get local time string for a location
 */
export const getLocalTime = (city?: string | null, country?: string | null, location?: string | null): string | null => {
  let timezone: string | null = null;
  
  // Try city/country first (more accurate)
  if (city || country) {
    timezone = getTimezoneFromCityCountry(city, country);
  }
  
  // Fallback to legacy location format
  if (!timezone && location) {
    timezone = getTimezoneFromLocation(location);
  }
  
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




