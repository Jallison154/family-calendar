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
   * Check if server is available
   */
  async checkHealth() {
    try {
      const response = await fetch('/api/health', {
        signal: AbortSignal.timeout(5000) // 5 second timeout
      });
      return response.ok;
    } catch (error) {
      return false;
    }
  }

  /**
   * Fetch settings from server
   */
  async fetch() {
    try {
      const response = await fetch(this.apiUrl, {
        signal: AbortSignal.timeout(10000) // 10 second timeout
      });
      if (!response.ok) {
        if (response.status === 504) {
          // Gateway timeout - server might be down or nginx timeout too short
          if (window.DEBUG_MODE === true) {
            console.error('504 Gateway Timeout: Server may be down or nginx timeout too short');
          }
        }
        throw new Error(`HTTP ${response.status}`);
      }
      const settings = await response.json();
      // Remove metadata fields
      delete settings._lastUpdated;
      return settings;
    } catch (error) {
      // Only log network errors in debug mode to reduce console noise
      // Network errors are expected when server is unavailable
      if (window.DEBUG_MODE === true) {
        if (error.name === 'TimeoutError' || error.message.includes('504')) {
          console.error('Server timeout (504): Python server may be down or nginx timeout too short. Check: sudo systemctl status family-calendar');
        } else {
          console.error('Failed to fetch settings from server:', error);
        }
      }
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
      // Only log network errors in debug mode to reduce console noise
      // Network errors are expected when server is unavailable
      if (window.DEBUG_MODE === true) {
        console.error('Failed to save settings to server:', error);
      }
      return false;
    }
  }
}

// Create global instance
if (typeof window !== 'undefined') {
  window.SettingsAPI = SettingsAPI;
  window.settingsAPI = new SettingsAPI();
}








