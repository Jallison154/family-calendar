/**
 * Google Calendar Integration
 * Handles ICS feed fetching and parsing
 */

class GoogleCalendarClient {
  constructor(config = {}) {
    this.config = {
      icsFeeds: config.icsFeeds || [],
      accounts: config.accounts || [],
      weeksAhead: config.weeksAhead || 5,
      refreshInterval: config.refreshInterval || 300000,
      corsProxy: config.corsProxy || 'https://api.allorigins.win/raw?url='
    };
    this.events = [];
  }

  async fetchEvents() {
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    const startRange = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const endRange = new Date(now.getTime() + this.config.weeksAhead * 7 * 86400000);
    const allEvents = [];

    // 1) Fetch from Google Calendar API (works for public calendars when API key is set)
    for (const account of this.config.accounts) {
      const apiKey = account.apiKey || account.key;
      if (!apiKey || apiKey === 'YOUR_GOOGLE_CALENDAR_API_KEY') continue;
      for (const cal of account.calendars || []) {
        if (!cal.id) continue;
        try {
          const events = await this.fetchCalendarApi(apiKey, cal, startRange, endRange);
          allEvents.push(...events);
        } catch (e) {
          console.error(`Calendar API error (${cal.name || cal.id}):`, e.message || e);
        }
      }
    }

    // 2) Fetch from ICS feeds (embed links, secret iCal, or public ICS)
    for (const feed of this.config.icsFeeds) {
      if (!feed.url || !feed.url.trim()) continue;
      try {
        const events = await this.fetchIcsFeed(feed, startRange, endRange);
        allEvents.push(...events);
      } catch (e) {
        console.error(`ICS feed error (${feed.name}):`, e);
      }
    }

    // Dedupe by title + start + end
    const seen = new Set();
    this.events = allEvents.filter(event => {
      const key = `${event.title || ''}|${event.start?.getTime?.() ?? event.start}|${event.end?.getTime?.() ?? event.end}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }

  /**
   * Fetch events via Google Calendar API v3 (API key only works for public calendars).
   * Calendar ID format: xxx@group.calendar.google.com or the long c_xxx@group.calendar.google.com
   */
  async fetchCalendarApi(apiKey, calendar, start, end) {
    const url = new URL(`https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendar.id)}/events`);
    url.searchParams.set('key', apiKey);
    url.searchParams.set('timeMin', start.toISOString());
    url.searchParams.set('timeMax', end.toISOString());
    url.searchParams.set('singleEvents', 'true');
    url.searchParams.set('orderBy', 'startTime');
    url.searchParams.set('maxResults', '250');

    const res = await fetch(url);
    if (!res.ok) {
      const err = await res.text();
      throw new Error(res.status === 403 ? 'Calendar API: access denied (calendar may be private; API key only works for public calendars)' : `Calendar API: ${res.status} ${err}`);
    }
    const data = await res.json();
    return (data.items || []).map(event => {
      const isAllDay = !event.start.dateTime;
      const start = isAllDay ? new Date(event.start.date + 'T00:00:00') : new Date(event.start.dateTime);
      const end = isAllDay ? new Date(event.end.date + 'T00:00:00') : new Date(event.end.dateTime);
      return {
        id: event.id,
        title: event.summary || 'Untitled',
        start,
        end,
        isAllDay,
        location: event.location,
        color: calendar.color || '#3b82f6'
      };
    });
  }

  async fetchIcsFeed(feed, startRange, endRange) {
    let url = feed.url.trim();
    
    // If it's already an iCal feed URL (e.g. secret link), use as-is
    const isAlreadyIcal = url.includes('/ical/') && url.includes('.ics');
    
    // Convert Google Calendar embed/web URLs to ICS feed URL
    if (!isAlreadyIcal && url.includes('calendar.google.com')) {
      let calendarId = null;
      if (url.includes('src=')) {
        const match = url.match(/[?&]src=([^&]+)/);
        if (match) calendarId = decodeURIComponent(match[1]);
      }
      if (!calendarId && url.includes('cid=')) {
        const match = url.match(/cid=([^&]+)/);
        if (match) calendarId = decodeURIComponent(match[1]);
      }
      if (calendarId) {
        url = `https://calendar.google.com/calendar/ical/${encodeURIComponent(calendarId)}/public/basic.ics`;
      }
    }
    
    const proxyUrl = '/api/calendar?url=' + encodeURIComponent(url);
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000);
    
    try {
      const response = await fetch(proxyUrl, {
        signal: controller.signal,
        headers: { 'Accept': 'text/calendar, text/plain, */*' }
      });
      
      clearTimeout(timeoutId);
      
      if (!response.ok) {
        const errorText = await response.text().catch(() => '');
        let errorMsg = `HTTP ${response.status}: ${response.statusText}`;
        try {
          const errorJson = JSON.parse(errorText);
          if (errorJson.error) errorMsg = errorJson.error;
        } catch (e) {}
        if (response.status === 404) {
          errorMsg = 'Calendar not found (404). With only an embed link you must make the calendar public: Google Calendar → click the calendar → Settings and sharing → Access permissions → "Make available to public" (e.g. "See all event details"). Then the same embed link will work here.';
        }
        throw new Error(errorMsg);
      }
      
      const icsText = await response.text();
      
      if (!icsText || icsText.trim().length === 0) {
        throw new Error('ICS feed returned empty response');
      }
      
      const events = this.parseIcs(icsText, feed, startRange, endRange);
      
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
          // Handle missing dates - try to salvage events with titles
          if (!currentEvent.start || !currentEvent.end) {
            console.warn('⚠️ Event missing start/end dates:', currentEvent.title || 'Untitled', {
              hasStart: !!currentEvent.start,
              hasEnd: !!currentEvent.end,
              dtstartValue: currentEvent._dtstartValue,
              dtendValue: currentEvent._dtendValue,
              allProps: Object.keys(currentEvent)
            });
            
            // Try to salvage events with titles by using fallback dates
            if (currentEvent.title) {
              const today = new Date();
              today.setHours(0, 0, 0, 0);
              
              if (!currentEvent.start) {
                currentEvent.start = new Date(today);
              }
              if (!currentEvent.end) {
                currentEvent.end = new Date(currentEvent.start);
                currentEvent.end.setDate(currentEvent.end.getDate() + 1);
              }
              currentEvent.isAllDay = true;
              console.log('📅 Using fallback dates for event:', currentEvent.title, 'start:', currentEvent.start.toISOString(), 'end:', currentEvent.end.toISOString());
            } else {
              // Skip events without start/end dates AND no title
              console.warn('⚠️ Skipping event with no title and no dates');
              currentEvent = null;
              continuationLine = '';
              continue;
            }
          }
          let start = new Date(currentEvent.start);
          let end = new Date(currentEvent.end);
          
          // STRICT all-day detection: ONLY mark as all-day if EXPLICITLY VALUE=DATE
          // Events with any time component should show their time, not "All Day"
          const dtstartHasExplicitDate = currentEvent._dtstartParams?.VALUE === 'DATE';
          const dtendHasExplicitDate = currentEvent._dtendParams?.VALUE === 'DATE';
          
          // Only mark as all-day if BOTH have explicit VALUE=DATE parameter
          if (dtstartHasExplicitDate && dtendHasExplicitDate) {
            currentEvent.isAllDay = true;
            // Normalize dates for all-day events
            const startDate = new Date(start);
            startDate.setHours(0, 0, 0, 0);
            currentEvent.start = startDate;
            currentEvent.end = new Date(startDate);
            currentEvent.end.setDate(currentEvent.end.getDate() + 1);
            start = startDate;
            end = currentEvent.end;
          } else {
            // Ensure isAllDay is false for events with times
            currentEvent.isAllDay = false;
          }
          
          // Clean up temporary properties
          delete currentEvent._dtstartValue;
          delete currentEvent._dtstartParams;
          delete currentEvent._dtendValue;
          delete currentEvent._dtendParams;
          
          // Include all events - filtering will happen after parsing
          // This allows us to properly handle all-day events
          events.push(currentEvent);
          
          if (!currentEvent.title) {
            console.warn('⚠️ Event has no title:', currentEvent);
          }
        }
        currentEvent = null;
        continuationLine = '';
      } else if (currentEvent) {
        // Handle property line (KEY:VALUE or KEY;PARAMS:VALUE)
        const colonIndex = line.indexOf(':');
        if (colonIndex > 0) {
          const key = line.substring(0, colonIndex);
          const value = line.substring(colonIndex + 1);
          this.processIcsLine(currentEvent, key, value);
        } else {
          // Line doesn't have a colon, might be malformed - skip it
          console.warn('⚠️ Skipping malformed ICS line (no colon):', line.substring(0, 50));
        }
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
      // DON'T set isAllDay here - wait until we have both DTSTART and DTEND
      // to make a proper determination in END:VEVENT handler
      // Store the original value for later validation
      currentEvent._dtstartValue = value;
      currentEvent._dtstartParams = paramMap;
    } else if (baseKey.startsWith('DTEND')) {
      currentEvent.end = this.parseIcsDate(value, paramMap);
      // DON'T set isAllDay here - wait until END:VEVENT handler
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
    
    // All parsed dates are used with getFullYear(), getMonth(), getDate(), getHours() etc.,
    // which use the browser's local timezone. So we build instants correctly here.
    
    // Handle DATE value type (all-day events)
    // YYYYMMDD = date in browser's local day (no time)
    if (params.VALUE === 'DATE' || dateStr.length === 8) {
      const year = parseInt(dateStr.substring(0, 4), 10);
      const month = parseInt(dateStr.substring(4, 6), 10) - 1;
      const day = parseInt(dateStr.substring(6, 8), 10);
      return new Date(year, month, day, 0, 0, 0, 0);
    }
    if (dateStr.includes('T')) {
      const year = parseInt(dateStr.substring(0, 4), 10);
      const month = parseInt(dateStr.substring(4, 6), 10) - 1;
      const day = parseInt(dateStr.substring(6, 8), 10);
      const hour = parseInt(dateStr.substring(9, 11), 10) || 0;
      const minute = parseInt(dateStr.substring(11, 13), 10) || 0;
      const second = parseInt(dateStr.substring(13, 15), 10) || 0;
      
      if (dateStr.endsWith('Z') || (dateStr.length >= 16 && dateStr[15] === 'Z')) {
        // UTC: store as instant; getHours()/getDate() etc. will use browser timezone when read
        return new Date(Date.UTC(year, month, day, hour, minute, second));
      }
      // Floating/local: treat as browser local time (same as "today" and display)
      return new Date(year, month, day, hour, minute, second);
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



