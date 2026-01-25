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
    return \`
      <div class="widget-body" id="\${this.id}-body">
        <div class="forecast-loading">Loading forecast...</div>
      </div>
    \`;
  }

  onInit() {
    // Get Home Assistant client from app
    if (window.app && window.app.haClient) {
      this.haClient = window.app.haClient;
    }
    
    this.update();
    // Update every 30 minutes
    this.startAutoUpdate(1800000);
  }

  async update() {
    if (!this.haClient || !this.haClient.isConnected) {
      return;
    }

    try {
      this.setStatus('updating');
      
      // Try to get forecast via service call (HA 2024+)
      let forecast = [];
      if (this.haClient.getWeatherForecast) {
        try {
          forecast = await this.haClient.getWeatherForecast(this.weatherEntity, 'daily');
          if (forecast && forecast.length > 0) {
            console.log('📅 Forecast widget got', forecast.length, 'days via service');
          }
        } catch (e) {
          console.warn('Forecast service failed:', e);
        }
      }
      
      // Fallback to entity attributes
      if (!forecast || forecast.length === 0) {
        const state = this.haClient.getState(this.weatherEntity);
        if (state && state.attributes) {
          forecast = state.attributes.forecast || [];
        }
      }
      
      this.forecast = (forecast || []).slice(0, 5);
      this.render();
      this.setStatus('connected');
    } catch (e) {
      console.error('Forecast update error:', e);
      this.setStatus('error');
    }
  }

  render() {
    const body = this.element.querySelector(\`#\${this.id}-body\`);
    if (!body) return;

    if (this.forecast.length === 0) {
      body.innerHTML = '<div class="forecast-empty">No forecast available</div>';
      return;
    }

    const unit = window.CONFIG?.weather?.unit || '°F';
    
    const forecastHTML = this.forecast.map(day => {
      const date = new Date(day.datetime || day.date);
      const dayName = date.toLocaleDateString('en-US', { weekday: 'short' });
      const condition = day.condition || 'unknown';
      const icon = this.getIcon(condition);
      const high = day.temperature ?? day.temp ?? day.temp_max ?? '--';
      const low = day.templow ?? day.temp_low ?? day.temp_min ?? '--';
      
      return \`
        <div class="forecast-day-card">
          <div class="forecast-day-name">\${dayName}</div>
          <div class="forecast-day-icon">\${icon}</div>
          <div class="forecast-day-temps">
            <span class="forecast-high">\${Math.round(high)}°</span>
            <span class="forecast-low">\${Math.round(low)}°</span>
          </div>
        </div>
      \`;
    }).join('');

    body.innerHTML = \`
      <div class="forecast-title">5-Day Forecast</div>
      <div class="forecast-days">\${forecastHTML}</div>
    \`;
  }

  getIcon(condition) {
    const icons = {
      'sunny': '☀️', 'clear': '☀️', 'clear-night': '🌙',
      'partlycloudy': '⛅', 'partly-cloudy': '⛅',
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
