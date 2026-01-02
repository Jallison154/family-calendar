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

    // Get events from calendar client (it should already have them loaded)
    this.events = this.calendarClient.events || [];
    this.render();
  }

  render() {
    const body = this.element.querySelector(`#${this.id}-body`);
    if (!body) return;

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
      const description = event.description ? Helpers.escapeHtml(event.description) : null;

      html += `
        <div class="todays-event-item ${isNow ? 'is-now' : ''} ${isPast ? 'is-past' : ''}" style="--event-color: ${color}">
          <div class="todays-event-time">
            <div class="todays-event-time-main">${timeStr}</div>
            ${durationStr ? `<div class="todays-event-time-duration">${durationStr}</div>` : ''}
          </div>
          <div class="todays-event-content">
            <div class="todays-event-title">${title}</div>
            ${location ? `<div class="todays-event-location">📍 ${location}</div>` : ''}
            ${description ? `<div class="todays-event-description">${description}</div>` : ''}
          </div>
          ${isNow ? '<div class="todays-event-now-badge">NOW</div>' : ''}
        </div>
      `;
    });

    html += '</div>';
    body.innerHTML = html;
  }

  getTodaysEvents() {
    const todayKey = this.dateKey(this.today);
    const events = [];
    
    for (const event of this.events) {
      let startDay = new Date(event.start);
      startDay.setHours(0, 0, 0, 0);
      
      let endDay = new Date(event.end);
      if (event.isAllDay) {
        endDay.setDate(endDay.getDate() - 1);
      }
      endDay.setHours(0, 0, 0, 0);
      
      // Check if event overlaps with today
      if (startDay <= this.today && endDay >= this.today) {
        events.push(event);
      }
    }
    
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

