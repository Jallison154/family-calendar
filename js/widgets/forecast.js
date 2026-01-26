/**
 * 5-Day Weather Forecast Widget
 * Uses WebSocket connection only (REST blocked by CORS)
 */

class ForecastWidget extends BaseWidget {
  constructor(config = {}) {
    super(config);
    this.type = 'forecast';
    this.weatherEntity = window.CONFIG?.weather?.weatherEntity || 'weather.kbil';
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
    console.log('🌤️ Forecast widget init, entity:', this.weatherEntity);
    
    // Wait for HA connection, then try to get forecast
    setTimeout(() => this.update(), 3000);
    this.startAutoUpdate(1800000); // 30 minutes
  }

  async update() {
    console.log('🌤️ Forecast updating...');
    
    try {
      this.setStatus('updating');
      let forecast = [];
      
      const haClient = window.app?.haClient;
      
      // Method 1: Check entity state attributes (often has forecast)
      if (haClient) {
        const state = haClient.getState(this.weatherEntity);
        console.log('🌤️ Entity state:', state ? 'found' : 'not found');
        
        if (state?.attributes?.forecast) {
          forecast = state.attributes.forecast;
          console.log('🌤️ Got forecast from entity attributes:', forecast.length);
        }
      }
      
      // Method 2: Use WebSocket service call
      if (forecast.length === 0 && haClient?.isConnected) {
        console.log('🌤️ Trying WebSocket service call...');
        
        for (const forecastType of ['twice_daily', 'daily', 'hourly']) {
          if (forecast.length > 0) break;
          
          try {
            console.log('🌤️ Trying', forecastType, 'via WebSocket...');
            const result = await haClient.getWeatherForecast(this.weatherEntity, forecastType);
            console.log('🌤️ WebSocket result for', forecastType, ':', result);
            
            if (result && Array.isArray(result) && result.length > 0) {
              if (forecastType === 'twice_daily') {
                forecast = this.combineTwiceDaily(result);
              } else if (forecastType === 'hourly') {
                forecast = this.convertHourlyToDaily(result);
              } else {
                forecast = result;
              }
            }
          } catch (e) {
            console.log('🌤️ WebSocket error for', forecastType, ':', e.message);
          }
        }
      }
      
      // Method 3: Check weather widget's data
      if (forecast.length === 0 && window.widgetRegistry) {
        console.log('🌤️ Checking weather widget...');
        const weatherWidget = Array.from(window.widgetRegistry.widgets?.values() || [])
          .find(w => w.type === 'weather');
        
        if (weatherWidget?.currentData?.forecast) {
          forecast = weatherWidget.currentData.forecast;
          console.log('🌤️ Got from weather widget:', forecast.length);
        }
      }
      
      this.forecast = (forecast || []).slice(0, 5);
      console.log('🌤️ Final forecast count:', this.forecast.length);
      this.render();
      this.setStatus(this.forecast.length > 0 ? 'connected' : 'error');
    } catch (e) {
      console.error('🌤️ Update error:', e);
      this.render();
      this.setStatus('error');
    }
  }
  
  combineTwiceDaily(entries) {
    const dailyMap = new Map();
    entries.forEach(entry => {
      const date = new Date(entry.datetime);
      const dayKey = date.toDateString();
      const existing = dailyMap.get(dayKey);
      
      if (!existing) {
        dailyMap.set(dayKey, {
          datetime: entry.datetime,
          condition: entry.condition,
          temperature: entry.temperature,
          templow: entry.temperature
        });
      } else {
        if (entry.is_daytime !== false && entry.temperature > existing.temperature) {
          existing.temperature = entry.temperature;
          existing.condition = entry.condition;
        } else if (entry.is_daytime === false || entry.temperature < existing.templow) {
          existing.templow = entry.temperature;
        }
      }
    });
    return Array.from(dailyMap.values());
  }
  
  convertHourlyToDaily(entries) {
    const dailyMap = new Map();
    entries.forEach(entry => {
      const date = new Date(entry.datetime);
      const dayKey = date.toDateString();
      if (!dailyMap.has(dayKey)) {
        dailyMap.set(dayKey, entry);
      }
    });
    return Array.from(dailyMap.values());
  }

  render() {
    const body = this.element?.querySelector(`#${this.id}-body`);
    if (!body) return;

    if (this.forecast.length === 0) {
      body.innerHTML = `
        <div class="forecast-empty">
          <div>No forecast data</div>
          <div style="font-size: 0.65rem; margin-top: 0.3rem; opacity: 0.6;">
            Entity: ${this.weatherEntity}
          </div>
        </div>
      `;
      return;
    }

    const forecastHTML = this.forecast.map(day => {
      const date = new Date(day.datetime || day.date);
      const dayName = date.toLocaleDateString('en-US', { weekday: 'short' });
      const condition = day.condition || 'unknown';
      const icon = this.getIcon(condition);
      const high = day.temperature ?? day.temp ?? '--';
      const low = day.templow ?? day.temp_low ?? '';
      
      return `
        <div class="forecast-day-card">
          <div class="forecast-day-name">${dayName}</div>
          <div class="forecast-day-icon">${icon}</div>
          <div class="forecast-day-temps">
            <span class="forecast-high">${high !== '--' ? Math.round(high) + '°' : '--'}</span>
            ${low ? `<span class="forecast-low">${Math.round(low)}°</span>` : ''}
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
      'partlycloudy': '⛅', 'cloudy': '☁️', 'overcast': '☁️',
      'rainy': '🌧️', 'rain': '🌧️', 'pouring': '🌧️',
      'snowy': '❄️', 'snow': '❄️', 'snowy-rainy': '🌨️',
      'fog': '🌫️', 'windy': '💨',
      'lightning': '⛈️', 'thunderstorm': '⛈️'
    };
    return icons[condition?.toLowerCase()] || '🌤️';
  }
}

if (typeof window !== 'undefined' && window.widgetRegistry) {
  window.widgetRegistry.register('forecast', ForecastWidget);
}
