/**
 * Dashboard Configuration - EXAMPLE
 * 
 * Copy this file to config.js and fill in your API keys.
 * Or use the Control Panel (control.html) to configure everything.
 * 
 * IMPORTANT: Never commit config.js with real API keys to git!
 */

const CONFIG = {
  unsplash: {
    // Get your key at: https://unsplash.com/developers
    accessKey: 'YOUR_UNSPLASH_ACCESS_KEY',
    searchQuery: 'nature landscape',
    interval: 30000,           // Change background every 30 seconds
    transitionDuration: 2500,
    preloadCount: 5
  },

  googleCalendar: {
    // Get your key at: https://console.cloud.google.com
    // Enable "Google Calendar API" and create an API key
    accounts: [
      {
        name: 'Family',
        apiKey: 'YOUR_GOOGLE_CALENDAR_API_KEY',
        calendars: [
          { id: 'your-calendar-id@group.calendar.google.com', color: '#3b82f6', name: 'Family' },
          { id: 'another-calendar-id@gmail.com', color: '#10b981', name: 'Work' }
        ]
      }
    ],
    weeksAhead: 4,
    refreshInterval: 300000    // Refresh every 5 minutes
  },

  homeAssistant: {
    // Your Home Assistant URL and long-lived access token
    url: 'http://homeassistant.local:8123',
    accessToken: 'YOUR_HOME_ASSISTANT_LONG_LIVED_TOKEN',
    entities: [
      { entityId: 'sensor.living_room_temperature', name: 'Living Room', icon: 'thermometer' },
      { entityId: 'sensor.outside_temperature', name: 'Outside', icon: 'thermometer' },
      { entityId: 'light.living_room', name: 'Lights', icon: 'lightbulb' }
    ],
    refreshInterval: 30000
  },

  weather: {
    // Use Home Assistant weather entity OR OpenWeatherMap
    useHomeAssistant: false,
    weatherEntity: 'weather.home',
    openWeatherMap: {
      // Get your key at: https://openweathermap.org/api
      apiKey: 'YOUR_OPENWEATHERMAP_API_KEY',
      lat: 40.7128,            // Your latitude
      lon: -74.0060,           // Your longitude
      units: 'imperial'        // 'imperial' for °F, 'metric' for °C
    }
  },

  dadJoke: {
    interval: 300000,          // New joke every 5 minutes
    enabled: true
  },

  countdowns: [
    // Auto-detects holidays and birthdays from calendar
    // Add custom countdowns here:
    // { name: '🏖️ Vacation', date: '2025-07-01' }
  ],

  display: {
    use24Hour: false,
    showSeconds: false,
    greetingName: '',          // Optional: 'John' for "Good Morning, John"
    hideCursorAfter: 5000      // Hide cursor after 5 seconds (0 to disable)
  }
};

if (typeof module !== 'undefined' && module.exports) {
  module.exports = CONFIG;
}



