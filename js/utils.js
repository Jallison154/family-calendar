/**
 * Utility functions for performance and debugging
 */

// Debug mode - only log in development
window.DEBUG_MODE = window.DEBUG_MODE !== undefined 
  ? window.DEBUG_MODE 
  : (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1');

// Optimized logging
window.log = {
  debug: (...args) => {
    if (window.DEBUG_MODE) console.log(...args);
  },
  warn: (...args) => {
    if (window.DEBUG_MODE) console.warn(...args);
  },
  error: (...args) => {
    // Always log errors
    console.error(...args);
  },
  info: (...args) => {
    if (window.DEBUG_MODE) console.info(...args);
  }
};

// Debounce function for performance
window.debounce = (func, wait) => {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
};

// Throttle function for performance
window.throttle = (func, limit) => {
  let inThrottle;
  return function(...args) {
    if (!inThrottle) {
      func.apply(this, args);
      inThrottle = true;
      setTimeout(() => inThrottle = false, limit);
    }
  };
};

// Request animation frame batch updates
window.batchDOMUpdates = (updates) => {
  requestAnimationFrame(() => {
    updates.forEach(update => update());
  });
};

// Lazy load images
window.lazyLoadImage = (img, src) => {
  if ('loading' in HTMLImageElement.prototype) {
    img.loading = 'lazy';
    img.src = src;
  } else {
    // Fallback for older browsers
    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.src = src;
          observer.unobserve(entry.target);
        }
      });
    });
    observer.observe(img);
  }
};

