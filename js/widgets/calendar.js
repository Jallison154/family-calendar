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
  }

  getHTML() {
    return `
      <div class="widget-header">
        <span class="widget-icon">📅</span>
        <span class="widget-title">Calendar</span>
      </div>
      <div class="widget-body" id="${this.id}-body">
        <div class="calendar-loading">Loading calendar...</div>
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

    try {
      await this.calendarClient.fetchEvents();
      this.events = this.calendarClient.events || [];
      this.render();
    } catch (e) {
      console.error('Calendar update error:', e);
      this.showError('Failed to load calendar');
    }
  }

  render() {
    const body = this.element.querySelector(`#${this.id}-body`);
    if (!body) return;

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
    
    for (const event of this.events) {
      let startDay = new Date(event.start);
      startDay.setHours(0, 0, 0, 0);
      
      let endDay = new Date(event.end);
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
    }
    
    return grouped;
  }

  dateKey(date) {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  }

  renderDayEvents(events) {
    if (events.length === 0) return '';
    
    // Limit to 3 visible events, show "X more" if needed
    const visible = events.slice(0, 3);
    const more = events.length - 3;
    
    return visible.map(event => {
      const color = event.color || '#3b82f6';
      const title = Helpers.escapeHtml(event.title);
      const time = event.isAllDay ? '' : Helpers.formatTime(new Date(event.start), false);
      return `
        <div class="calendar-event" style="--event-color: ${color}">
          ${time ? `<span style="font-size: 0.75rem; opacity: 0.8;">${time}</span> ` : ''}
          <span>${title}</span>
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


