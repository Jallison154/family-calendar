/**
 * Dashboard Configuration
 * Edit via Control Panel (control.html) for live updates
 */

const CONFIG = {
  unsplash: {
    accessKey: 'YOUR_UNSPLASH_ACCESS_KEY',
    searchQuery: 'nature landscape snow mountains',
    interval: 30000,
    transitionDuration: 2500,
    preloadCount: 5
  },

  googleCalendar: {
    // Option 1: Google API (requires API key)
    accounts: [
      {
        name: 'Personal',
        apiKey: 'YOUR_GOOGLE_CALENDAR_API_KEY',
        calendars: [
          { id: 'primary', color: '#3b82f6', name: 'Personal' }
        ]
      }
    ],
    // Option 2: ICS Feeds (easier - no API key needed!)
    // Get your ICS URL from Google Calendar Settings > Integrate calendar > Secret address in iCal format
    icsFeeds: [
      // { name: 'My Calendar', url: 'https://calendar.google.com/calendar/ical/...', color: '#3b82f6' }
    ],
    weeksAhead: 4,
    refreshInterval: 300000
  },

  homeAssistant: {
    url: 'https://your-home-assistant.example.com',
    accessToken: 'YOUR_HOME_ASSISTANT_TOKEN',
    entities: [
      { entityId: 'sensor.temperature', name: 'Temperature', icon: 'thermometer' },
      { entityId: 'sensor.humidity', name: 'Humidity', icon: 'droplet' }
    ],
    refreshInterval: 30000
  },

  weather: {
    useHomeAssistant: true,  // Always use Home Assistant for weather
    weatherEntity: 'weather.home',  // Update this to your Home Assistant weather entity
    openWeatherMap: {
      // Not used when useHomeAssistant is true
      apiKey: '',
      lat: 0,
      lon: 0,
      units: 'imperial'
    }
  },

  dadJoke: {
    interval: 300000, // 5 minutes
    enabled: true
  },

  countdowns: [
    { name: '🎄 Christmas', date: '2025-12-25' },
    { name: '🎆 New Year', date: '2026-01-01' },
    { name: '🏖️ Beach Vacation', date: '2025-12-10' },
    { name: '🎂 Mom\'s Birthday', date: '2025-12-07' }
  ],

  display: {
    use24Hour: false,
    showSeconds: true,
    greetingName: '',
    hideCursorAfter: 5000
  }
};

if (typeof module !== 'undefined' && module.exports) {
  module.exports = CONFIG;
}
