/**
 * Calendar Widget (Google Calendar - 4 weeks)
 */

class CalendarWidget extends BaseWidget {
  constructor(config = {}) {
    super(config);
    this.type = 'calendar';
    this.calendarClient = null;
    this.events = [];
    this.today = new Date();
    this.today.setHours(0, 0, 0, 0);
    this.cacheKey = 'calendarWidgetCache';
    this.cacheExpiryKey = 'calendarWidgetCacheExpiry';
    this.cacheExpiryMs = 3600000; // 1 hour
  }

  getHTML() {
    return `
      <div class="widget-body" id="${this.id}-body">
        <div class="calendar-loading">Loading calendar...</div>
      </div>
    `;
  }

  loadCachedData() {
    try {
      const cached = localStorage.getItem(this.cacheKey);
      const expiry = localStorage.getItem(this.cacheExpiryKey);
      
      if (cached && expiry && Date.now() < parseInt(expiry, 10)) {
        this.events = JSON.parse(cached);
        // Parse date strings back to Date objects
        this.events = this.events.map(event => ({
          ...event,
          start: new Date(event.start),
          end: new Date(event.end)
        }));
        return true;
      }
    } catch (e) {
      console.warn('Failed to load cached calendar data:', e);
    }
    return false;
  }

  saveCachedData() {
    try {
      // Convert Date objects to ISO strings for storage
      const eventsToCache = this.events.map(event => ({
        ...event,
        start: event.start.toISOString(),
        end: event.end.toISOString()
      }));
      
      localStorage.setItem(this.cacheKey, JSON.stringify(eventsToCache));
      localStorage.setItem(this.cacheExpiryKey, (Date.now() + this.cacheExpiryMs).toString());
    } catch (e) {
      console.warn('Failed to cache calendar data:', e);
    }
  }

  onInit() {
    // Get calendar client from app
    if (window.app && window.app.calendarClient) {
      this.calendarClient = window.app.calendarClient;
    }
    
    // Load cached data immediately
    if (this.loadCachedData()) {
      this.render();
      this.setStatus('connected');
    }
    
    // Update in background
    this.update();
    // Update every 5 minutes
    this.startAutoUpdate(300000);
  }

  async update() {
    if (!this.calendarClient) {
      if (this.events.length === 0) {
        this.showLoading();
      }
      return;
    }

    try {
      this.setStatus('updating');
      
      // Set a timeout for the entire fetch operation
      const fetchPromise = this.calendarClient.fetchEvents();
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('Calendar fetch timeout (>35s)')), 35000);
      });
      
      await Promise.race([fetchPromise, timeoutPromise]);
      
      this.events = this.calendarClient.events || [];
      this.saveCachedData();
      this.render();
      this.setStatus('connected');
    } catch (e) {
      console.error('Calendar update error:', e);
      const errorMessage = e.message || 'Failed to load calendar';
      
      // Only show error if we don't have cached data
      if (this.events.length === 0) {
        if (errorMessage.includes('timeout') || errorMessage.includes('took too long')) {
          this.showError('Calendar is taking too long to load. Check your connection or try again later.');
        } else {
          this.showError(`Failed to load calendar: ${errorMessage}`);
        }
        this.setStatus('error');
      } else {
        // Show warning but keep using cached data
        this.setStatus('connected');
        console.warn('Using cached calendar data due to fetch error');
      }
    }
  }

  render() {
    const body = this.element.querySelector(`#${this.id}-body`);
    if (!body) return;

    // ALWAYS use fresh current date (not cached)
    this.today = new Date();
    this.today.setHours(0, 0, 0, 0);
    
    // Clear stale cache if date changed
    const todayKey = this.dateKey(this.today);
    const lastRenderKey = this._lastRenderDateKey;
    if (lastRenderKey && lastRenderKey !== todayKey) {
      console.log('📅 Date changed, clearing stale cache');
      localStorage.removeItem(this.cacheKey);
      localStorage.removeItem(this.cacheExpiryKey);
    }
    this._lastRenderDateKey = todayKey;

    const days = this.generateDays();
    const eventsByDate = this.groupEventsByDate();

    let html = '<div class="calendar-grid">';
    
    // Day names header
    ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'].forEach(day => {
      html += `<div class="calendar-day-name">${day}</div>`;
    });

    // Calendar days
    days.forEach(day => {
      const key = this.dateKey(day.date);
      const dayEvents = eventsByDate.get(key) || [];
      const isToday = day.date.getTime() === this.today.getTime();
      const isPast = day.date < this.today;

      html += `
        <div class="calendar-day ${isToday ? 'is-today' : ''} ${isPast ? 'is-past' : ''}">
          <div class="calendar-day-num">${day.date.getDate()}</div>
          <div class="calendar-day-events">
            ${this.renderDayEvents(dayEvents)}
          </div>
        </div>
      `;
    });

    html += '</div>';
    body.innerHTML = html;
  }

  generateDays() {
    const days = [];
    const start = new Date(this.today);
    start.setDate(start.getDate() - start.getDay()); // Start of week
    
    // Generate 5 weeks (35 days)
    for (let i = 0; i < 35; i++) {
      const date = new Date(start);
      date.setDate(start.getDate() + i);
      days.push({ date });
    }
    
    return days;
  }

  groupEventsByDate() {
    const grouped = new Map();
    
    if (!this.events || this.events.length === 0) {
      console.warn('⚠️ No events to group');
      return grouped;
    }
    
    console.log(`📅 Grouping ${this.events.length} events by date`);
    
    const now = new Date();
    const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
    
    for (const event of this.events) {
      if (!event.start || !event.end) {
        console.warn('⚠️ Event missing start/end in grouping:', event);
        continue;
      }
      
      try {
        // Create new Date objects to avoid mutating originals
        let startDay = new Date(event.start);
        if (isNaN(startDay.getTime())) {
          console.warn('⚠️ Invalid start date:', event.start, event);
          continue;
        }
        // Use local date components to avoid timezone issues
        const startYear = startDay.getFullYear();
        const startMonth = startDay.getMonth();
        const startDate = startDay.getDate();
        startDay = new Date(startYear, startMonth, startDate, 0, 0, 0, 0);
        
        let endDay = new Date(event.end);
        if (isNaN(endDay.getTime())) {
          console.warn('⚠️ Invalid end date:', event.end, event);
          continue;
        }
        
        // For all-day events, end is exclusive (next day), so subtract 1
        if (event.isAllDay) {
          endDay.setDate(endDay.getDate() - 1);
        }
        // Use local date components for end day too
        const endYear = endDay.getFullYear();
        const endMonth = endDay.getMonth();
        const endDate = endDay.getDate();
        endDay = new Date(endYear, endMonth, endDate, 0, 0, 0, 0);
        
        // For all-day events, extend the end date by 1 hour if it just ended
        if (event.isAllDay) {
          const endDayWithTime = new Date(endYear, endMonth, endDate, 23, 59, 59, 999);
          if (endDayWithTime < now && endDayWithTime >= oneHourAgo) {
            // Event ended within the last hour, include it on the next day too
            const nextDay = new Date(endDay);
            nextDay.setDate(nextDay.getDate() + 1);
            endDay = nextDay;
          }
        }
        
        const currentDay = new Date(startDay);
        while (currentDay <= endDay) {
          const key = this.dateKey(currentDay);
          if (!grouped.has(key)) {
            grouped.set(key, []);
          }
          grouped.get(key).push(event);
          currentDay.setDate(currentDay.getDate() + 1);
        }
      } catch (e) {
        console.error('⚠️ Error grouping event:', e, event);
      }
    }
    
    console.log(`📅 Grouped events into ${grouped.size} days`);
    return grouped;
  }

  dateKey(date) {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  }

  /**
   * Check if a color is light (close to white)
   * Returns true if the color is light enough to need black text
   */
  isLightColor(color) {
    if (!color) return false;
    
    // Remove # if present
    let hex = color.replace('#', '');
    
    // Handle 3-digit hex colors
    if (hex.length === 3) {
      hex = hex.split('').map(c => c + c).join('');
    }
    
    // Parse RGB values
    const r = parseInt(hex.substring(0, 2), 16);
    const g = parseInt(hex.substring(2, 4), 16);
    const b = parseInt(hex.substring(4, 6), 16);
    
    // Calculate relative luminance (perceived brightness)
    // Using the formula from WCAG: 0.2126*R + 0.7152*G + 0.0722*B
    // Normalized to 0-1 range
    const luminance = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
    
    // If luminance is above 0.7, consider it light (needs black text)
    return luminance > 0.7;
  }

  renderDayEvents(events) {
    if (events.length === 0) return '';
    
    // Sort events: all-day first, then by start time
    events.sort((a, b) => {
      // All-day events come first
      if (a.isAllDay && !b.isAllDay) return -1;
      if (!a.isAllDay && b.isAllDay) return 1;
      // Both all-day or both timed - sort by start time
      return new Date(a.start) - new Date(b.start);
    });
    
    // Show ALL events with CONSISTENT size
    const eventCount = events.length;
    
    // Fixed size for all days - no auto-scaling
    const fontSize = '0.7rem';
    const timeFontSize = '0.65rem';
    const padding = '0.12rem 0.2rem';
    const lineClamp = 1;
    
    return events.map(event => {
      const color = event.color || '#3b82f6';
      const isLight = this.isLightColor(color);
      const textColor = isLight ? 'black' : 'white';
      const textShadow = isLight ? 'none' : '0 1px 1px rgba(0, 0, 0, 0.2)';
      const title = Helpers.escapeHtml(event.title);
      
      // ALWAYS show time for ALL events
      let time = '';
      if (event.isAllDay === true) {
        time = 'All Day';
      } else if (event.start) {
        try {
          const startDate = new Date(event.start);
          if (!isNaN(startDate.getTime())) {
            time = Helpers.formatTime(startDate, false);
          }
        } catch (e) {
          time = 'All Day';
        }
      } else {
        time = 'All Day';
      }
      
      // Always use single-line format for consistency
      if (true) {
        return `
          <div class="calendar-event" style="--event-color: ${color}; color: ${textColor}; text-shadow: ${textShadow}; padding: ${padding}; font-size: ${fontSize};">
            <span style="font-size: ${timeFontSize}; opacity: 0.9; margin-right: 0.15rem; font-weight: 600;">${time}</span>
            <span style="white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${title}</span>
          </div>
        `;
      }
      
      // Two-line format for fewer events  
      return `
        <div class="calendar-event" style="--event-color: ${color}; color: ${textColor}; text-shadow: ${textShadow}; padding: ${padding};">
          <div style="font-size: ${timeFontSize}; opacity: 0.85; font-weight: 600;">${time}</div>
          <div style="font-size: ${fontSize}; -webkit-line-clamp: ${lineClamp}; display: -webkit-box; -webkit-box-orient: vertical; overflow: hidden;">${title}</div>
        </div>
      `;
    }).join('');
  }

  showLoading() {
    const body = this.element.querySelector(`#${this.id}-body`);
    if (body) {
      body.innerHTML = '<div class="calendar-loading">Loading calendar...</div>';
    }
  }

  showError(message) {
    const body = this.element.querySelector(`#${this.id}-body`);
    if (body) {
      body.innerHTML = `<div class="calendar-error">${message}</div>`;
    }
  }
}

// Register widget
if (typeof window !== 'undefined' && window.widgetRegistry) {
  window.widgetRegistry.register('calendar', CalendarWidget);
}


