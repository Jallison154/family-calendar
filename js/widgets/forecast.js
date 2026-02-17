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
    // Run first update soon; retry a few times so we catch HA when it connects
    this.update();
    setTimeout(() => this.update(), 2000);
    setTimeout(() => this.update(), 6000);
    this.startAutoUpdate(1800000); // 30 minutes
  }

  async update() {
    try {
      this.setStatus('updating');
      let forecast = [];
      
      const haClient = window.app?.haClient;
      
      // Method 1: Check entity state attributes (NWS and others use forecast, hourly_forecast, daily_forecast)
      if (haClient) {
        const state = haClient.getState(this.weatherEntity);
        const attrs = state?.attributes || {};
        let raw = attrs.forecast || attrs.hourly_forecast || attrs.daily_forecast;
        if (raw && !Array.isArray(raw)) {
          raw = raw.forecast || raw.daily || raw.hourly || [];
        }
        if (Array.isArray(raw) && raw.length > 0) {
          forecast = raw;
          // If hourly, take one per day for 5-day display
          if (attrs.hourly_forecast && raw.length > 24) {
            forecast = this.convertHourlyToDaily(raw);
          }
        }
      }
      
      // Method 2: Use WebSocket service call
      if (forecast.length === 0 && haClient?.isConnected) {
        for (const forecastType of ['twice_daily', 'daily', 'hourly']) {
          if (forecast.length > 0) break;
          try {
            const result = await haClient.getWeatherForecast(this.weatherEntity, forecastType);
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
            // try next type
          }
        }
      }
      
      // Method 3: Check weather widget's data (HA weather widget stores processed forecast with date, high, low, condition)
      if (forecast.length === 0 && window.widgetRegistry) {
        const weatherWidget = Array.from(window.widgetRegistry.widgets?.values() || [])
          .find(w => w.type === 'weather');
        
        if (weatherWidget?.currentData?.forecast?.length) {
          forecast = weatherWidget.currentData.forecast.map(f => ({
            datetime: f.date?.toISOString?.() || f.date,
            date: f.date,
            temperature: f.high,
            templow: f.low,
            condition: f.condition
          }));
        }
      }
      
      // Method 4: OpenWeatherMap fallback (when HA not configured or no forecast from HA)
      const owm = window.CONFIG?.weather?.openWeatherMap;
      if (forecast.length === 0 && owm?.apiKey && owm?.lat != null && owm?.lon != null &&
          owm.apiKey !== 'YOUR_OPENWEATHERMAP_API_KEY' && owm.apiKey !== '') {
        try {
          const units = owm.units || 'imperial';
          const res = await fetch(
            `https://api.openweathermap.org/data/2.5/forecast?lat=${owm.lat}&lon=${owm.lon}&units=${units}&appid=${encodeURIComponent(owm.apiKey)}`
          );
          if (res.ok) {
            const data = await res.json();
            if (data?.list?.length) {
              forecast = this.processOpenWeatherMapForecast(data.list);
            }
          }
        } catch (e) {
          console.warn('🌤️ OpenWeatherMap forecast failed:', e.message);
        }
      }
      
      this.forecast = (forecast || []).slice(0, 5);
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
      const raw = entry.datetime ?? entry.date ?? entry.timestamp;
      const date = !raw ? null : (typeof raw === 'string' ? new Date(raw) : (raw < 10000000000 ? new Date(raw * 1000) : new Date(raw)));
      if (!date || isNaN(date.getTime())) return;
      const dayKey = date.toDateString();
      if (!dailyMap.has(dayKey)) {
        dailyMap.set(dayKey, { ...entry, datetime: entry.datetime || (date?.toISOString?.() || date), date });
      }
    });
    return Array.from(dailyMap.values());
  }

  /** Convert OpenWeatherMap 5-day list (3-hour items) to daily forecast for widget */
  processOpenWeatherMapForecast(list) {
    const days = new Map();
    const owmToCondition = { Clear: 'clear', Clouds: 'cloudy', Rain: 'rainy', Drizzle: 'rainy', Thunderstorm: 'thunderstorm', Snow: 'snowy', Mist: 'fog', Smoke: 'fog', Haze: 'fog', Fog: 'fog' };
    list.forEach(item => {
      const date = new Date(item.dt * 1000);
      const dayKey = date.toDateString();
      const condition = (item.weather?.[0]?.main && owmToCondition[item.weather[0].main]) ? owmToCondition[item.weather[0].main] : 'clear';
      if (!days.has(dayKey)) {
        days.set(dayKey, { datetime: date.toISOString(), date, temps: [], lows: [], condition });
      }
      const d = days.get(dayKey);
      d.temps.push(item.main.temp);
      d.lows.push(item.main.temp);
      d.condition = condition;
    });
    return Array.from(days.values()).map(d => ({
      datetime: d.datetime,
      date: d.date,
      temperature: d.temps.length ? Math.max(...d.temps) : null,
      templow: d.lows.length ? Math.min(...d.lows) : null,
      condition: d.condition
    }));
  }

  render() {
    const body = this.element?.querySelector(`#${this.id}-body`);
    if (!body) return;

    if (this.forecast.length === 0) {
      body.innerHTML = `
        <div class="forecast-empty">
          <div>No forecast data</div>
          <div style="font-size: 0.65rem; margin-top: 0.3rem; opacity: 0.6;">
            Set weather entity in Control Panel, or add OpenWeatherMap (API key + lat/lon) for forecast.
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
      const high = day.temperature ?? day.temp ?? day.high ?? '--';
      const low = day.templow ?? day.temp_low ?? day.low ?? '';
      
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
