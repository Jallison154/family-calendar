/**
 * Clock Widget
 */

class ClockWidget extends BaseWidget {
  constructor(config = {}) {
    super(config);
    this.type = 'clock';
    this.use24Hour = config.use24Hour || false;
    this.lastMinute = -1;
  }

  getHTML() {
    return `
      <div class="widget-header">
        <span class="widget-icon">🕐</span>
        <span class="widget-title">Time</span>
      </div>
      <div class="widget-body">
        <div class="clock-display" id="${this.id}-time">12:00</div>
        <div class="clock-date" id="${this.id}-date">Loading...</div>
      </div>
    `;
  }

  onInit() {
    this.update();
    // Update every second
    this.startAutoUpdate(1000);
  }

  update() {
    const now = new Date();
    const currentMinute = now.getMinutes();
    
    // Update time
    const timeEl = this.element.querySelector(`#${this.id}-time`);
    if (timeEl) {
      const timeStr = Helpers.formatTime(now, this.use24Hour);
      
      // Only fade on minute change (not every second)
      if (currentMinute !== this.lastMinute) {
        timeEl.style.opacity = '0.7';
        setTimeout(() => {
          timeEl.textContent = timeStr;
          timeEl.style.opacity = '1';
        }, 150);
        this.lastMinute = currentMinute;
      } else {
        timeEl.textContent = timeStr;
      }
    }
    
    // Update date
    const dateEl = this.element.querySelector(`#${this.id}-date`);
    if (dateEl) {
      const dateStr = Helpers.formatDate(now, 'long');
      if (dateEl.textContent !== dateStr) {
        dateEl.style.opacity = '0';
        setTimeout(() => {
          dateEl.textContent = dateStr;
          dateEl.style.opacity = '1';
        }, 300);
      }
    }
  }
}

// Register widget
if (typeof window !== 'undefined' && window.widgetRegistry) {
  window.widgetRegistry.register('clock', ClockWidget);
}


