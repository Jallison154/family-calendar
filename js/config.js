/**
 * Dashboard Configuration
 * Edit via Control Panel (control.html) for live updates
 * Settings are loaded from the server (settings.json) - server is source of truth
 */

const CONFIG = {
  // Unsplash Backgrounds
  unsplash: {
    accessKey: '',
    searchQuery: 'nature landscape mountains',
    interval: 30000,
    transitionDuration: 2500
  },

  // Google Calendar
  googleCalendar: {
    icsFeeds: [
      // { name: 'Family Calendar', url: 'https://calendar.google.com/calendar/ical/...', color: '#3b82f6' }
    ],
    weeksAhead: 4,
    refreshInterval: 300000
  },

  // Home Assistant
  homeAssistant: {
    url: '',
    accessToken: '',
    entities: [],
    refreshInterval: 30000
  },

  // Weather (from Home Assistant)
  weather: {
    useHomeAssistant: true,
    weatherEntity: 'weather.home'
  },

  // Spotify (from Home Assistant)
  spotify: {
    mediaPlayerEntity: 'media_player.spotify'
  },

  // Display Settings
  display: {
    use24Hour: false,
    greetingName: 'Family',
    visitorMode: false
  },

  // Layout (widget positions and sizes)
  layout: {
    widgets: [
      {
        id: 'weather',
        type: 'weather',
        gridColumn: '1 / 4',
        gridRow: '1 / 2'
      },
      {
        id: 'clock',
        type: 'clock',
        gridColumn: '10 / 13',
        gridRow: '1 / 2'
      },
      {
        id: 'spotify',
        type: 'spotify',
        gridColumn: '4 / 10',
        gridRow: '1 / 3'
      },
      {
        id: 'todays-events',
        type: 'todays-events',
        gridColumn: '1 / 7',
        gridRow: '2 / 7'
      },
      {
        id: 'calendar',
        type: 'calendar',
        gridColumn: '7 / 13',
        gridRow: '2 / 9'
      },
      {
        id: 'homeassistant',
        type: 'homeassistant',
        gridColumn: '1 / 4',
        gridRow: '7 / 9'
      },
      {
        id: 'dadjoke',
        type: 'dadjoke',
        gridColumn: '4 / 7',
        gridRow: '7 / 9'
      }
    ]
  }
};

// Config loading state
let configLoaded = false;
let configLoadPromise = null;

/**
 * Load configuration from server (source of truth)
 * Falls back to localStorage only if server is completely unavailable
 */
async function loadConfigFromServer() {
  // If already loaded in this session, don't reload
  if (configLoaded) {
    return true;
  }
  
  // If already loading, wait for that promise
  if (configLoadPromise) {
    return await configLoadPromise;
  }
  
  // Start loading
  configLoadPromise = (async () => {
  // Try server first (server is source of truth)
  if (typeof window !== 'undefined' && window.settingsAPI) {
    try {
      const serverConfig = await window.settingsAPI.fetch();
      if (serverConfig && Object.keys(serverConfig).length > 0) {
        // Deep merge server config into CONFIG
        deepMerge(CONFIG, serverConfig);
        console.log('✓ Config loaded from server (source of truth)');
        // Clear localStorage after successful server load (server is source of truth)
        if (typeof Storage !== 'undefined') {
          localStorage.removeItem('familyDashboardSettings');
          localStorage.removeItem('familyDashboardConfig');
        }
        configLoaded = true;
        return true;
      } else {
        console.log('ℹ Server returned empty config, using defaults');
        // Clear localStorage even if server returns empty (server is source of truth)
        if (typeof Storage !== 'undefined') {
          localStorage.removeItem('familyDashboardSettings');
          localStorage.removeItem('familyDashboardConfig');
        }
        configLoaded = true;
        return true;
      }
    } catch (e) {
      console.warn('⚠ Failed to load config from server:', e);
      console.warn('⚠ Falling back to localStorage (if available)');
    }
  } else {
    console.warn('⚠ settingsAPI not available, trying localStorage fallback');
  }
  
  // Fallback to localStorage only if server completely failed/unavailable
  if (typeof Storage !== 'undefined') {
    const stored = localStorage.getItem('familyDashboardSettings') || localStorage.getItem('familyDashboardConfig');
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        deepMerge(CONFIG, parsed);
        console.log('⚠ Config loaded from localStorage (server unavailable - this is a fallback)');
        configLoaded = true;
        return false; // Indicates fallback was used
      } catch (e) {
        console.warn('Failed to parse stored config:', e);
      }
    }
  }
  
    console.log('ℹ Using default config (no server or localStorage available)');
    configLoaded = true;
    return false;
  })();
  
  return await configLoadPromise;
}

/**
 * Deep merge objects (helper function)
 */
function deepMerge(target, source) {
  for (const key in source) {
    if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])) {
      if (!target[key]) target[key] = {};
      deepMerge(target[key], source[key]);
    } else {
      target[key] = source[key];
    }
  }
  return target;
}

// Export
if (typeof window !== 'undefined') {
  window.CONFIG = CONFIG;
  window.loadConfigFromServer = loadConfigFromServer;
  
  // Start loading config immediately when script loads
  // This ensures server settings are loaded before app.js runs
  (async () => {
    await loadConfigFromServer();
  })();
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = CONFIG;
}
