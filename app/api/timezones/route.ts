import { NextResponse } from "next/server";
import cityTimezones from "city-timezones";

// US States fallback mapping
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

const getTimezoneFromCityCountry = (city?: string | null, country?: string | null): string | null => {
  if (!city && !country) return null;
  
  if (city && country) {
    const cityMatches = cityTimezones.lookupViaCity(city);
    if (cityMatches && cityMatches.length > 0) {
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
  
  if (city) {
    const cityMatches = cityTimezones.lookupViaCity(city);
    if (cityMatches && cityMatches.length > 0) {
      return cityMatches[0].timezone;
    }
  }
  
  return null;
};

const getTimezoneFromLocation = (location?: string | null): string | null => {
  if (!location) return null;
  
  const parts = location.split(',').map(p => p.trim());
  if (parts.length >= 2) {
    const city = parts[0];
    const stateOrCountry = parts[1];
    
    const stateLower = stateOrCountry.toLowerCase();
    if (usStates[stateLower]) {
      if (city.toLowerCase() === 'san jose' && (stateLower === 'ca' || stateLower === 'california')) {
        return 'America/Los_Angeles';
      }
      return usStates[stateLower];
    }
  }
  
  const cityMatches = cityTimezones.lookupViaCity(location.split(',')[0].trim());
  if (cityMatches && cityMatches.length > 0) {
    return cityMatches[0].timezone;
  }
  
  return null;
};

// Module-level in-memory cache for lookups to optimize performance on warm containers
const lookupCache = new Map<string, string | null>();

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { locations } = body as { locations: string[] };

    if (!locations || !Array.isArray(locations)) {
      return NextResponse.json({ error: "Invalid locations parameter" }, { status: 400 });
    }

    const result: Record<string, string | null> = {};

    locations.forEach((locStr) => {
      // Check in-memory cache first
      if (lookupCache.has(locStr)) {
        result[locStr] = lookupCache.get(locStr)!;
        return;
      }

      const [city, country, location] = locStr.split("|");
      
      let tz: string | null = null;
      if (city || country) {
        tz = getTimezoneFromCityCountry(city, country);
      }
      
      if (!tz && location) {
        tz = getTimezoneFromLocation(location);
      }

      // Save to cache
      lookupCache.set(locStr, tz);
      result[locStr] = tz;
    });

    return NextResponse.json(result);
  } catch (error: any) {
    console.error("Error in timezone API:", error);
    return NextResponse.json({ error: error.message || "Server Error" }, { status: 500 });
  }
}
