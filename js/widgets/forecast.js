/**
 * 5-Day Weather Forecast Widget
 * Gets forecast from the weather widget's cached data or HA directly
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
    
    // Try to get forecast after a delay
    setTimeout(() => this.update(), 2000);
    this.startAutoUpdate(1800000); // 30 minutes
  }

  async update() {
    console.log('🌤️ Forecast updating...');
    
    try {
      this.setStatus('updating');
      let forecast = [];
      
      // Method 1: Check if weather widget has forecast data cached
      const weatherWidgets = document.querySelectorAll('.widget-weather');
      for (const w of weatherWidgets) {
        const widgetId = w.id;
        if (window.widgetRegistry && window.widgetRegistry.widgets) {
          const weatherWidget = Array.from(window.widgetRegistry.widgets.values())
            .find(widget => widget.type === 'weather');
          if (weatherWidget && weatherWidget.currentData && weatherWidget.currentData.forecast) {
            forecast = weatherWidget.currentData.forecast;
            console.log('🌤️ Got forecast from weather widget:', forecast.length);
            break;
          }
        }
      }
      
      // Method 2: Try REST API directly
      if (forecast.length === 0 && window.CONFIG?.homeAssistant?.url) {
        console.log('🌤️ Trying REST API directly...');
        const haUrl = window.CONFIG.homeAssistant.url.replace(/\/$/, '');
        const haToken = window.CONFIG.homeAssistant.accessToken;
        
        // Try twice_daily first (what weather.kbil uses)
        for (const forecastType of ['twice_daily', 'daily', 'hourly']) {
          if (forecast.length > 0) break;
          
          try {
            console.log('🌤️ Trying', forecastType, 'via REST...');
            const response = await fetch(haUrl + '/api/services/weather/get_forecasts', {
              method: 'POST',
              headers: {
                'Authorization': 'Bearer ' + haToken,
                'Content-Type': 'application/json'
              },
              body: JSON.stringify({
                entity_id: this.weatherEntity,
                type: forecastType
              })
            });
            
            if (response.ok) {
              const data = await response.json();
              console.log('🌤️ REST response for', forecastType, ':', Object.keys(data));
              
              if (data && data[this.weatherEntity] && data[this.weatherEntity].forecast) {
                const rawForecast = data[this.weatherEntity].forecast;
                console.log('🌤️ Raw forecast entries:', rawForecast.length);
                
                if (forecastType === 'twice_daily') {
                  // Combine day/night into single days
                  forecast = this.combineTwiceDaily(rawForecast);
                } else if (forecastType === 'hourly') {
                  forecast = this.convertHourlyToDaily(rawForecast);
                } else {
                  forecast = rawForecast;
                }
              }
            } else {
              console.log('🌤️ REST failed for', forecastType, ':', response.status);
            }
          } catch (e) {
            console.log('🌤️ REST error for', forecastType, ':', e.message);
          }
        }
      }
      
      // Method 3: Try HA client
      if (forecast.length === 0 && window.app?.haClient?.isConnected) {
        console.log('🌤️ Trying HA client...');
        const state = window.app.haClient.getState(this.weatherEntity);
        if (state && state.attributes && state.attributes.forecast) {
          forecast = state.attributes.forecast;
          console.log('🌤️ Got from entity attributes:', forecast.length);
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
        // Daytime entry typically has higher temp
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
    const body = this.element.querySelector(`#${this.id}-body`);
    if (!body) return;

    if (this.forecast.length === 0) {
      body.innerHTML = `
        <div class="forecast-empty">
          <div>No forecast data</div>
          <div style="font-size: 0.65rem; margin-top: 0.3rem; opacity: 0.6;">
            Check console for 🌤️ logs
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
