/**
 * 5-Day Weather Forecast Widget
 * Displays forecast from Home Assistant weather entity
 */

class ForecastWidget extends BaseWidget {
  constructor(config = {}) {
    super(config);
    this.type = 'forecast';
    this.weatherEntity = window.CONFIG?.weather?.weatherEntity || 'weather.home';
    this.haClient = null;
    this.forecast = [];
  }

  getHTML() {
    return `
      <div class="widget-body" id="${this.id}-body">
        <div class="forecast-loading">Loading forecast...</div>
      </div>
    `;
  }

  onInit() {
    // Get Home Assistant client from app
    if (window.app && window.app.haClient) {
      this.haClient = window.app.haClient;
    }
    
    // Initial update with delay to let HA connect
    setTimeout(() => this.update(), 3000);
    
    // Update every 30 minutes
    this.startAutoUpdate(1800000);
  }

  async update() {
    console.log('🌤️ Forecast widget updating...');
    
    if (!this.haClient) {
      console.log('🌤️ No HA client available');
      if (window.app && window.app.haClient) {
        this.haClient = window.app.haClient;
      }
    }
    
    if (!this.haClient || !this.haClient.isConnected) {
      console.log('🌤️ HA client not connected, will retry...');
      setTimeout(() => this.update(), 5000);
      return;
    }

    try {
      this.setStatus('updating');
      let forecast = [];
      
      // Method 1: Try to get forecast via service call (HA 2024+)
      console.log('🌤️ Trying forecast service for:', this.weatherEntity);
      if (this.haClient.getWeatherForecast) {
        try {
          const serviceForecast = await this.haClient.getWeatherForecast(this.weatherEntity, 'daily');
          console.log('🌤️ Service response:', serviceForecast);
          if (serviceForecast && Array.isArray(serviceForecast) && serviceForecast.length > 0) {
            forecast = serviceForecast;
            console.log('🌤️ Got forecast via service:', forecast.length, 'days');
          }
        } catch (e) {
          console.warn('🌤️ Forecast service failed:', e);
        }
      }
      
      // Method 2: Fallback to entity attributes
      if (!forecast || forecast.length === 0) {
        console.log('🌤️ Trying entity attributes fallback...');
        const state = this.haClient.getState(this.weatherEntity);
        console.log('🌤️ Entity state:', state);
        if (state && state.attributes) {
          // Try different attribute names
          forecast = state.attributes.forecast || 
                     state.attributes.daily_forecast ||
                     state.attributes.hourly_forecast || 
                     [];
          console.log('🌤️ Got forecast from attributes:', forecast.length, 'entries');
        }
      }
      
      // Method 3: Try hourly forecast if daily not available
      if ((!forecast || forecast.length === 0) && this.haClient.getWeatherForecast) {
        console.log('🌤️ Trying hourly forecast...');
        try {
          const hourlyForecast = await this.haClient.getWeatherForecast(this.weatherEntity, 'hourly');
          if (hourlyForecast && Array.isArray(hourlyForecast) && hourlyForecast.length > 0) {
            // Group by day and take first entry per day
            const dailyMap = new Map();
            hourlyForecast.forEach(entry => {
              const date = new Date(entry.datetime || entry.date);
              const dayKey = date.toDateString();
              if (!dailyMap.has(dayKey)) {
                dailyMap.set(dayKey, entry);
              }
            });
            forecast = Array.from(dailyMap.values()).slice(0, 5);
            console.log('🌤️ Converted hourly to daily:', forecast.length, 'days');
          }
        } catch (e) {
          console.warn('🌤️ Hourly forecast also failed:', e);
        }
      }
      
      this.forecast = (forecast || []).slice(0, 5);
      console.log('🌤️ Final forecast count:', this.forecast.length);
      this.render();
      this.setStatus('connected');
    } catch (e) {
      console.error('🌤️ Forecast update error:', e);
      this.setStatus('error');
    }
  }

  render() {
    const body = this.element.querySelector(`#${this.id}-body`);
    if (!body) return;

    if (this.forecast.length === 0) {
      body.innerHTML = `
        <div class="forecast-empty">
          <div>No forecast available</div>
          <div style="font-size: 0.7rem; margin-top: 0.5rem; opacity: 0.7;">Entity: ${this.weatherEntity}</div>
        </div>
      `;
      return;
    }

    const forecastHTML = this.forecast.map(day => {
      const date = new Date(day.datetime || day.date);
      const dayName = date.toLocaleDateString('en-US', { weekday: 'short' });
      const condition = day.condition || day.state || 'unknown';
      const icon = this.getIcon(condition);
      const high = day.temperature ?? day.temp ?? day.temp_max ?? day.native_temperature ?? '--';
      const low = day.templow ?? day.temp_low ?? day.temp_min ?? day.native_templow ?? '';
      
      return `
        <div class="forecast-day-card">
          <div class="forecast-day-name">${dayName}</div>
          <div class="forecast-day-icon">${icon}</div>
          <div class="forecast-day-temps">
            <span class="forecast-high">${high !== '--' ? Math.round(high) + '°' : '--'}</span>
            ${low !== '' ? `<span class="forecast-low">${Math.round(low)}°</span>` : ''}
          </div>
        </div>
      `;
    }).join('');

    body.innerHTML = `
      <div class="forecast-title">5-Day Forecast</div>
      <div class="forecast-days">${forecastHTML}</div>
    `;
  }

  getIcon(condition) {
    const icons = {
      'sunny': '☀️', 'clear': '☀️', 'clear-night': '🌙',
      'partlycloudy': '⛅', 'partly-cloudy': '⛅', 'partly_cloudy': '⛅',
      'cloudy': '☁️', 'overcast': '☁️',
      'rainy': '🌧️', 'rain': '🌧️', 'pouring': '🌧️',
      'snowy': '❄️', 'snow': '❄️',
      'snowy-rainy': '🌨️', 'hail': '🌨️',
      'fog': '🌫️', 'foggy': '🌫️',
      'windy': '💨', 'windy-variant': '💨',
      'lightning': '⛈️', 'thunderstorm': '⛈️', 'lightning-rainy': '⛈️'
    };
    return icons[condition?.toLowerCase()] || '🌤️';
  }
}

// Register widget
if (typeof window !== 'undefined' && window.widgetRegistry) {
  window.widgetRegistry.register('forecast', ForecastWidget);
}
