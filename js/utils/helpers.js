/**
 * Utility Helper Functions
 */

const Helpers = {
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
   * Format date
   */
  formatDate(date, format = 'long') {
    const options = {
      long: { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' },
      short: { month: 'short', day: 'numeric' },
      month: { month: 'long', year: 'numeric' }
    };
    return date.toLocaleDateString('en-US', options[format] || options.long);
  },

  /**
   * Format time
   */
  formatTime(date, use24Hour = false) {
    if (use24Hour) {
      return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false });
    }
    return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
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


