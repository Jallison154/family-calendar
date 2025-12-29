/**
 * API Client for Server-Side Settings
 * Handles fetching and saving settings to the server
 */

class SettingsAPI {
  constructor() {
    this.baseUrl = '';
    this.apiUrl = '/api/settings';
  }

  /**
   * Fetch settings from server
   */
  async fetch() {
    try {
      const response = await fetch(this.apiUrl);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      const settings = await response.json();
      // Remove metadata fields
      delete settings._lastUpdated;
      return settings;
    } catch (error) {
      console.error('Failed to fetch settings from server:', error);
      // Return empty object if server is unavailable
      return {};
    }
  }

  /**
   * Save settings to server
   */
  async save(settings) {
    try {
      const response = await fetch(this.apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(settings)
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const result = await response.json();
      return result.success === true;
    } catch (error) {
      console.error('Failed to save settings to server:', error);
      return false;
    }
  }
}

// Create global instance
if (typeof window !== 'undefined') {
  window.SettingsAPI = SettingsAPI;
  window.settingsAPI = new SettingsAPI();
}


