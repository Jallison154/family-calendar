/**
 * Today's Events Widget
 * Shows detailed information for today's calendar events
 */

class TodaysEventsWidget extends BaseWidget {
  constructor(config = {}) {
    super(config);
    this.type = 'todays-events';
    this.calendarClient = null;
    this.events = [];
    this.today = new Date();
    this.today.setHours(0, 0, 0, 0);
  }

  getHTML() {
    return `
      <div class="widget-body" id="${this.id}-body">
        <div class="todays-events-loading">Loading today's events...</div>
      </div>
    `;
  }

  onInit() {
    // Get calendar client from app
    if (window.app && window.app.calendarClient) {
      this.calendarClient = window.app.calendarClient;
    }
    
    this.update();
    // Update every 5 minutes
    this.startAutoUpdate(300000);
  }

  async update() {
    if (!this.calendarClient) {
      this.showLoading();
      return;
    }

    // Force refresh events from calendar client
    try {
      // If calendar client has events, use them; otherwise trigger a fetch
      if (this.calendarClient.events && this.calendarClient.events.length > 0) {
        this.events = this.calendarClient.events;
      } else {
        // Wait a bit for calendar to load, then use its events
        await new Promise(resolve => setTimeout(resolve, 1000));
        this.events = this.calendarClient.events || [];
      }
      this.render();
    } catch (e) {
      console.error('Today\'s events update error:', e);
      this.events = this.calendarClient.events || [];
      this.render();
    }
  }

  render() {
    const body = this.element.querySelector(`#${this.id}-body`);
    if (!body) return;

    // ALWAYS refresh today's date (don't use stale constructor value)
    this.today = new Date();
    this.today.setHours(0, 0, 0, 0);

    // Get today's date string
    const todayDateStr = this.today.toLocaleDateString('en-US', { 
      weekday: 'long', 
      month: 'long', 
      day: 'numeric' 
    });

    // Get today's events
    const todayKey = this.dateKey(this.today);
    const todayEvents = this.getTodaysEvents();
    
    let html = `
      <div class="todays-section-header">
        <div class="todays-section-title">Today</div>
        <div class="todays-section-date">${todayDateStr}</div>
      </div>
    `;

    if (todayEvents.length === 0) {
      html += `
        <div class="todays-events-empty">
          <div class="todays-events-empty-icon">✨</div>
          <div class="todays-events-empty-text">No events scheduled for today</div>
        </div>
      `;
      body.innerHTML = html;
      return;
    }

    // Sort events by start time (all-day events first, then by time)
    todayEvents.sort((a, b) => {
      if (a.isAllDay && !b.isAllDay) return -1;
      if (!a.isAllDay && b.isAllDay) return 1;
      if (a.isAllDay && b.isAllDay) return 0;
      return new Date(a.start) - new Date(b.start);
    });

    const now = new Date();
    html += '<div class="todays-events-list">';
    
    todayEvents.forEach(event => {
      const start = new Date(event.start);
      const end = new Date(event.end);
      const isNow = !event.isAllDay && start <= now && end > now;
      const isPast = !event.isAllDay && end < now;
      const isUpcoming = !event.isAllDay && start > now;
      
      let timeStr = 'All Day';
      let durationStr = '';
      if (!event.isAllDay) {
        const use24Hour = window.CONFIG?.display?.use24Hour || false;
        timeStr = Helpers.formatTime(start, use24Hour);
        const endTime = Helpers.formatTime(end, use24Hour);
        durationStr = ` - ${endTime}`;
      }

      const color = event.color || '#3b82f6';
      const title = Helpers.escapeHtml(event.title || 'Untitled Event');
      const location = event.location ? Helpers.escapeHtml(event.location) : null;

      html += `
        <div class="todays-event-item ${isNow ? 'is-now' : ''} ${isPast ? 'is-past' : ''}" style="--event-color: ${color}">
          <div class="todays-event-time">
            <div class="todays-event-time-main">${timeStr}</div>
            ${durationStr ? `<div class="todays-event-time-duration">${durationStr}</div>` : ''}
          </div>
          <div class="todays-event-content">
            <div class="todays-event-title">${title}</div>
            ${location ? `<div class="todays-event-location">📍 ${location}</div>` : ''}
          </div>
          ${isNow ? '<div class="todays-event-now-badge">NOW</div>' : ''}
        </div>
      `;
    });

    html += '</div>';
    body.innerHTML = html;
  }

  getTodaysEvents() {
    const events = [];
    
    // Get today's date boundaries in LOCAL time
    const todayStart = new Date(this.today);
    todayStart.setHours(0, 0, 0, 0);
    const todayEnd = new Date(this.today);
    todayEnd.setHours(23, 59, 59, 999);
    
    // For all-day events, keep them visible for 1 hour after they end
    const now = new Date();
    const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
    
    console.log('📅 Checking events for today:', todayStart.toDateString());
    
    for (const event of this.events) {
      // Use local date components to avoid timezone issues
      const eventStart = new Date(event.start);
      const eventEnd = new Date(event.end);
      
      // For all-day events, check if the date matches
      if (event.isAllDay) {
        // All-day event: check if today falls within the event's date range
        const eventStartYear = eventStart.getFullYear();
        const eventStartMonth = eventStart.getMonth();
        const eventStartDate = eventStart.getDate();
        const eventStartDay = new Date(eventStartYear, eventStartMonth, eventStartDate, 0, 0, 0, 0);
        
        let eventEndDay = new Date(eventEnd);
        // All-day events typically have end = start + 1 day, so subtract 1
        eventEndDay.setDate(eventEndDay.getDate() - 1);
        const eventEndYear = eventEndDay.getFullYear();
        const eventEndMonth = eventEndDay.getMonth();
        const eventEndDate = eventEndDay.getDate();
        eventEndDay = new Date(eventEndYear, eventEndMonth, eventEndDate, 23, 59, 59, 999);
        
        // Check if today is within the event range (active event)
        const isTodayInRange = todayStart >= eventStartDay && todayStart <= eventEndDay;
        
        // For past events, only show if they ended within the last hour
        // (not if they're active today - those always show)
        const eventEndedRecently = eventEndDay < todayStart && eventEndDay >= oneHourAgo;
        
        // Only show if it's active today OR ended within the last hour
        if (isTodayInRange || eventEndedRecently) {
          events.push(event);
        }
      } else {
        // Timed event: check if any part of the event is on today
        // Use local date components for comparison
        const eventStartYear = eventStart.getFullYear();
        const eventStartMonth = eventStart.getMonth();
        const eventStartDate = eventStart.getDate();
        const eventStartLocal = new Date(eventStartYear, eventStartMonth, eventStartDate, eventStart.getHours(), eventStart.getMinutes(), eventStart.getSeconds());
        
        const eventEndYear = eventEnd.getFullYear();
        const eventEndMonth = eventEnd.getMonth();
        const eventEndDate = eventEnd.getDate();
        const eventEndLocal = new Date(eventEndYear, eventEndMonth, eventEndDate, eventEnd.getHours(), eventEnd.getMinutes(), eventEnd.getSeconds());
        
        // Event overlaps with today if: eventStart <= todayEnd AND eventEnd >= todayStart
        if (eventStartLocal <= todayEnd && eventEndLocal >= todayStart) {
          events.push(event);
        }
      }
    }
    
    console.log('📅 Found', events.length, 'events for today');
    return events;
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

  dateKey(date) {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  }

  showLoading() {
    const body = this.element.querySelector(`#${this.id}-body`);
    if (body) {
      body.innerHTML = '<div class="todays-events-loading">Loading today\'s events...</div>';
    }
  }

  showError(message) {
    const body = this.element.querySelector(`#${this.id}-body`);
    if (body) {
      body.innerHTML = `<div class="todays-events-error">${message}</div>`;
    }
  }
}

// Register widget
if (typeof window !== 'undefined' && window.widgetRegistry) {
  window.widgetRegistry.register('todays-events', TodaysEventsWidget);
}

