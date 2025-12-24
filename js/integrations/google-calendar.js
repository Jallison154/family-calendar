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
    
    const proxyUrl = this.config.corsProxy + encodeURIComponent(url);
    const response = await fetch(proxyUrl);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    
    const icsText = await response.text();
    return this.parseIcs(icsText, feed, startRange, endRange);
  }

  parseIcs(icsText, feed, startRange, endRange) {
    const events = [];
    const lines = icsText.split(/\r?\n/);
    let currentEvent = null;
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      
      if (line.startsWith('BEGIN:VEVENT')) {
        currentEvent = { color: feed.color || '#3b82f6' };
      } else if (line.startsWith('END:VEVENT')) {
        if (currentEvent && currentEvent.start && currentEvent.end) {
          const start = new Date(currentEvent.start);
          const end = new Date(currentEvent.end);
          
          if (end >= startRange && start <= endRange) {
            events.push(currentEvent);
          }
        }
        currentEvent = null;
      } else if (currentEvent) {
        const [key, ...valueParts] = line.split(':');
        const value = valueParts.join(':');
        
        if (key.startsWith('DTSTART')) {
          currentEvent.start = this.parseIcsDate(value);
          currentEvent.isAllDay = !key.includes('T');
        } else if (key.startsWith('DTEND')) {
          currentEvent.end = this.parseIcsDate(value);
        } else if (key === 'SUMMARY') {
          currentEvent.title = value.replace(/\\,/g, ',').replace(/\\;/g, ';').replace(/\\\\/g, '\\');
        } else if (key === 'DESCRIPTION') {
          currentEvent.description = value.replace(/\\,/g, ',').replace(/\\;/g, ';').replace(/\\\\/g, '\\');
        } else if (key === 'LOCATION') {
          currentEvent.location = value;
        }
      }
    }
    
    return events;
  }

  parseIcsDate(dateStr) {
    if (dateStr.length === 8) {
      // All-day: YYYYMMDD
      const year = parseInt(dateStr.substring(0, 4));
      const month = parseInt(dateStr.substring(4, 6)) - 1;
      const day = parseInt(dateStr.substring(6, 8));
      return new Date(year, month, day);
    } else if (dateStr.includes('T')) {
      // DateTime
      const year = parseInt(dateStr.substring(0, 4));
      const month = parseInt(dateStr.substring(4, 6)) - 1;
      const day = parseInt(dateStr.substring(6, 8));
      const hour = parseInt(dateStr.substring(9, 11)) || 0;
      const minute = parseInt(dateStr.substring(11, 13)) || 0;
      
      if (dateStr.endsWith('Z')) {
        return new Date(Date.UTC(year, month, day, hour, minute));
      } else {
        return new Date(year, month, day, hour, minute);
      }
    }
    
    return new Date(dateStr);
  }
}

// Export
if (typeof window !== 'undefined') {
  window.GoogleCalendarClient = GoogleCalendarClient;
}


