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
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    const end = new Date(now.getTime() + (this.config.weeksAhead + 1) * 7 * 86400000);
    
    const allEvents = [];
    
    for (const feed of this.config.icsFeeds) {
      if (!feed.url || !feed.url.trim()) continue;
      
      try {
        const events = await this.fetchIcsFeed(feed, now, end);
        allEvents.push(...events);
      } catch (e) {
        console.error(`ICS feed error (${feed.name}):`, e);
      }
    }
    
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
        if (currentEvent && currentEvent.start && currentEvent.end) {
          const start = new Date(currentEvent.start);
          const end = new Date(currentEvent.end);
          
          // Only include events that overlap with our date range
          if (end >= startRange && start <= endRange) {
            events.push(currentEvent);
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
      currentEvent.isAllDay = !baseKey.includes('T') || paramMap.VALUE === 'DATE';
    } else if (baseKey.startsWith('DTEND')) {
      currentEvent.end = this.parseIcsDate(value, paramMap);
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



