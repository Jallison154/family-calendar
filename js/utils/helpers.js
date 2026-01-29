/**
 * Utility Helper Functions
 * All date/time logic uses the browser's local timezone.
 */

const Helpers = {
  /**
   * Get the browser's timezone (e.g. "America/Denver")
   */
  getBrowserTimeZone() {
    try {
      return Intl.DateTimeFormat().resolvedOptions().timeZone || undefined;
    } catch (e) {
      return undefined;
    }
  },

  /**
   * Start of today (midnight) in the browser's local timezone
   */
  startOfTodayLocal() {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0, 0);
  },

  /**
   * End of today (23:59:59.999) in the browser's local timezone
   */
  endOfTodayLocal() {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999);
  },

  /**
   * Build a Date from local date components (uses browser timezone)
   */
  dateFromLocalParts(year, month, date, hour = 0, minute = 0, second = 0) {
    return new Date(year, month, date, hour, minute, second);
  },

  /**
   * Debounce function calls
   */
  debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
      const later = () => {
        clearTimeout(timeout);
        func(...args);
      };
      clearTimeout(timeout);
      timeout = setTimeout(later, wait);
    };
  },

  /**
   * Throttle function calls
   */
  throttle(func, limit) {
    let inThrottle;
    return function(...args) {
      if (!inThrottle) {
        func.apply(this, args);
        inThrottle = true;
        setTimeout(() => inThrottle = false, limit);
      }
    };
  },

  /**
   * Format date (always in browser timezone)
   */
  formatDate(date, format = 'long') {
    const tz = this.getBrowserTimeZone();
    const options = {
      long: { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', timeZone: tz },
      short: { month: 'short', day: 'numeric', timeZone: tz },
      month: { month: 'long', year: 'numeric', timeZone: tz }
    };
    return date.toLocaleDateString('en-US', options[format] || options.long);
  },

  /**
   * Format time (always in browser timezone)
   */
  formatTime(date, use24Hour = false) {
    const tz = this.getBrowserTimeZone();
    const options = {
      hour: '2-digit',
      minute: '2-digit',
      hour12: !use24Hour,
      timeZone: tz
    };
    if (use24Hour) options.hour12 = false;
    return date.toLocaleTimeString('en-US', options);
  },

  /**
   * Escape HTML
   */
  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  },

  /**
   * Get greeting based on time
   */
  getGreeting(name = '') {
    const hour = new Date().getHours();
    let greeting = 'Good evening';
    if (hour >= 5 && hour < 12) greeting = 'Good morning';
    else if (hour >= 12 && hour < 17) greeting = 'Good afternoon';
    else if (hour >= 21 || hour < 5) greeting = 'Good night';
    
    return name ? `${greeting}, ${name}` : greeting;
  }
};

// Export
if (typeof window !== 'undefined') {
  window.Helpers = Helpers;
}


