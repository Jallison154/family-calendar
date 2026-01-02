/**
 * Google Calendar Integration
 * Handles ICS feed fetching and parsing
 */

class GoogleCalendarClient {
  constructor(config = {}) {
    this.config = {
      icsFeeds: config.icsFeeds || [],
      weeksAhead: config.weeksAhead || 4,
      refreshInterval: config.refreshInterval || 300000,
      corsProxy: config.corsProxy || 'https://api.allorigins.win/raw?url='
    };
    this.events = [];
  }

  async fetchEvents() {
    // Use a wider date range to ensure we get all events
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    // Get events from 30 days ago to 60 days ahead (very wide range)
    const startRange = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const endRange = new Date(now.getTime() + (this.config.weeksAhead + 8) * 7 * 86400000);
    
    const allEvents = [];
    
    for (const feed of this.config.icsFeeds) {
      if (!feed.url || !feed.url.trim()) continue;
      
      try {
        const events = await this.fetchIcsFeed(feed, startRange, endRange);
        console.log(`📅 Fetched ${events.length} events from ${feed.name || 'Unnamed'}`);
        allEvents.push(...events);
      } catch (e) {
        console.error(`ICS feed error (${feed.name}):`, e);
      }
    }
    
    console.log(`📅 Total events loaded: ${allEvents.length}`);
    this.events = allEvents;
  }

  async fetchIcsFeed(feed, startRange, endRange) {
    let url = feed.url;
    
    // Convert Google Calendar web URL to ICS if needed
    if (url.includes('calendar.google.com') && url.includes('cid=')) {
      const match = url.match(/cid=([^&]+)/);
      if (match) {
        const cid = decodeURIComponent(match[1]);
        url = `https://calendar.google.com/calendar/ical/${cid}/basic.ics`;
      }
    }
    
    // Use server-side proxy instead of CORS proxy (more reliable)
    const proxyUrl = '/api/calendar?url=' + encodeURIComponent(url);
    
    // Use AbortController for timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000); // 30 second timeout
    
    try {
      console.log(`📅 Fetching ICS feed via server proxy: ${feed.name || 'Unnamed'}`);
      
      const response = await fetch(proxyUrl, {
        signal: controller.signal,
        headers: {
          'Accept': 'text/calendar, text/plain, */*'
        }
      });
      
      clearTimeout(timeoutId);
      
      if (!response.ok) {
        const errorText = await response.text().catch(() => '');
        let errorMsg = `HTTP ${response.status}: ${response.statusText}`;
        try {
          const errorJson = JSON.parse(errorText);
          if (errorJson.error) errorMsg = errorJson.error;
        } catch (e) {
          // Not JSON, use text as-is
        }
        throw new Error(errorMsg);
      }
      
      const icsText = await response.text();
      console.log(`📅 Received ICS data (${icsText.length} bytes) for ${feed.name || 'Unnamed'}`);
      
      if (!icsText || icsText.trim().length === 0) {
        throw new Error('ICS feed returned empty response');
      }
      
      const events = this.parseIcs(icsText, feed, startRange, endRange);
      console.log(`📅 Parsed ${events.length} events from ${feed.name || 'Unnamed'}`);
      
      // Log event details for debugging (first 3 events)
      if (events.length > 0) {
        console.log('📅 Sample events:', events.slice(0, 3).map(e => ({
          title: e.title || 'Untitled',
          start: e.start?.toISOString(),
          end: e.end?.toISOString(),
          isAllDay: e.isAllDay
        })));
      }
      
      return events;
    } catch (error) {
      clearTimeout(timeoutId);
      if (error.name === 'AbortError') {
        throw new Error(`Request timeout: Calendar feed took too long to load (>30s)`);
      }
      throw error;
    }
  }

  parseIcs(icsText, feed, startRange, endRange) {
    const events = [];
    const lines = icsText.split(/\r?\n/);
    let currentEvent = null;
    let continuationLine = '';
    
    // Parse ICS with support for line continuation (lines starting with space)
    for (let i = 0; i < lines.length; i++) {
      let line = lines[i];
      
      // Handle line continuation (RFC 5545)
      if (line.startsWith(' ') || line.startsWith('\t')) {
        if (currentEvent) {
          continuationLine += line.substring(1);
          continue;
        }
      } else if (continuationLine) {
        // Process the accumulated continuation
        const [key, ...valueParts] = continuationLine.split(':');
        const value = valueParts.join(':');
        this.processIcsLine(currentEvent, key, value);
        continuationLine = '';
      }
      
      if (line.startsWith('BEGIN:VEVENT')) {
        currentEvent = { color: feed.color || '#3b82f6' };
      } else if (line.startsWith('END:VEVENT')) {
        if (currentEvent) {
          // Ensure we have start and end dates
          if (!currentEvent.start || !currentEvent.end) {
            console.warn('⚠️ Event missing start/end dates, skipping:', currentEvent.title || 'Untitled');
            currentEvent = null;
            continuationLine = '';
            continue;
          }
          let start = new Date(currentEvent.start);
          let end = new Date(currentEvent.end);
          
          // Detect all-day events more robustly
          // This handles cases where events are created "with no time" but exported with timestamps
          if (!currentEvent.isAllDay) {
            // Check if both DTSTART and DTEND use VALUE=DATE (even if not caught earlier)
            if ((currentEvent._dtstartParams?.VALUE === 'DATE' || (currentEvent._dtstartValue && currentEvent._dtstartValue.length === 8 && !currentEvent._dtstartValue.includes('T'))) &&
                (currentEvent._dtendParams?.VALUE === 'DATE' || (currentEvent._dtendValue && currentEvent._dtendValue.length === 8 && !currentEvent._dtendValue.includes('T')))) {
              currentEvent.isAllDay = true;
              // Normalize dates
              const startDate = new Date(start);
              startDate.setHours(0, 0, 0, 0);
              currentEvent.start = startDate;
              currentEvent.end = new Date(startDate);
              currentEvent.end.setDate(currentEvent.end.getDate() + 1);
              start = startDate;
              end = currentEvent.end;
              console.log('📅 Detected all-day event (VALUE=DATE):', currentEvent.title || 'Untitled', 'on', startDate.toDateString());
            } else {
              // Check if start and end are on the same calendar date (ignoring time)
              const startDate = new Date(start);
              startDate.setHours(0, 0, 0, 0);
              const endDate = new Date(end);
              endDate.setHours(0, 0, 0, 0);
              
              // If start and end are the same date, treat as all-day event
              // Also check if times are identical (within 1 second)
              // OR if the end is exactly 1 day after start (common for all-day events)
              const timeDiff = Math.abs(end.getTime() - start.getTime());
              const oneDayMs = 24 * 60 * 60 * 1000;
              
              if (startDate.getTime() === endDate.getTime() || 
                  timeDiff < 1000 || 
                  (Math.abs(timeDiff - oneDayMs) < 1000 && start.getHours() === 0 && start.getMinutes() === 0 && end.getHours() === 0 && end.getMinutes() === 0)) {
                currentEvent.isAllDay = true;
                // Normalize to start of day for consistency (ICS format: end date is exclusive, next day)
                currentEvent.start = startDate;
                currentEvent.end = new Date(startDate);
                currentEvent.end.setDate(currentEvent.end.getDate() + 1);
                start = startDate;
                end = currentEvent.end;
                console.log('📅 Detected all-day event (same date/midnight):', currentEvent.title || 'Untitled', 'start:', start.toISOString(), 'end:', end.toISOString());
              }
            }
          }
          
          // Clean up temporary properties
          delete currentEvent._dtstartValue;
          delete currentEvent._dtstartParams;
          delete currentEvent._dtendValue;
          delete currentEvent._dtendParams;
          
          // Include ALL events with valid dates - maximum permissiveness
          // The calendar widget will handle what to display based on its date range
          events.push(currentEvent);
          
          // Debug logging for events with no time
          if (currentEvent.isAllDay) {
            console.log('📅 All-day event added:', currentEvent.title || 'Untitled', 'start:', currentEvent.start.toISOString(), 'end:', currentEvent.end.toISOString());
          }
          
          if (!currentEvent.title) {
            console.warn('⚠️ Event has no title:', currentEvent);
          }
        }
        currentEvent = null;
        continuationLine = '';
      } else if (currentEvent) {
        const [key, ...valueParts] = line.split(':');
        const value = valueParts.join(':');
        this.processIcsLine(currentEvent, key, value);
      }
    }
    
    return events;
  }
  
  processIcsLine(currentEvent, key, value) {
    if (!currentEvent || !key) return;
    
    // Handle parameters (e.g., DTSTART;VALUE=DATE:20250721)
    const [baseKey, ...params] = key.split(';');
    const paramMap = {};
    params.forEach(param => {
      const [pKey, pValue] = param.split('=');
      if (pKey && pValue) paramMap[pKey] = pValue;
    });
    
    if (baseKey.startsWith('DTSTART')) {
      currentEvent.start = this.parseIcsDate(value, paramMap);
      // Check if it's an all-day event: VALUE=DATE parameter or no time component (8 digits)
      currentEvent.isAllDay = paramMap.VALUE === 'DATE' || (!baseKey.includes('T') && value.length === 8);
      // Store the original value for later validation
      currentEvent._dtstartValue = value;
      currentEvent._dtstartParams = paramMap;
    } else if (baseKey.startsWith('DTEND')) {
      currentEvent.end = this.parseIcsDate(value, paramMap);
      // Update isAllDay flag: if DTEND is also DATE format, it's definitely all-day
      if (paramMap.VALUE === 'DATE' || (!baseKey.includes('T') && !value.includes('T') && value.length === 8)) {
        currentEvent.isAllDay = true;
      }
      // Store the original value for later validation
      currentEvent._dtendValue = value;
      currentEvent._dtendParams = paramMap;
    } else if (baseKey === 'SUMMARY') {
      currentEvent.title = this.unescapeIcsText(value);
    } else if (baseKey === 'DESCRIPTION') {
      currentEvent.description = this.unescapeIcsText(value);
    } else if (baseKey === 'LOCATION') {
      currentEvent.location = this.unescapeIcsText(value);
    }
  }
  
  unescapeIcsText(text) {
    if (!text) return '';
    return text
      .replace(/\\,/g, ',')
      .replace(/\\;/g, ';')
      .replace(/\\\\/g, '\\')
      .replace(/\\n/g, '\n');
  }

  parseIcsDate(dateStr, params = {}) {
    if (!dateStr) return new Date();
    
    // Handle DATE value type (all-day events)
    if (params.VALUE === 'DATE' || dateStr.length === 8) {
      // All-day: YYYYMMDD
      const year = parseInt(dateStr.substring(0, 4), 10);
      const month = parseInt(dateStr.substring(4, 6), 10) - 1;
      const day = parseInt(dateStr.substring(6, 8), 10);
      return new Date(Date.UTC(year, month, day));
    } else if (dateStr.includes('T')) {
      // DateTime: YYYYMMDDTHHMMSS or YYYYMMDDTHHMMSSZ
      const year = parseInt(dateStr.substring(0, 4), 10);
      const month = parseInt(dateStr.substring(4, 6), 10) - 1;
      const day = parseInt(dateStr.substring(6, 8), 10);
      const hour = parseInt(dateStr.substring(9, 11), 10) || 0;
      const minute = parseInt(dateStr.substring(11, 13), 10) || 0;
      const second = parseInt(dateStr.substring(13, 15), 10) || 0;
      
      if (dateStr.endsWith('Z') || dateStr.length >= 16 && dateStr[15] === 'Z') {
        // UTC time
        return new Date(Date.UTC(year, month, day, hour, minute, second));
      } else {
        // Local time (or timezone specified in TZID param - simplified for now)
        return new Date(year, month, day, hour, minute, second);
      }
    }
    
    // Fallback: try to parse as ISO string
    const parsed = new Date(dateStr);
    if (!isNaN(parsed.getTime())) {
      return parsed;
    }
    
    // Last resort: return current date
    console.warn(`Failed to parse ICS date: ${dateStr}`);
    return new Date();
  }
}

// Export
if (typeof window !== 'undefined') {
  window.GoogleCalendarClient = GoogleCalendarClient;
}



