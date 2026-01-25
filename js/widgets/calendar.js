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
    
    // Generate 4 weeks (28 days)
    for (let i = 0; i < 28; i++) {
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
    
    for (const event of this.events) {
      if (!event.start || !event.end) {
        console.warn('⚠️ Event missing start/end in grouping:', event);
        continue;
      }
      
      try {
        let startDay = new Date(event.start);
        if (isNaN(startDay.getTime())) {
          console.warn('⚠️ Invalid start date:', event.start, event);
          continue;
        }
        startDay.setHours(0, 0, 0, 0);
        
        let endDay = new Date(event.end);
        if (isNaN(endDay.getTime())) {
          console.warn('⚠️ Invalid end date:', event.end, event);
          continue;
        }
        if (event.isAllDay) {
          endDay.setDate(endDay.getDate() - 1);
        }
        endDay.setHours(0, 0, 0, 0);
        
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
    
    // Limit to 5 visible events, show "X more" if needed
    const visible = events.slice(0, 5);
    const more = events.length - 5;
    
    return visible.map(event => {
      const color = event.color || '#3b82f6';
      const isLight = this.isLightColor(color);
      const textColor = isLight ? 'black' : 'white';
      const textShadow = isLight ? 'none' : '0 1px 2px rgba(0, 0, 0, 0.2)';
      const title = Helpers.escapeHtml(event.title);
      
      // ALWAYS show time for ALL events
      // All-day events show "All Day", timed events show their start time
      let time = '';
      if (event.isAllDay === true) {
        time = 'All Day';
      } else if (event.start) {
        try {
          const startDate = new Date(event.start);
          // Check if date is valid
          if (!isNaN(startDate.getTime())) {
            // Show the actual start time
            time = Helpers.formatTime(startDate, false);
          }
        } catch (e) {
          console.warn('Error formatting event time:', e, event);
          time = 'All Day'; // Fallback if time parsing fails
        }
      } else {
        time = 'All Day'; // Fallback for events with no start time
      }
      
      return `
        <div class="calendar-event" style="--event-color: ${color}; color: ${textColor}; text-shadow: ${textShadow};">
          <div style="font-size: 0.55rem; opacity: 0.85; font-weight: 600;">${time}</div>
          <div style="font-size: 0.6rem;">${title}</div>
        </div>
      `;
    }).join('') + (more > 0 ? `<div class="calendar-event-more">${more} more</div>` : '');
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


