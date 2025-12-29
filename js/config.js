/**
 * Dashboard Configuration
 * Edit via Control Panel (control.html) for live updates
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
        id: 'clock',
        type: 'clock',
        gridColumn: '1 / 5',
        gridRow: '1 / 4'
      },
      {
        id: 'spotify',
        type: 'spotify',
        gridColumn: '5 / 9',
        gridRow: '1 / 4'
      },
      {
        id: 'weather',
        type: 'weather',
        gridColumn: '9 / 13',
        gridRow: '1 / 4'
      },
      {
        id: 'calendar',
        type: 'calendar',
        gridColumn: '1 / 13',
        gridRow: '4 / 11'
      },
      {
        id: 'homeassistant',
        type: 'homeassistant',
        gridColumn: '1 / 7',
        gridRow: '11 / 13'
      },
      {
        id: 'dadjoke',
        type: 'dadjoke',
        gridColumn: '7 / 13',
        gridRow: '11 / 13'
      }
    ]
  }
};

// Load from server (async, will be called on app init)
async function loadConfigFromServer() {
  if (typeof window !== 'undefined' && window.settingsAPI) {
    try {
      const serverConfig = await window.settingsAPI.fetch();
      if (serverConfig && Object.keys(serverConfig).length > 0) {
        Object.assign(CONFIG, serverConfig);
        console.log('✓ Config loaded from server');
      }
    } catch (e) {
      console.warn('Failed to load config from server:', e);
    }
  }
}

// Also try localStorage as fallback (for backward compatibility)
if (typeof Storage !== 'undefined') {
  const stored = localStorage.getItem('familyDashboardSettings') || localStorage.getItem('familyDashboardConfig');
  if (stored) {
    try {
      const parsed = JSON.parse(stored);
      Object.assign(CONFIG, parsed);
      console.log('✓ Config loaded from localStorage (fallback)');
    } catch (e) {
      console.warn('Failed to parse stored config:', e);
    }
  }
}

// Export
if (typeof window !== 'undefined') {
  window.CONFIG = CONFIG;
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = CONFIG;
}
