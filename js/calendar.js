/**
 * Calendar Widget - Supports Google API and ICS Feeds
 */

class GoogleCalendarWidget {
  constructor(config) {
    this.config = {
      accounts: config.accounts || [],
      icsFeeds: config.icsFeeds || [], // NEW: ICS feed support
      apiKey: config.apiKey || '',
      calendars: config.calendars || [],
      weeksAhead: config.weeksAhead || 4,
      refreshInterval: config.refreshInterval || 300000,
      corsProxy: config.corsProxy || 'https://api.allorigins.win/raw?url=' // CORS proxy for ICS
    };
    
    if (this.config.accounts.length === 0 && this.config.apiKey) {
      this.config.accounts = [{
        name: 'Default',
        apiKey: this.config.apiKey,
        calendars: this.config.calendars
      }];
    }
    
    this.events = [];
    this.gridEl = null;
    this.today = new Date();
    this.today.setHours(0, 0, 0, 0);
  }

  async init() {
    this.gridEl = document.getElementById('calendar-grid');
    if (!this.gridEl) return;

    const hasApiConfig = this.config.accounts.some(a => 
      a.apiKey && a.apiKey !== 'YOUR_GOOGLE_CALENDAR_API_KEY' && a.calendars?.length
    );
    
    const hasIcsFeeds = this.config.icsFeeds.some(f => f.url && f.url.trim());

    if (!hasApiConfig && !hasIcsFeeds) {
      this.loadDemoEvents();
    } else {
      await this.fetchEvents();
    }

    this.render();
    this.startAutoRefresh();
    this.scheduleMidnightUpdate();
  }

  async fetchEvents() {
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    const end = new Date(now.getTime() + (this.config.weeksAhead + 1) * 7 * 86400000);
    
    const allEvents = [];
    
    // Fetch from Google API
    for (const account of this.config.accounts) {
      if (!account.apiKey || account.apiKey === 'YOUR_GOOGLE_CALENDAR_API_KEY') continue;
      
      for (const cal of (account.calendars || [])) {
        try {
          const events = await this.fetchCalendar(account.apiKey, cal, now, end);
          allEvents.push(...events);
        } catch (e) {
          console.warn(`Calendar API error (${cal.name}):`, e.message);
        }
      }
    }
    
    // Fetch from ICS feeds
    for (const feed of this.config.icsFeeds) {
      if (!feed.url || !feed.url.trim()) continue;
      try {
        const events = await this.fetchIcsFeed(feed, now, end);
        allEvents.push(...events);
      } catch (e) {
        console.warn(`ICS feed error (${feed.name}):`, e.message);
      }
    }
    
    this.events = allEvents;
  }

  async fetchCalendar(apiKey, calendar, start, end) {
    const url = new URL(`https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendar.id)}/events`);
    url.searchParams.set('key', apiKey);
    url.searchParams.set('timeMin', start.toISOString());
    url.searchParams.set('timeMax', end.toISOString());
    url.searchParams.set('singleEvents', 'true');
    url.searchParams.set('orderBy', 'startTime');
    url.searchParams.set('maxResults', '100');

    const res = await fetch(url);
    if (!res.ok) throw new Error('API error');
    
    const data = await res.json();
    
    return (data.items || []).map(event => ({
      id: event.id,
      title: event.summary || 'Untitled',
      start: new Date(event.start.dateTime || event.start.date),
      end: new Date(event.end.dateTime || event.end.date),
      isAllDay: !event.start.dateTime,
      location: event.location,
      color: calendar.color || '#3b82f6',
      calendarName: calendar.name
    }));
  }

  async fetchIcsFeed(feed, startRange, endRange) {
    // Use CORS proxy to fetch ICS
    const proxyUrl = this.config.corsProxy + encodeURIComponent(feed.url);
    
    const res = await fetch(proxyUrl);
    if (!res.ok) throw new Error(`Failed to fetch ICS: ${res.status}`);
    
    const icsText = await res.text();
    return this.parseIcs(icsText, feed, startRange, endRange);
  }

  parseIcs(icsText, feed, startRange, endRange) {
    const events = [];
    const lines = icsText.replace(/\r\n /g, '').split(/\r\n|\n|\r/);
    
    let currentEvent = null;
    
    for (let line of lines) {
      // Handle line continuations
      if (line.startsWith(' ') || line.startsWith('\t')) {
        continue;
      }
      
      if (line === 'BEGIN:VEVENT') {
        currentEvent = {};
      } else if (line === 'END:VEVENT' && currentEvent) {
        // Process completed event
        if (currentEvent.start) {
          const start = this.parseIcsDate(currentEvent.start);
          let end = currentEvent.end ? this.parseIcsDate(currentEvent.end) : new Date(start.getTime() + 3600000);
          
          // Filter by date range
          if (start <= endRange && end >= startRange) {
            const isAllDay = currentEvent.start.length === 8; // YYYYMMDD format
            
            events.push({
              id: currentEvent.uid || Math.random().toString(36),
              title: currentEvent.summary || 'Untitled',
              start,
              end,
              isAllDay,
              location: currentEvent.location,
              color: feed.color || '#3b82f6',
              calendarName: feed.name || 'Calendar'
            });
          }
        }
        currentEvent = null;
      } else if (currentEvent) {
        // Parse event properties
        const colonIdx = line.indexOf(':');
        if (colonIdx > 0) {
          let key = line.substring(0, colonIdx);
          let value = line.substring(colonIdx + 1);
          
          // Handle properties with parameters (e.g., DTSTART;VALUE=DATE:20231225)
          const semiIdx = key.indexOf(';');
          if (semiIdx > 0) {
            key = key.substring(0, semiIdx);
          }
          
          // Unescape ICS text
          value = value
            .replace(/\\n/g, '\n')
            .replace(/\\,/g, ',')
            .replace(/\\;/g, ';')
            .replace(/\\\\/g, '\\');
          
          switch (key) {
            case 'SUMMARY':
              currentEvent.summary = value;
              break;
            case 'DTSTART':
              currentEvent.start = value;
              break;
            case 'DTEND':
              currentEvent.end = value;
              break;
            case 'LOCATION':
              currentEvent.location = value;
              break;
            case 'UID':
              currentEvent.uid = value;
              break;
          }
        }
      }
    }
    
    return events;
  }

  parseIcsDate(dateStr) {
    // Handle different ICS date formats
    // YYYYMMDD (all-day)
    // YYYYMMDDTHHmmss (local time)
    // YYYYMMDDTHHmmssZ (UTC)
    
    dateStr = dateStr.replace(/[^0-9TZ]/g, '');
    
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
      const second = parseInt(dateStr.substring(13, 15)) || 0;
      
      if (dateStr.endsWith('Z')) {
        return new Date(Date.UTC(year, month, day, hour, minute, second));
      } else {
        return new Date(year, month, day, hour, minute, second);
      }
    }
    
    return new Date(dateStr);
  }

  loadDemoEvents() {
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    
    // Color palette
    const c = {
      red: '#ef4444',
      orange: '#f59e0b', 
      green: '#10b981',
      blue: '#3b82f6',
      purple: '#8b5cf6',
      pink: '#ec4899',
      cyan: '#06b6d4',
      amber: '#d97706'
    };
    
    this.events = [
      // Today
      { id: '1', title: 'Morning Coffee ☕', start: new Date(now.getTime() + 8*3600000), end: new Date(now.getTime() + 8.5*3600000), isAllDay: false, color: c.amber },
      { id: '2', title: 'Team Standup', start: new Date(now.getTime() + 9*3600000), end: new Date(now.getTime() + 9.5*3600000), isAllDay: false, color: c.blue },
      { id: '3', title: 'Lunch with Sarah', start: new Date(now.getTime() + 12*3600000), end: new Date(now.getTime() + 13*3600000), isAllDay: false, color: c.pink },
      { id: '4', title: 'Dentist 🦷', start: new Date(now.getTime() + 14*3600000), end: new Date(now.getTime() + 15*3600000), isAllDay: false, color: c.red },
      { id: '5', title: 'Pick up kids', start: new Date(now.getTime() + 15.5*3600000), end: new Date(now.getTime() + 16*3600000), isAllDay: false, color: c.green },
      
      // Tomorrow
      { id: '6', title: 'Gym 💪', start: new Date(now.getTime() + 86400000 + 6.5*3600000), end: new Date(now.getTime() + 86400000 + 7.5*3600000), isAllDay: false, color: c.green },
      { id: '7', title: 'Client Call', start: new Date(now.getTime() + 86400000 + 10*3600000), end: new Date(now.getTime() + 86400000 + 11*3600000), isAllDay: false, color: c.purple },
      { id: '8', title: 'Piano Lesson - Emma', start: new Date(now.getTime() + 86400000 + 16*3600000), end: new Date(now.getTime() + 86400000 + 17*3600000), isAllDay: false, color: c.cyan },
      
      // Day 2
      { id: '9', title: "Mom's Birthday 🎂", start: new Date(now.getTime() + 2*86400000), end: new Date(now.getTime() + 3*86400000), isAllDay: true, color: c.pink },
      { id: '10', title: 'Birthday Dinner', start: new Date(now.getTime() + 2*86400000 + 18*3600000), end: new Date(now.getTime() + 2*86400000 + 21*3600000), isAllDay: false, color: c.pink },
      
      // Day 3
      { id: '11', title: 'Gym 💪', start: new Date(now.getTime() + 3*86400000 + 6.5*3600000), end: new Date(now.getTime() + 3*86400000 + 7.5*3600000), isAllDay: false, color: c.green },
      { id: '12', title: 'Grocery Shopping', start: new Date(now.getTime() + 3*86400000 + 11*3600000), end: new Date(now.getTime() + 3*86400000 + 12*3600000), isAllDay: false, color: c.amber },
      
      // Day 4
      { id: '13', title: 'Date Night 💕', start: new Date(now.getTime() + 4*86400000 + 19*3600000), end: new Date(now.getTime() + 4*86400000 + 22*3600000), isAllDay: false, color: c.pink },
      
      // Day 5-8: Beach Vacation
      { id: '14', title: '🏖️ Beach Vacation', start: new Date(now.getTime() + 5*86400000), end: new Date(now.getTime() + 9*86400000), isAllDay: true, color: c.cyan },
      
      // Day 6
      { id: '15', title: 'Soccer Game ⚽', start: new Date(now.getTime() + 6*86400000 + 10*3600000), end: new Date(now.getTime() + 6*86400000 + 12*3600000), isAllDay: false, color: c.green },
      
      // Day 9
      { id: '16', title: 'Car Service 🚗', start: new Date(now.getTime() + 9*86400000 + 9*3600000), end: new Date(now.getTime() + 9*86400000 + 11*3600000), isAllDay: false, color: c.orange },
      
      // Day 10
      { id: '17', title: 'Bills Due 💳', start: new Date(now.getTime() + 10*86400000), end: new Date(now.getTime() + 11*86400000), isAllDay: true, color: c.red },
      { id: '18', title: 'Book Club 📚', start: new Date(now.getTime() + 10*86400000 + 19*3600000), end: new Date(now.getTime() + 10*86400000 + 21*3600000), isAllDay: false, color: c.purple },
      
      // Day 12-14: Conference
      { id: '19', title: '🎤 Tech Conference', start: new Date(now.getTime() + 12*86400000), end: new Date(now.getTime() + 15*86400000), isAllDay: true, color: c.blue },
      
      // Day 15
      { id: '20', title: 'Gym 💪', start: new Date(now.getTime() + 15*86400000 + 6.5*3600000), end: new Date(now.getTime() + 15*86400000 + 7.5*3600000), isAllDay: false, color: c.green },
      
      // Day 17
      { id: '21', title: 'Movie Night 🎬', start: new Date(now.getTime() + 17*86400000 + 19*3600000), end: new Date(now.getTime() + 17*86400000 + 22*3600000), isAllDay: false, color: c.purple },
      
      // Day 20
      { id: '22', title: 'School Play 🎭', start: new Date(now.getTime() + 20*86400000 + 18*3600000), end: new Date(now.getTime() + 20*86400000 + 20*3600000), isAllDay: false, color: c.amber },
      
      // Day 24
      { id: '23', title: '🎄 Christmas Eve', start: new Date(now.getTime() + 24*86400000), end: new Date(now.getTime() + 25*86400000), isAllDay: true, color: c.red },
      
      // Day 25
      { id: '24', title: '🎅 Christmas Day', start: new Date(now.getTime() + 25*86400000), end: new Date(now.getTime() + 26*86400000), isAllDay: true, color: c.green },
    ];
  }

  render() {
    if (!this.gridEl) return;
    
    this.today = new Date();
    this.today.setHours(0, 0, 0, 0);
    
    const days = this.generateDays();
    const eventsByDate = this.groupEventsByDate();
    
    // Update month label with fade
    const monthEl = document.getElementById('calendar-month');
    if (monthEl) {
      const middleDate = days[Math.floor(days.length / 2)]?.date || new Date();
      const newMonth = middleDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
      if (monthEl.textContent !== newMonth) {
        monthEl.style.opacity = '0';
        setTimeout(() => {
          monthEl.textContent = newMonth;
          monthEl.style.opacity = '1';
        }, 300);
      }
    }
    
    let html = '';
    
    // Header
    html += '<div class="calendar-header">';
    ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'].forEach(d => {
      html += `<div class="calendar-day-name">${d}</div>`;
    });
    html += '</div>';
    
    // Body
    html += '<div class="calendar-body">';
    
    let week = [];
    days.forEach((day, i) => {
      week.push(day);
      
      if (week.length === 7 || i === days.length - 1) {
        html += '<div class="calendar-week">';
        
        week.forEach((d, dayIndex) => {
          const key = this.dateKey(d.date);
          const dayEvents = eventsByDate.get(key) || [];
          const isToday = d.date.getTime() === this.today.getTime();
          const isWeekend = d.date.getDay() === 0 || d.date.getDay() === 6;
          const isPast = d.date < this.today;
          const showMonth = d.date.getDate() === 1 || (i < 7 && dayIndex === 0);
          
          html += `
            <div class="calendar-day ${isToday ? 'is-today' : ''} ${isWeekend ? 'is-weekend' : ''} ${isPast ? 'is-past' : ''}">
              <div class="calendar-day-header">
                <div class="calendar-day-info">
                  <span class="calendar-day-num">${d.date.getDate()}</span>
                  ${showMonth ? `<span class="calendar-day-month">${d.date.toLocaleDateString('en-US', { month: 'short' })}</span>` : ''}
                </div>
              </div>
              <div class="calendar-day-events">
                ${this.renderDayEvents(dayEvents, d.date)}
              </div>
            </div>
          `;
        });
        
        html += '</div>';
        week = [];
      }
    });
    
    html += '</div>';
    
    this.gridEl.innerHTML = html;
  }

  generateDays() {
    const days = [];
    const start = new Date(this.today);
    start.setDate(start.getDate() - start.getDay());
    
    const totalDays = 7 + (this.config.weeksAhead * 7);
    
    for (let i = 0; i < totalDays; i++) {
      const date = new Date(start);
      date.setDate(start.getDate() + i);
      days.push({ date });
    }
    
    return days;
  }

  groupEventsByDate() {
    const grouped = new Map();
    
    for (const event of this.events) {
      let startDay = new Date(event.start);
      startDay.setHours(0, 0, 0, 0);
      
      let endDay = new Date(event.end);
      if (event.isAllDay) endDay.setDate(endDay.getDate() - 1);
      endDay.setHours(0, 0, 0, 0);
      
      const current = new Date(startDay);
      
      while (current <= endDay) {
        const key = this.dateKey(current);
        if (!grouped.has(key)) grouped.set(key, []);
        
        const isStart = current.getTime() === startDay.getTime();
        const isEnd = current.getTime() === endDay.getTime();
        
        grouped.get(key).push({
          ...event,
          isStart,
          isEnd,
          isMiddle: !isStart && !isEnd,
          isMultiDay: startDay.getTime() !== endDay.getTime()
        });
        
        current.setDate(current.getDate() + 1);
      }
    }
    
    for (const [key, events] of grouped) {
      events.sort((a, b) => {
        if (a.isAllDay && !b.isAllDay) return -1;
        if (!a.isAllDay && b.isAllDay) return 1;
        return new Date(a.start) - new Date(b.start);
      });
    }
    
    return grouped;
  }

  renderDayEvents(events, date) {
    // Skip past dates
    if (date < this.today) return '';
    
    // No events for this day
    if (events.length === 0) return '';
    
    // Determine if this is a "busy" day (5+ events)
    const isBusy = events.length >= 5;
    const busyClass = isBusy ? 'busy-day' : '';
    
    // Separate all-day events and timed events
    const allDayEvents = events.filter(e => e.isAllDay);
    const timedEvents = events.filter(e => !e.isAllDay);
    
    let html = '';
    
    // Render all-day events at top (compact when busy)
    if (allDayEvents.length > 0) {
      const allDayHtml = allDayEvents.map(event => {
        const multiDayClass = event.isMultiDay ? 'multi-day' : '';
        const spanClass = event.isMultiDay ? 
          (event.isStart ? 'span-start' : event.isEnd ? 'span-end' : 'span-middle') : '';
        const showTitle = event.isStart || !event.isMultiDay;
        
        let durationBadge = '';
        if (event.isMultiDay && event.isStart) {
          const startDate = new Date(event.start);
          startDate.setHours(0, 0, 0, 0);
          let endDate = new Date(event.end);
          if (event.isAllDay) endDate.setDate(endDate.getDate() - 1);
          endDate.setHours(0, 0, 0, 0);
          const days = Math.round((endDate - startDate) / 86400000) + 1;
          durationBadge = `<span class="event-duration">${days}d</span>`;
        }
        
        return `
          <div class="calendar-event all-day ${multiDayClass} ${spanClass} ${busyClass}" style="--event-color: ${event.color};" title="${this.escapeHtml(event.title)}">
            ${showTitle ? `<span class="event-title">${this.escapeHtml(event.title)}</span>${durationBadge}` : ''}
          </div>
        `;
      }).join('');
      
      html += `<div class="all-day-events">${allDayHtml}</div>`;
    }
    
    // Render timed events (scrollable when busy)
    if (timedEvents.length > 0) {
      const timedHtml = timedEvents.map(event => {
        const timeStr = new Date(event.start).toLocaleTimeString('en-US', { 
          hour: 'numeric', 
          minute: '2-digit' 
        }).toLowerCase().replace(' ', '');
        
        return `
          <div class="calendar-event timed ${busyClass}" style="--event-color: ${event.color};" title="${this.escapeHtml(event.title)} at ${timeStr}">
            <span class="event-time">${timeStr}</span>
            <span class="event-title">${this.escapeHtml(event.title)}</span>
          </div>
        `;
      }).join('');
      
      html += `<div class="timed-events ${isBusy ? 'scrollable' : ''}">${timedHtml}</div>`;
    }
    
    // Show event count indicator for very busy days
    if (events.length >= 6) {
      html += `<div class="event-count">${events.length} events</div>`;
    }
    
    return html;
  }

  dateKey(date) {
    // Use local date parts to avoid timezone issues
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  startAutoRefresh() {
    setInterval(async () => {
      await this.fetchEvents();
      this.render();
    }, this.config.refreshInterval);
  }

  scheduleMidnightUpdate() {
    const now = new Date();
    const midnight = new Date(now);
    midnight.setDate(midnight.getDate() + 1);
    midnight.setHours(0, 0, 0, 0);
    
    setTimeout(() => {
      this.render();
      setInterval(() => this.render(), 86400000);
    }, midnight - now);
  }

  async refresh() {
    await this.fetchEvents();
    this.render();
  }

  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text || '';
    return div.innerHTML;
  }
}

window.GoogleCalendarWidget = GoogleCalendarWidget;
