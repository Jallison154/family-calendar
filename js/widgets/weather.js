/**
 * Weather Widget (Home Assistant)
 */

class WeatherWidget extends BaseWidget {
  constructor(config = {}) {
    super(config);
    this.type = 'weather';
    // Get weatherEntity from global CONFIG, not widget config
    this.weatherEntity = window.CONFIG?.weather?.weatherEntity || 'weather.home';
    this.haClient = null;
    this.currentData = null;
    this.cacheKey = 'weatherWidgetCache';
    this.cacheExpiryKey = 'weatherWidgetCacheExpiry';
    this.cacheExpiryMs = 900000; // 15 minutes
  }

  getHTML() {
    return `
      <div class="widget-body" id="${this.id}-body">
        <div class="weather-loading">Loading weather...</div>
      </div>
    `;
  }

  loadCachedData() {
    try {
      const cached = localStorage.getItem(this.cacheKey);
      const expiry = localStorage.getItem(this.cacheExpiryKey);
      
      if (cached && expiry && Date.now() < parseInt(expiry, 10)) {
        const data = JSON.parse(cached);
        // Parse forecast date strings back to Date objects
        if (data.forecast) {
          data.forecast = data.forecast.map(f => ({
            ...f,
            date: new Date(f.date)
          }));
        }
        return data;
      }
    } catch (e) {
      console.warn('Failed to load cached weather data:', e);
    }
    return null;
  }

  saveCachedData(data) {
    try {
      // Convert Date objects to ISO strings for storage
      const dataToCache = {
        ...data,
        forecast: data.forecast ? data.forecast.map(f => ({
          ...f,
          date: f.date.toISOString()
        })) : []
      };
      
      localStorage.setItem(this.cacheKey, JSON.stringify(dataToCache));
      localStorage.setItem(this.cacheExpiryKey, (Date.now() + this.cacheExpiryMs).toString());
    } catch (e) {
      console.warn('Failed to cache weather data:', e);
    }
  }

  onInit() {
    // Get Home Assistant client from app
    if (window.app && window.app.haClient) {
      this.haClient = window.app.haClient;
      this.haClient.onStateChange((entityId, state) => {
        if (entityId === this.weatherEntity) {
          this.update();
        }
      });
    }
    
    // Load cached data immediately
    const cachedData = this.loadCachedData();
    if (cachedData) {
      this.currentData = cachedData;
      this.render(cachedData);
      this.setStatus('connected');
    }
    
    // Update in background
    this.update();
    // Update every 10 minutes
    this.startAutoUpdate(600000);
  }

  async update() {
    if (!this.haClient || !this.haClient.isConnected) {
      // Only show loading if we don't have cached data
      if (!this.currentData) {
        this.showLoading();
      }
      return;
    }

    const state = this.haClient.getState(this.weatherEntity);
    if (!state) {
      // Only show error if we don't have cached data
      if (!this.currentData) {
        this.showError('Weather entity not found');
      }
      return;
    }

    try {
      this.setStatus('updating');
      await this.updateFromHA(state);
      this.setStatus('connected');
    } catch (e) {
      console.error('Weather update error:', e);
      // If we have cached data, keep showing it
      if (!this.currentData) {
        this.showError('Failed to load weather');
      } else {
        this.setStatus('connected');
      }
    }
  }

  async updateFromHA(state) {
    const attrs = state.attributes;
    const condition = state.state;
    
    // Get forecast
    let forecast = attrs.forecast || attrs.hourly_forecast || attrs.daily_forecast || [];
    if (!Array.isArray(forecast)) {
      forecast = forecast.forecast || forecast.daily || forecast.hourly || [];
    }
    forecast = forecast.slice(0, 5);

    // Process forecast
    const processedForecast = forecast.map((f, index) => {
      let forecastDate;
      if (f.datetime) {
        forecastDate = typeof f.datetime === 'string' ? new Date(f.datetime) : 
                      (f.datetime < 10000000000 ? new Date(f.datetime * 1000) : new Date(f.datetime));
      } else if (f.date) {
        forecastDate = typeof f.date === 'string' ? new Date(f.date) : new Date(f.date);
      } else {
        forecastDate = new Date();
        forecastDate.setDate(forecastDate.getDate() + index);
        forecastDate.setHours(12, 0, 0, 0);
      }

      const forecastCondition = f.condition || f.condition_state || f.weather || condition;
      const high = f.temperature ?? f.temp ?? f.temp_max ?? f.high ?? null;
      const low = f.templow ?? f.temp_low ?? f.temp_min ?? f.low ?? null;

      return {
        date: forecastDate,
        high: high !== null ? Math.round(high) : null,
        low: low !== null ? Math.round(low) : null,
        condition: forecastCondition,
        icon: this.getIcon(forecastCondition),
        iconUrl: f.entity_picture || f.icon || f.condition_icon
      };
    }).filter(f => f.high !== null || f.low !== null);

    // Get current icon
    const haIconUrl = attrs.entity_picture;
    let currentIcon = this.getIcon(condition);
    let currentIconUrl = null;
    
    if (haIconUrl) {
      if (haIconUrl.startsWith('http')) {
        currentIconUrl = haIconUrl;
      } else if (this.haClient.config?.url) {
        const baseUrl = this.haClient.config.url.replace(/\/$/, '');
        currentIconUrl = baseUrl + haIconUrl;
      }
    }

    const feelsLike = attrs.apparent_temperature || attrs.feels_like || attrs.feelslike || attrs.temperature;
    const unit = attrs.temperature_unit || '°F';

    const data = {
      temp: Math.round(attrs.temperature || 0),
      icon: currentIcon,
      iconUrl: currentIconUrl,
      humidity: attrs.humidity || attrs.humidity_value || null,
      wind: Math.round(attrs.wind_speed || attrs.wind_speed_value || 0),
      feelsLike: Math.round(feelsLike || attrs.temperature || 0),
      unit,
      condition,
      forecast: processedForecast
    };
    
    this.saveCachedData(data);
    this.render(data);
  }

  render(data) {
    // If no data provided, show loading state
    if (!data) {
      this.showLoading();
      return;
    }
    
    this.currentData = data;
    const body = this.element.querySelector(`#${this.id}-body`);
    if (!body) return;

    // Ensure forecast is an array
    const forecast = data.forecast || [];
    const forecastHTML = forecast.map(f => {
      const dayName = f.date.toLocaleDateString('en-US', { weekday: 'short' });
      return `
        <div class="forecast-day">
          <div class="forecast-day-name">${dayName}</div>
          ${f.iconUrl ? `<img src="${f.iconUrl}" alt="${f.condition}" class="forecast-icon-img">` : `<div class="forecast-icon">${f.icon}</div>`}
          <div class="forecast-high">${f.high !== null ? f.high + data.unit : '--'}</div>
          <div class="forecast-low">${f.low !== null ? f.low + data.unit : '--'}</div>
        </div>
      `;
    }).join('');

    body.innerHTML = `
      <div class="weather-current">
        ${data.iconUrl ? `<img src="${data.iconUrl}" alt="${data.condition}" class="weather-icon-img" style="width: 2.5rem; height: 2.5rem;">` : `<span class="weather-icon">${data.icon}</span>`}
        <div>
          <div class="weather-temp">${data.temp}${data.unit}</div>
          <div style="font-size: 0.875rem; color: var(--color-text-secondary);">${data.condition}</div>
        </div>
      </div>
      <div class="weather-details">
        <div class="weather-detail">
          <div class="weather-detail-value">${data.feelsLike}${data.unit}</div>
          <div class="weather-detail-label">Feels</div>
        </div>
        ${data.humidity !== null ? `
        <div class="weather-detail">
          <div class="weather-detail-value">${data.humidity}%</div>
          <div class="weather-detail-label">Humidity</div>
        </div>
        ` : ''}
        ${data.wind > 0 ? `
        <div class="weather-detail">
          <div class="weather-detail-value">${data.wind}</div>
          <div class="weather-detail-label">Wind</div>
        </div>
        ` : ''}
      </div>
      ${forecast.length > 0 ? `
      <div class="weather-forecast">
        ${forecastHTML}
      </div>
      ` : ''}
    `;
  }

  getIcon(condition) {
    const icons = {
      'sunny': '☀️',
      'clear': '☀️',
      'clear-day': '☀️',
      'partlycloudy': '⛅',
      'partly-cloudy': '⛅',
      'cloudy': '☁️',
      'overcast': '☁️',
      'rainy': '🌧️',
      'rain': '🌧️',
      'snowy': '❄️',
      'snow': '❄️',
      'snowy-rainy': '🌨️',
      'hail': '🌨️',
      'fog': '🌫️',
      'foggy': '🌫️',
      'windy': '💨',
      'windy-variant': '💨',
      'lightning': '⛈️',
      'thunderstorm': '⛈️',
      'lightning-rainy': '⛈️'
    };
    return icons[condition?.toLowerCase()] || '🌤️';
  }

  showLoading() {
    const body = this.element.querySelector(`#${this.id}-body`);
    if (body) {
      body.innerHTML = '<div class="weather-loading">Loading weather...</div>';
    }
  }

  showError(message) {
    const body = this.element.querySelector(`#${this.id}-body`);
    if (body) {
      body.innerHTML = `<div class="weather-error">${message}</div>`;
    }
  }
}

// Register widget
if (typeof window !== 'undefined' && window.widgetRegistry) {
  window.widgetRegistry.register('weather', WeatherWidget);
}


