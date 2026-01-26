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
    if (window.app && window.app.haClient) {
      this.haClient = window.app.haClient;
    }
    
    // Initial update with delay to let HA connect
    setTimeout(() => this.update(), 3000);
    this.startAutoUpdate(1800000);
  }

  async update() {
    console.log('🌤️ Forecast widget updating for:', this.weatherEntity);
    
    if (!this.haClient) {
      if (window.app && window.app.haClient) {
        this.haClient = window.app.haClient;
      }
    }
    
    if (!this.haClient || !this.haClient.isConnected) {
      console.log('🌤️ HA not connected, retrying in 5s...');
      setTimeout(() => this.update(), 5000);
      return;
    }

    try {
      this.setStatus('updating');
      let forecast = [];
      
      // Try different forecast types in order of preference
      const forecastTypes = ['twice_daily', 'daily', 'hourly'];
      
      for (const forecastType of forecastTypes) {
        if (forecast.length > 0) break;
        
        console.log('🌤️ Trying forecast type:', forecastType);
        try {
          const result = await this.haClient.getWeatherForecast(this.weatherEntity, forecastType);
          console.log('🌤️ Result for', forecastType, ':', result ? result.length : 'null');
          
          if (result && Array.isArray(result) && result.length > 0) {
            if (forecastType === 'hourly') {
              // Convert hourly to daily by taking one entry per day
              const dailyMap = new Map();
              result.forEach(entry => {
                const date = new Date(entry.datetime || entry.date);
                const dayKey = date.toDateString();
                if (!dailyMap.has(dayKey)) {
                  dailyMap.set(dayKey, entry);
                }
              });
              forecast = Array.from(dailyMap.values());
            } else if (forecastType === 'twice_daily') {
              // Twice daily has day/night entries - combine them
              const dailyMap = new Map();
              result.forEach(entry => {
                const date = new Date(entry.datetime || entry.date);
                const dayKey = date.toDateString();
                const existing = dailyMap.get(dayKey);
                
                if (!existing) {
                  dailyMap.set(dayKey, {
                    datetime: entry.datetime || entry.date,
                    condition: entry.condition,
                    temperature: entry.temperature,
                    templow: entry.templow || entry.temperature
                  });
                } else {
                  // Update with high/low from day and night
                  const isDay = entry.is_daytime !== false;
                  if (isDay) {
                    existing.temperature = entry.temperature;
                    existing.condition = entry.condition;
                  } else {
                    existing.templow = entry.temperature;
                  }
                }
              });
              forecast = Array.from(dailyMap.values());
            } else {
              forecast = result;
            }
            console.log('🌤️ Got forecast via', forecastType, ':', forecast.length, 'days');
          }
        } catch (e) {
          console.log('🌤️', forecastType, 'failed:', e.message);
        }
      }
      
      // Fallback to entity attributes
      if (forecast.length === 0) {
        console.log('🌤️ Trying entity attributes...');
        const state = this.haClient.getState(this.weatherEntity);
        if (state && state.attributes && state.attributes.forecast) {
          forecast = state.attributes.forecast;
          console.log('🌤️ Got forecast from attributes:', forecast.length);
        }
      }
      
      this.forecast = (forecast || []).slice(0, 5);
      console.log('🌤️ Final forecast:', this.forecast.length, 'days');
      this.render();
      this.setStatus('connected');
    } catch (e) {
      console.error('🌤️ Forecast error:', e);
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
      const condition = day.condition || 'unknown';
      const icon = this.getIcon(condition);
      const high = day.temperature ?? day.temp ?? day.temp_max ?? '--';
      const low = day.templow ?? day.temp_low ?? day.temp_min ?? '';
      
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

if (typeof window !== 'undefined' && window.widgetRegistry) {
  window.widgetRegistry.register('forecast', ForecastWidget);
}
