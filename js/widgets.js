/**
 * Dashboard Widgets
 * Premium design for large displays
 */

// ============================================
// CLOCK WIDGET
// ============================================

class ClockWidget {
  constructor(config = {}) {
    this.config = {
      use24Hour: config.use24Hour || false,
      showSeconds: config.showSeconds || false
    };
    this.lastMinute = -1;
    this.lastDate = '';
    this.intervalId = null;
  }

  init() {
    this.update();
    // Use requestAnimationFrame for smoother updates when showing seconds
    if (this.config.showSeconds) {
      this.intervalId = setInterval(() => this.update(), 1000);
    } else {
      // Only update every minute if not showing seconds
      this.intervalId = setInterval(() => this.update(), 1000);
    }
  }

  destroy() {
    if (this.intervalId) clearInterval(this.intervalId);
  }

  update() {
    const now = new Date();
    const currentMinute = now.getMinutes();
    
    // Time
    const timeEl = document.querySelector('.time-display');
    if (timeEl) {
      let hours = now.getHours();
      let ampm = '';
      
      if (!this.config.use24Hour) {
        ampm = hours >= 12 ? '<span class="time-ampm">PM</span>' : '<span class="time-ampm">AM</span>';
        hours = hours % 12 || 12;
      }
      
      const mins = now.getMinutes().toString().padStart(2, '0');
      const secs = this.config.showSeconds 
        ? `<span class="time-seconds">:${now.getSeconds().toString().padStart(2, '0')}</span>` 
        : '';
      
      const newTime = `${hours}:${mins}${secs}${ampm}`;
      
      // Fade on minute change (not every second)
      if (currentMinute !== this.lastMinute && !this.config.showSeconds) {
        timeEl.style.opacity = '0.7';
        setTimeout(() => {
          timeEl.innerHTML = newTime;
          timeEl.style.opacity = '1';
        }, 150);
        this.lastMinute = currentMinute;
      } else {
        timeEl.innerHTML = newTime;
      }
    }
    
    // Date - fade on change (new format: "04 March")
    const dateEl = document.querySelector('.date-display');
    if (dateEl) {
      const day = now.getDate().toString().padStart(2, '0');
      const month = now.toLocaleDateString('en-US', { month: 'long' });
      const newDate = `${day} ${month}`;
      
      if (newDate !== this.lastDate) {
        dateEl.style.opacity = '0';
        setTimeout(() => {
          dateEl.textContent = newDate;
          dateEl.style.opacity = '1';
        }, 300);
        this.lastDate = newDate;
      }
    }
  }
}

// ============================================
// GREETING WIDGET
// ============================================

class GreetingWidget {
  constructor(config = {}) {
    this.config = { name: config.name || '' };
    this.lastGreeting = '';
  }

  init() {
    this.update();
    setInterval(() => this.update(), 60000);
  }

  update() {
    const hour = new Date().getHours();
    let greeting = 'Good evening';
    if (hour >= 5 && hour < 12) greeting = 'Good morning';
    else if (hour >= 12 && hour < 17) greeting = 'Good afternoon';
    else if (hour >= 21 || hour < 5) greeting = 'Good night';

    const name = this.config.name || 'York';
    const emoji = hour >= 5 && hour < 12 ? '😊' : hour >= 12 && hour < 17 ? '☀️' : hour >= 17 && hour < 21 ? '🌆' : '🌙';
    const fullGreeting = `${greeting} ${name}! ${emoji}`;

    const textEl = document.querySelector('.greeting-text');
    if (textEl && fullGreeting !== this.lastGreeting) {
      textEl.style.opacity = '0';
      setTimeout(() => {
        textEl.textContent = fullGreeting;
        textEl.style.opacity = '1';
      }, 300);
      this.lastGreeting = fullGreeting;
    }
  }
}

// ============================================
// WEATHER WIDGET
// ============================================

class WeatherWidget {
  constructor(config = {}) {
    this.config = {
      useHomeAssistant: config.useHomeAssistant || false,
      weatherEntity: config.weatherEntity || 'weather.home',
      openWeatherMap: config.openWeatherMap || {}
    };
    this.haClient = null;
    this.weatherEffects = null;
    this.lastRender = '';
    this.currentCondition = '';
    this.sunData = null;
  }

  init(haClient = null, weatherEffects = null) {
    this.haClient = haClient;
    this.weatherEffects = weatherEffects;
    this.widgetEl = document.getElementById('weather-widget');
    if (!this.widgetEl) return;
    
    this.update();
    // Throttle weather updates to every 10 minutes (600000ms)
    if (window.throttle) {
      this.updateInterval = setInterval(() => window.throttle(() => this.update(), 1000), 600000);
    } else {
      this.updateInterval = setInterval(() => this.update(), 600000);
    }
  }
  
  destroy() {
    if (this.updateInterval) {
      clearInterval(this.updateInterval);
    }
  }
  
  getSunData() {
    return this.sunData;
  }

  async update() {
    try {
      if (this.config.useHomeAssistant && this.haClient?.isConnected) {
        await this.updateFromHA();
      } else if (this.config.openWeatherMap?.apiKey && 
                 this.config.openWeatherMap.apiKey !== 'YOUR_OPENWEATHERMAP_API_KEY') {
        await this.updateFromOWM();
      } else {
        this.showDemo();
      }
    } catch (e) {
      console.error('Weather error:', e);
      this.showDemo();
    }
  }

  async updateFromOWM() {
    const { apiKey, lat, lon, units } = this.config.openWeatherMap;
    
    const current = await fetch(
      `https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lon}&units=${units}&appid=${apiKey}`
    ).then(r => r.json());
    
    const forecast = await fetch(
      `https://api.openweathermap.org/data/2.5/forecast?lat=${lat}&lon=${lon}&units=${units}&appid=${apiKey}`
    ).then(r => r.json());
    
    // Extract sunrise/sunset for TimeTheme
    if (current.sys?.sunrise && current.sys?.sunset) {
      this.sunData = {
        sunrise: new Date(current.sys.sunrise * 1000),
        sunset: new Date(current.sys.sunset * 1000)
      };
      // Update TimeTheme if available
      if (window.TimeTheme) {
        window.TimeTheme.setSunData(this.sunData.sunrise, this.sunData.sunset);
      }
    }
    
    const unit = units === 'metric' ? '°C' : '°F';
    const daily = this.processForecast(forecast.list);
    const condition = current.weather[0].main;
    
    this.render({
      temp: Math.round(current.main.temp),
      icon: this.getIcon(condition),
      humidity: current.main.humidity,
      wind: Math.round(current.wind.speed),
      feelsLike: Math.round(current.main.feels_like),
      unit,
      condition,
      forecast: daily.slice(0, 5)
    });
  }

  async updateFromHA() {
    const state = this.haClient?.entityStates?.get(this.config.weatherEntity);
    if (!state) { 
      console.warn('🌤️ Weather entity not found:', this.config.weatherEntity);
      this.showDemo(); 
      return; 
    }
    
    const attrs = state.attributes;
    
    // Log raw forecast data to help debug
    console.log('🌤️ Raw forecast data:', {
      hasForecast: !!attrs.forecast,
      forecastType: Array.isArray(attrs.forecast) ? 'array' : typeof attrs.forecast,
      forecastLength: Array.isArray(attrs.forecast) ? attrs.forecast.length : 'N/A',
      firstForecastItem: attrs.forecast?.[0],
      allForecastKeys: attrs.forecast?.[0] ? Object.keys(attrs.forecast[0]) : []
    });
    
    // NWS forecast might be in different locations
    let forecast = attrs.forecast || attrs.hourly_forecast || attrs.daily_forecast || [];
    
    // If forecast is not an array, try to convert it
    if (!Array.isArray(forecast)) {
      if (typeof forecast === 'object' && forecast !== null) {
        // Try to extract array from object
        forecast = forecast.forecast || forecast.daily || forecast.hourly || [];
      }
      if (!Array.isArray(forecast)) {
        console.warn('🌤️ Forecast is not an array:', forecast);
        forecast = [];
      }
    }
    
    // Limit to 5 days
    forecast = forecast.slice(0, 5);
    const condition = state.state;
    
    // NWS and other weather integrations may use different attribute names
    // Try multiple possible attribute names for feels_like/apparent temperature
    const feelsLike = attrs.apparent_temperature || 
                     attrs.feels_like || 
                     attrs.feelslike || 
                     attrs.temperature; // fallback to regular temp
    
    // Handle different forecast formats (NWS vs other integrations)
    const processedForecast = forecast.map((f, index) => {
      // NWS forecast format uses 'datetime' as ISO string or timestamp
      let forecastDate;
      if (f.datetime) {
        // Handle ISO string or timestamp
        if (typeof f.datetime === 'string') {
          forecastDate = new Date(f.datetime);
        } else if (typeof f.datetime === 'number') {
          // Could be Unix timestamp (seconds) or milliseconds
          forecastDate = f.datetime < 10000000000 ? new Date(f.datetime * 1000) : new Date(f.datetime);
        } else {
          forecastDate = new Date(f.datetime);
        }
      } else if (f.date) {
        forecastDate = typeof f.date === 'string' ? new Date(f.date) : new Date(f.date);
      } else if (f.timestamp) {
        forecastDate = f.timestamp < 10000000000 ? new Date(f.timestamp * 1000) : new Date(f.timestamp);
      } else {
        // Fallback: use today + index days
        forecastDate = new Date();
        forecastDate.setDate(forecastDate.getDate() + index);
        forecastDate.setHours(12, 0, 0, 0); // Set to noon to avoid timezone issues
      }
      
      // Validate date
      if (isNaN(forecastDate.getTime())) {
        console.warn('🌤️ Invalid forecast date:', f.datetime || f.date || f.timestamp);
        forecastDate = new Date();
        forecastDate.setDate(forecastDate.getDate() + index);
      }
      
      // NWS uses 'condition' or 'condition_state' or 'weather'
      const forecastCondition = f.condition || 
                               f.condition_state || 
                               f.weather || 
                               f.condition_state_short ||
                               condition;
      
      // Temperature can be 'temperature' or 'temp' or 'temp_max'/'temp_min'
      // NWS uses 'temperature' for high and 'templow' for low
      const high = f.temperature !== undefined ? f.temperature :
                   f.temp !== undefined ? f.temp :
                   f.temp_max !== undefined ? f.temp_max :
                   f.high !== undefined ? f.high :
                   f.max_temp !== undefined ? f.max_temp :
                   null;
      
      const low = f.templow !== undefined ? f.templow :
                  f.temp_low !== undefined ? f.temp_low :
                  f.temp_min !== undefined ? f.temp_min :
                  f.low !== undefined ? f.low :
                  f.min_temp !== undefined ? f.min_temp :
                  null;
      
      const result = {
        date: forecastDate,
        high: high !== null && high !== undefined ? Math.round(high) : null,
        low: low !== null && low !== undefined ? Math.round(low) : null,
        icon: this.getIcon(forecastCondition)
      };
      
      // Log each forecast item for debugging
      if (index === 0) {
        console.log('🌤️ First forecast item processed:', {
          original: f,
          processed: result
        });
      }
      
      return result;
    }).filter(f => {
      // Only include forecasts with at least a high temperature
      const hasData = f.high !== null || f.low !== null;
      if (!hasData) {
        console.warn('🌤️ Filtered out forecast item (no temp data):', f);
      }
      return hasData;
    });
    
    // Get icon from Home Assistant (entity_picture is a URL to the weather icon)
    const haIconUrl = attrs.entity_picture;
    let currentIcon = this.getIcon(condition); // Fallback to emoji
    
    // Convert relative URL to absolute if needed
    let currentIconUrl = null;
    if (haIconUrl) {
      if (haIconUrl.startsWith('http://') || haIconUrl.startsWith('https://')) {
        currentIconUrl = haIconUrl;
      } else if (this.haClient?.config?.url) {
        // Relative URL - make it absolute
        const baseUrl = this.haClient.config.url.replace(/\/$/, '');
        currentIconUrl = baseUrl + haIconUrl;
      }
    }
    
    // Update forecast items to use HA icons if available
    const forecastWithIcons = processedForecast.map((f, index) => {
      const forecastItem = forecast[index];
      let forecastIcon = f.icon; // Default to emoji
      let forecastIconUrl = null;
      
      // Check if forecast item has an icon URL
      if (forecastItem) {
        const forecastIconAttr = forecastItem.entity_picture || 
                                 forecastItem.icon || 
                                 forecastItem.condition_icon;
        
        if (forecastIconAttr) {
          if (forecastIconAttr.startsWith('http://') || forecastIconAttr.startsWith('https://')) {
            forecastIconUrl = forecastIconAttr;
          } else if (this.haClient?.config?.url) {
            const baseUrl = this.haClient.config.url.replace(/\/$/, '');
            forecastIconUrl = baseUrl + forecastIconAttr;
          }
        }
      }
      
      return {
        ...f,
        icon: forecastIcon,
        iconUrl: forecastIconUrl
      };
    });
    
    console.log('🌤️ Weather from HA:', {
      entity: this.config.weatherEntity,
      condition,
      temp: attrs.temperature,
      feelsLike,
      hasIconUrl: !!currentIconUrl,
      iconUrl: currentIconUrl,
      rawForecastCount: forecast.length,
      processedForecastCount: processedForecast.length
    });
    
    this.render({
      temp: Math.round(attrs.temperature || 0),
      icon: currentIcon,
      iconUrl: currentIconUrl, // Add icon URL
      humidity: attrs.humidity || attrs.humidity_value || null,
      wind: Math.round(attrs.wind_speed || attrs.wind_speed_value || 0),
      feelsLike: Math.round(feelsLike || attrs.temperature || 0),
      unit: attrs.temperature_unit || '°F', // NWS typically uses °F
      condition,
      forecast: forecastWithIcons
    });
  }

  processForecast(list) {
    const days = {};
    list.forEach(item => {
      const date = new Date(item.dt * 1000);
      const key = date.toDateString();
      if (!days[key]) {
        days[key] = { date, temps: [], icon: this.getIcon(item.weather[0].main) };
      }
      days[key].temps.push(item.main.temp);
    });
    return Object.values(days).map(d => ({
      date: d.date,
      high: Math.round(Math.max(...d.temps)),
      low: Math.round(Math.min(...d.temps)),
      icon: d.icon
    }));
  }

  showDemo() {
    // Show empty state - configure weather in control panel
    if (this.widgetEl) {
      this.widgetEl.innerHTML = `
        <div class="weather-empty" style="text-align:center;padding:1rem;color:var(--color-text-muted);font-size:0.875rem;">
          Configure weather in Control Panel
        </div>
      `;
    }
  }

  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text || '';
    return div.innerHTML;
  }

  render(data) {
    // Helper to render icon (image if URL available, emoji otherwise)
    const renderIcon = (icon, iconUrl) => {
      if (iconUrl) {
        // Escape the alt text for safety
        const safeAlt = this.escapeHtml(icon);
        // URL in src is safe - browser handles it, but we validate it's a string
        const safeUrl = String(iconUrl).replace(/"/g, '&quot;');
        return `<img src="${safeUrl}" alt="${safeAlt}" class="weather-icon-img" loading="eager" style="width: 2rem; height: 2rem; object-fit: contain;">`;
      }
      return `<span class="weather-icon">${icon}</span>`;
    };
    
    const newHtml = `
      <div class="weather-current">
        ${renderIcon(data.icon, data.iconUrl)}
        <span class="weather-temp">${data.temp}${data.unit}</span>
      </div>
      <div class="weather-details">
        <div class="weather-detail">
          <div class="weather-detail-value">${data.feelsLike}°</div>
          <div class="weather-detail-label">Feels Like</div>
        </div>
        <div class="weather-detail">
          <div class="weather-detail-value">${data.humidity}%</div>
          <div class="weather-detail-label">Humidity</div>
        </div>
        <div class="weather-detail">
          <div class="weather-detail-value">${data.wind}</div>
          <div class="weather-detail-label">Wind MPH</div>
        </div>
      </div>
      <div class="weather-forecast">
        ${data.forecast.map((day, i) => {
          const safeIconAlt = this.escapeHtml(day.icon);
          const safeIconUrl = day.iconUrl ? String(day.iconUrl).replace(/"/g, '&quot;') : null;
          return `
          <div class="forecast-day">
            <div class="forecast-day-name">${i === 0 ? 'Today' : day.date.toLocaleDateString('en-US', { weekday: 'short' })}</div>
            ${safeIconUrl ? 
              `<img src="${safeIconUrl}" alt="${safeIconAlt}" class="forecast-icon-img" loading="lazy" style="width: 1.5rem; height: 1.5rem; object-fit: contain;">` :
              `<div class="forecast-icon">${day.icon}</div>`
            }
            <div class="forecast-high">${day.high}°</div>
            <div class="forecast-low">${day.low}°</div>
          </div>
        `;
        }).join('')}
      </div>
    `;

    // Fade effect on data change
    if (newHtml !== this.lastRender) {
      this.widgetEl.style.opacity = '0';
      setTimeout(() => {
        this.widgetEl.innerHTML = newHtml;
        this.widgetEl.style.opacity = '1';
      }, 300);
      this.lastRender = newHtml;
    }

    // Update weather effects based on condition
    if (data.condition && this.weatherEffects) {
      this.weatherEffects.setWeather(data.condition);
    }
  }

  getIcon(condition) {
    const c = (condition || '').toLowerCase();
    const map = {
      // Clear/Sunny
      'clear': '☀️', 'sunny': '☀️', 'fair': '☀️', 'mostly clear': '☀️',
      // Cloudy
      'clouds': '☁️', 'cloudy': '☁️', 'overcast': '☁️', 'mostly cloudy': '☁️',
      // Partly Cloudy
      'partlycloudy': '⛅', 'partly': '⛅', 'partly cloudy': '⛅', 
      'few': '⛅', 'scattered': '⛅', 'partly sunny': '⛅',
      // Rain
      'rain': '🌧️', 'rainy': '🌧️', 'pouring': '🌧️', 'heavy rain': '🌧️',
      'drizzle': '🌦️', 'shower': '🌦️', 'showers': '🌦️', 'light rain': '🌦️',
      // Snow
      'snow': '🌨️', 'snowy': '🌨️', 'snowing': '🌨️', 'heavy snow': '🌨️',
      'snow flurries': '🌨️', 'flurries': '🌨️', 'blizzard': '🌨️',
      // Storms
      'thunderstorm': '⛈️', 'thunder': '⛈️', 'storm': '⛈️', 'storms': '⛈️',
      'lightning': '⛈️', 'thunderstorms': '⛈️',
      // Fog/Mist
      'fog': '🌫️', 'mist': '🌫️', 'haze': '🌫️', 'foggy': '🌫️',
      // Wind
      'wind': '💨', 'windy': '💨', 'breezy': '💨', 'gusty': '💨',
      // NWS specific conditions
      'sunny': '☀️', 'mostly sunny': '⛅', 'partly sunny': '⛅',
      'isolated': '🌦️', 'scattered showers': '🌦️', 'chance of rain': '🌦️',
      'sleet': '🌨️', 'freezing rain': '🌧️', 'freezing drizzle': '🌦️'
    };
    for (const [key, icon] of Object.entries(map)) {
      if (c.includes(key)) return icon;
    }
    return '🌡️';
  }
}

// ============================================
// DAD JOKE WIDGET - API Powered
// ============================================

class DadJokeWidget {
  constructor(config = {}) {
    this.config = {
      interval: config.interval || 300000
    };
    this.currentJoke = '';
    this.retryCount = 0;
    this.maxRetries = 3;
    
    // Fallback jokes if API fails
    this.fallbackJokes = [
      "Why don't scientists trust atoms? Because they make up everything!",
      "I'm reading a book about anti-gravity. It's impossible to put down!",
      "Why did the scarecrow win an award? He was outstanding in his field!",
      "What do you call a fake noodle? An impasta!",
      "Why don't eggs tell jokes? They'd crack each other up!",
      "I used to hate facial hair, but then it grew on me.",
      "What do you call a bear with no teeth? A gummy bear!",
      "Why did the bicycle fall over? It was two-tired!",
      "What do you call cheese that isn't yours? Nacho cheese!",
      "I'm on a seafood diet. I see food and I eat it.",
      "Why did the coffee file a police report? It got mugged!",
      "What do you call a dinosaur that crashes their car? Tyrannosaurus Wrecks!",
      "Why do seagulls fly over the ocean? Because if they flew over the bay, they'd be bagels!",
      "What did the ocean say to the beach? Nothing, it just waved.",
      "Why do cows wear bells? Because their horns don't work!",
      "What do you call a sleeping dinosaur? A dino-snore!",
      "What's orange and sounds like a parrot? A carrot!",
      "Why did the math book look so sad? Because it had too many problems!",
      "Why did the golfer bring two pairs of pants? In case he got a hole in one!",
      "What do you call a dog that does magic? A Labracadabrador!",
      "Why do bees have sticky hair? Because they use honeycombs!",
      "What did the grape do when it got stepped on? It let out a little wine!",
      "Why don't oysters share? Because they're shellfish!"
    ];
    this.fallbackIndex = 0;
  }

  init() {
    this.widgetEl = document.getElementById('dadjoke-widget');
    if (!this.widgetEl) return;
    
    // Fetch first joke
    this.fetchJoke();
    
    // Set interval for new jokes
    if (this.config.interval > 0) {
      setInterval(() => this.fetchJoke(), this.config.interval);
    }
  }

  async fetchJoke() {
    try {
      // icanhazdadjoke.com - free API, no key needed
      const response = await fetch('https://icanhazdadjoke.com/', {
        headers: { 
          'Accept': 'application/json',
          'User-Agent': 'Family Dashboard (https://github.com)'
        }
      });
      
      if (!response.ok) throw new Error('API error');
      
      const data = await response.json();
      
      if (data.joke) {
        this.retryCount = 0;
        this.showJoke(data.joke);
      } else {
        throw new Error('No joke in response');
      }
    } catch (error) {
      console.warn('Dad joke API error, using fallback:', error.message);
      this.showFallbackJoke();
    }
  }

  showFallbackJoke() {
    const joke = this.fallbackJokes[this.fallbackIndex];
    this.fallbackIndex = (this.fallbackIndex + 1) % this.fallbackJokes.length;
    this.showJoke(joke);
  }

  showJoke(joke) {
    const contentEl = this.widgetEl.querySelector('.joke-content');
    if (!contentEl) return;
    
    // Fade out
    contentEl.style.opacity = '0';
    
    setTimeout(() => {
      contentEl.textContent = `"${joke}"`;
      // Fade in
      contentEl.style.opacity = '1';
    }, 400);
  }

  nextJoke() {
    this.fetchJoke();
  }
}

// ============================================
// TODAY SUMMARY WIDGET
// ============================================

class TodaySummaryWidget {
  constructor() {
    this.calendarWidget = null;
    this.lastRender = '';
  }

  init(calendarWidget) {
    this.calendarWidget = calendarWidget;
    this.widgetEl = document.getElementById('today-summary');
    if (!this.widgetEl) return;
    
    this.update();
    setInterval(() => this.update(), 60000);
  }

  update() {
    if (!this.widgetEl) return;
    
    const now = new Date();
    const today = new Date(now);
    today.setHours(0, 0, 0, 0);
    
    // Get today's events
    const todayEvents = (this.calendarWidget?.events || []).filter(event => {
      const start = new Date(event.start);
      start.setHours(0, 0, 0, 0);
      const end = new Date(event.end);
      return start.getTime() === today.getTime() || (start < today && end > today);
    });
    
    // Filter to only upcoming events (not past)
    const upcomingEvents = todayEvents.filter(event => {
      // All-day events are always shown
      if (event.isAllDay) return true;
      // Timed events: show if end time hasn't passed
      const end = new Date(event.end);
      return end > now;
    }).sort((a, b) => {
      if (a.isAllDay && !b.isAllDay) return -1;
      if (!a.isAllDay && b.isAllDay) return 1;
      return new Date(a.start) - new Date(b.start);
    });

    // Determine if this is a busy day
    const isBusy = upcomingEvents.length >= 6;
    
    let newHtml;
    
    if (upcomingEvents.length === 0) {
      newHtml = `
        <div class="today-empty">
          <div class="today-empty-icon">✨</div>
          <div class="today-empty-text">No more events today</div>
        </div>
      `;
    } else {
      // Show more events on busy days since they're compact
      const maxEvents = isBusy ? 10 : 6;
      newHtml = upcomingEvents.slice(0, maxEvents).map(event => {
        const start = new Date(event.start);
        const end = new Date(event.end);
        const isNow = !event.isAllDay && start <= now && end > now;
        
        let timeStr = 'All day';
        if (!event.isAllDay) {
          timeStr = start.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
        }

        return `
          <div class="today-event ${isNow ? 'is-now' : ''}" style="--event-color: ${event.color}">
            <span class="today-event-time">${timeStr}</span>
            <span class="today-event-title">${this.escapeHtml(event.title)}</span>
          </div>
        `;
      }).join('');
      
      // Show count if there are more events
      if (upcomingEvents.length > maxEvents) {
        newHtml += `<div class="today-more">+${upcomingEvents.length - maxEvents} more</div>`;
      }
    }

    // Fade effect on change
    if (newHtml !== this.lastRender) {
      this.widgetEl.style.opacity = '0';
      setTimeout(() => {
        this.widgetEl.innerHTML = newHtml;
        // Add/remove busy class
        this.widgetEl.classList.toggle('busy', isBusy);
        this.widgetEl.style.opacity = '1';
      }, 300);
      this.lastRender = newHtml;
    }
  }

  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text || '';
    return div.innerHTML;
  }
}

// ============================================
// COUNTDOWN WIDGET
// ============================================

class CountdownWidget {
  constructor(config = {}) {
    this.config = { events: config.events || [] };
    this.calendarWidget = null;
    this.lastRender = '';
  }

  init(calendarWidget = null) {
    this.calendarWidget = calendarWidget;
    this.listEl = document.getElementById('countdown-list');
    if (!this.listEl) return;
    
    // Initial render with delay to let calendar load
    setTimeout(() => this.render(), 1500);
    
    // Update daily at midnight
    this.scheduleMidnightUpdate();
  }

  scheduleMidnightUpdate() {
    const now = new Date();
    const midnight = new Date(now);
    midnight.setDate(midnight.getDate() + 1);
    midnight.setHours(0, 0, 0, 0);
    
    setTimeout(() => {
      this.render();
      setInterval(() => this.render(), 86400000);
    }, midnight - now);
  }

  getUpcomingEvents() {
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    const events = [];
    
    // Get major US holidays for current and next year
    const currentYear = now.getFullYear();
    const holidays = this.getMajorHolidays(currentYear)
      .concat(this.getMajorHolidays(currentYear + 1));
    
    holidays.forEach(h => {
      const target = new Date(h.date);
      target.setHours(0, 0, 0, 0);
      const days = Math.ceil((target - now) / 86400000);
      if (days >= 0 && days <= 90) { // Within 90 days
        events.push({ name: h.name, date: h.date, days, type: 'holiday' });
      }
    });
    
    // Scan calendar for birthdays and special events
    if (this.calendarWidget?.events) {
      this.calendarWidget.events.forEach(event => {
        const title = (event.title || '').toLowerCase();
        const isBirthday = title.includes('birthday') || title.includes('bday') || title.includes('🎂');
        const isAnniversary = title.includes('anniversary');
        const isVacation = title.includes('vacation') || title.includes('trip') || title.includes('🏖️') || title.includes('✈️');
        const isHoliday = title.includes('holiday') || title.includes('christmas') || title.includes('thanksgiving');
        
        if (isBirthday || isAnniversary || isVacation || isHoliday) {
          const start = new Date(event.start);
          start.setHours(0, 0, 0, 0);
          const days = Math.ceil((start - now) / 86400000);
          
          if (days >= 0 && days <= 60) { // Within 60 days
            // Add emoji if not present
            let name = event.title;
            if (isBirthday && !name.includes('🎂')) name = '🎂 ' + name;
            else if (isAnniversary && !name.includes('💕')) name = '💕 ' + name;
            else if (isVacation && !name.includes('🏖️') && !name.includes('✈️')) name = '🏖️ ' + name;
            
            // Avoid duplicates
            const exists = events.some(e => 
              e.name.toLowerCase().includes(event.title.toLowerCase()) || 
              (e.days === days && e.type === 'calendar')
            );
            
            if (!exists) {
              events.push({ name, date: start.toISOString(), days, type: 'calendar' });
            }
          }
        }
      });
    }
    
    // Add any manually configured events
    this.config.events.forEach(e => {
      const target = new Date(e.date);
      target.setHours(0, 0, 0, 0);
      const days = Math.ceil((target - now) / 86400000);
      if (days >= 0) {
        events.push({ ...e, days, type: 'manual' });
      }
    });
    
    // Sort by days and remove duplicates, limit to 4
    const seen = new Set();
    return events
      .sort((a, b) => a.days - b.days)
      .filter(e => {
        const key = e.name.toLowerCase().replace(/[^a-z]/g, '');
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      })
      .slice(0, 4);
  }

  getMajorHolidays(year) {
    return [
      { name: "🎆 New Year's Day", date: `${year}-01-01` },
      { name: "💕 Valentine's Day", date: `${year}-02-14` },
      { name: "☘️ St. Patrick's Day", date: `${year}-03-17` },
      { name: "🐰 Easter", date: this.getEasterDate(year) },
      { name: "🇺🇸 Independence Day", date: `${year}-07-04` },
      { name: "🎃 Halloween", date: `${year}-10-31` },
      { name: "🦃 Thanksgiving", date: this.getThanksgivingDate(year) },
      { name: "🎄 Christmas Eve", date: `${year}-12-24` },
      { name: "🎅 Christmas", date: `${year}-12-25` },
      { name: "🥳 New Year's Eve", date: `${year}-12-31` },
    ];
  }

  getEasterDate(year) {
    // Anonymous Gregorian algorithm
    const a = year % 19;
    const b = Math.floor(year / 100);
    const c = year % 100;
    const d = Math.floor(b / 4);
    const e = b % 4;
    const f = Math.floor((b + 8) / 25);
    const g = Math.floor((b - f + 1) / 3);
    const h = (19 * a + b - d - g + 15) % 30;
    const i = Math.floor(c / 4);
    const k = c % 4;
    const l = (32 + 2 * e + 2 * i - h - k) % 7;
    const m = Math.floor((a + 11 * h + 22 * l) / 451);
    const month = Math.floor((h + l - 7 * m + 114) / 31);
    const day = ((h + l - 7 * m + 114) % 31) + 1;
    return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  }

  getThanksgivingDate(year) {
    // 4th Thursday of November
    const nov1 = new Date(year, 10, 1);
    const dayOfWeek = nov1.getDay();
    const firstThursday = dayOfWeek <= 4 ? 5 - dayOfWeek : 12 - dayOfWeek;
    const thanksgiving = firstThursday + 21; // 4th Thursday
    return `${year}-11-${String(thanksgiving).padStart(2, '0')}`;
  }

  render() {
    if (!this.listEl) return;
    
    const upcoming = this.getUpcomingEvents();

    if (upcoming.length === 0) {
      this.listEl.innerHTML = '<div style="color: var(--color-text-muted);">No upcoming events</div>';
      return;
    }

    const newHtml = upcoming.map(e => `
      <div class="countdown-item">
        <span class="countdown-name">${this.escapeHtml(e.name)}</span>
        <div class="countdown-days">
          <span class="countdown-number">${e.days}</span>
          <span class="countdown-label">${e.days === 0 ? 'TODAY!' : e.days === 1 ? 'day' : 'days'}</span>
        </div>
      </div>
    `).join('');

    // Fade effect on change
    if (newHtml !== this.lastRender) {
      this.listEl.style.opacity = '0';
      setTimeout(() => {
        this.listEl.innerHTML = newHtml;
        this.listEl.style.opacity = '1';
      }, 300);
      this.lastRender = newHtml;
    }
  }

  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text || '';
    return div.innerHTML;
  }
}

// ============================================
// DAY SNIPPET WIDGET - Natural Language Summary
// ============================================

class DaySnippetWidget {
  constructor() {
    this.calendarWidget = null;
    this.weatherWidget = null;
    this.snippetEl = null;
  }

  init(calendarWidget, weatherWidget) {
    this.calendarWidget = calendarWidget;
    this.weatherWidget = weatherWidget;
    this.snippetEl = document.getElementById('day-snippet');
    
    if (!this.snippetEl) return;
    
    // Initial update with delay to let calendar load
    setTimeout(() => this.update(), 2000);
    
    // Update every minute
    setInterval(() => this.update(), 60000);
  }

  update() {
    if (!this.snippetEl) return;
    
    const snippet = this.generateSnippet();
    const textEl = this.snippetEl.querySelector('.snippet-text');
    
    if (textEl) {
      textEl.style.opacity = '0';
      setTimeout(() => {
        textEl.innerHTML = snippet;
        textEl.style.opacity = '1';
      }, 300);
    }
  }

  generateSnippet() {
    const now = new Date();
    const today = new Date(now);
    today.setHours(0, 0, 0, 0);
    
    // Get today's events
    const events = (this.calendarWidget?.events || []).filter(event => {
      const start = new Date(event.start);
      start.setHours(0, 0, 0, 0);
      const end = new Date(event.end);
      return start.getTime() === today.getTime() || (start < today && end > today);
    }).sort((a, b) => {
      if (a.isAllDay && !b.isAllDay) return -1;
      if (!a.isAllDay && b.isAllDay) return 1;
      return new Date(a.start) - new Date(b.start);
    });

    // Get upcoming (not past) timed events
    const upcomingEvents = events.filter(e => {
      if (e.isAllDay) return false;
      return new Date(e.end) > now;
    });

    // Get weather info from widget
    const weatherEl = document.getElementById('weather-widget');
    let weatherText = '';
    if (weatherEl) {
      const tempEl = weatherEl.querySelector('.weather-temp');
      const iconEl = weatherEl.querySelector('.weather-icon');
      if (tempEl && iconEl) {
        const temp = tempEl.textContent;
        const icon = iconEl.textContent;
        weatherText = this.getWeatherPhrase(icon, temp);
      }
    }

    // Build the snippet
    let parts = [];

    // Event summary
    if (events.length === 0) {
      parts.push(`<span class="snippet-free">Your day is wide open</span> — perfect for whatever comes your way`);
    } else if (upcomingEvents.length === 0 && events.some(e => e.isAllDay)) {
      const allDay = events.filter(e => e.isAllDay);
      if (allDay.length === 1) {
        parts.push(`Today is <span class="snippet-highlight">${this.escapeHtml(allDay[0].title)}</span>`);
      } else {
        parts.push(`You have <span class="snippet-highlight">${allDay.length} all-day events</span> today`);
      }
    } else if (upcomingEvents.length === 0) {
      parts.push(`<span class="snippet-free">You're done for the day!</span> All events completed`);
    } else if (upcomingEvents.length === 1) {
      const e = upcomingEvents[0];
      const time = this.formatTime(new Date(e.start));
      parts.push(`You have <span class="snippet-highlight">${this.escapeHtml(e.title)}</span> at <span class="snippet-highlight">${time}</span>`);
    } else if (upcomingEvents.length === 2) {
      const e1 = upcomingEvents[0];
      const e2 = upcomingEvents[1];
      parts.push(`Today you have <span class="snippet-highlight">${this.escapeHtml(e1.title)}</span> at ${this.formatTime(new Date(e1.start))} and <span class="snippet-highlight">${this.escapeHtml(e2.title)}</span> at ${this.formatTime(new Date(e2.start))}`);
    } else if (upcomingEvents.length <= 4) {
      const e1 = upcomingEvents[0];
      parts.push(`<span class="snippet-busy">${upcomingEvents.length} things on your plate today</span> — starting with <span class="snippet-highlight">${this.escapeHtml(e1.title)}</span> at ${this.formatTime(new Date(e1.start))}`);
    } else {
      parts.push(`<span class="snippet-busy">Busy day ahead!</span> You have <span class="snippet-highlight">${upcomingEvents.length} events</span> scheduled`);
    }

    // Add weather if available
    if (weatherText) {
      parts.push(weatherText);
    }

    return parts.join('. ') + '.';
  }

  getWeatherPhrase(icon, temp) {
    const tempNum = parseInt(temp);
    
    // Weather condition phrases
    const conditions = {
      '☀️': ['sunny', 'Clear skies and sunshine today', 'Beautiful sunny day ahead'],
      '⛅': ['partly cloudy', 'Mix of sun and clouds', 'Some clouds but still pleasant'],
      '☁️': ['cloudy', 'Overcast skies today', 'Cloudy but dry'],
      '🌧️': ['rainy', 'Grab an umbrella — rain expected', 'Rainy day, stay dry'],
      '🌦️': ['light rain', 'Scattered showers possible', 'Light rain in the forecast'],
      '🌨️': ['snowy', 'Snow in the forecast — bundle up', 'Looks like snow today'],
      '⛈️': ['stormy', 'Thunderstorms expected — stay safe', 'Storms rolling in'],
      '🌫️': ['foggy', 'Foggy conditions', 'Visibility might be low with fog'],
      '💨': ['windy', 'Hold onto your hat — it\'s windy', 'Breezy conditions today']
    };

    let phrase = '';
    for (const [emoji, phrases] of Object.entries(conditions)) {
      if (icon.includes(emoji)) {
        phrase = phrases[Math.floor(Math.random() * phrases.length)];
        break;
      }
    }

    // Add temperature context
    if (!phrase && !isNaN(tempNum)) {
      if (tempNum < 32) phrase = 'Bundle up — it\'s freezing out there';
      else if (tempNum < 50) phrase = 'Chilly day, grab a jacket';
      else if (tempNum < 70) phrase = 'Nice and mild today';
      else if (tempNum < 85) phrase = 'Warm and pleasant';
      else phrase = 'Hot one today — stay cool';
    }

    return phrase ? `<span class="snippet-weather">${phrase}</span>` : '';
  }

  formatTime(date) {
    return date.toLocaleTimeString('en-US', { 
      hour: 'numeric', 
      minute: '2-digit',
      hour12: true 
    }).toLowerCase();
  }

  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text || '';
    return div.innerHTML;
  }
}

// ============================================
// CURSOR HIDER
// ============================================

class CursorHider {
  constructor(timeout = 5000) {
    this.timeout = timeout;
    this.timer = null;
  }

  init() {
    if (this.timeout <= 0) return;
    
    const reset = () => {
      document.body.classList.remove('cursor-hidden');
      clearTimeout(this.timer);
      this.timer = setTimeout(() => document.body.classList.add('cursor-hidden'), this.timeout);
    };

    document.addEventListener('mousemove', reset);
    reset();
  }
}

// ============================================
// WEATHER EFFECTS - Animated Background
// ============================================

class WeatherEffects {
  constructor() {
    this.container = null;
    this.currentEffect = null;
  }

  init() {
    this.container = document.getElementById('weather-effects');
    if (!this.container) return;
  }

  setWeather(condition) {
    if (!this.container) return;
    
    const normalizedCondition = this.normalizeCondition(condition);
    
    // Don't re-render if same condition
    if (normalizedCondition === this.currentEffect) return;
    
    this.currentEffect = normalizedCondition;
    this.container.className = 'weather-effects';
    this.container.innerHTML = '';
    
    // Add appropriate effect
    switch (normalizedCondition) {
      case 'snow':
        this.createSnow();
        break;
      case 'rain':
        this.createRain();
        break;
      case 'thunder':
        this.createThunderstorm();
        break;
      case 'cloudy':
        this.createClouds();
        break;
      case 'sunny':
        this.createSunny();
        break;
      case 'fog':
        this.createFog();
        break;
      case 'wind':
        this.createWind();
        break;
      case 'clear-night':
        this.createStars();
        break;
      default:
        // No effect for unknown conditions
        return;
    }
    
    // Activate with fade
    setTimeout(() => this.container.classList.add('active'), 100);
  }

  normalizeCondition(condition) {
    const c = (condition || '').toLowerCase();
    
    // Check if it's nighttime using TimeTheme if available
    let isNight = false;
    if (window.TimeTheme) {
      const info = TimeTheme.getInfo();
      isNight = !info.isDaytime;
    } else {
      const hour = new Date().getHours();
      isNight = hour < 6 || hour >= 20;
    }
    
    if (c.includes('snow') || c.includes('flurr') || c.includes('blizzard')) return 'snow';
    if (c.includes('thunder') || c.includes('storm') || c.includes('lightning')) return 'thunder';
    if (c.includes('rain') || c.includes('drizzle') || c.includes('shower') || c.includes('pour')) return 'rain';
    if (c.includes('fog') || c.includes('mist') || c.includes('haze')) return 'fog';
    if (c.includes('wind') || c.includes('breezy') || c.includes('gusty')) return 'wind';
    if (c.includes('cloud') || c.includes('overcast')) return 'cloudy';
    if (c.includes('partly')) return isNight ? 'clear-night' : 'cloudy';
    if (c.includes('clear') || c.includes('sunny') || c.includes('fair')) {
      return isNight ? 'clear-night' : 'sunny';
    }
    
    return null;
  }

  createSnow() {
    this.container.classList.add('snow');
    // Use DocumentFragment for better performance
    const fragment = document.createDocumentFragment();
    const count = 35; // Reduced for performance
    
    for (let i = 0; i < count; i++) {
      const flake = document.createElement('div');
      flake.className = 'snowflake';
      flake.textContent = '❄';
      flake.style.cssText = `left:${Math.random() * 100}%;animation-delay:${Math.random() * 10}s`;
      fragment.appendChild(flake);
    }
    this.container.appendChild(fragment);
  }

  createRain() {
    this.container.classList.add('rain');
    const fragment = document.createDocumentFragment();
    const count = 60; // Reduced for performance
    
    for (let i = 0; i < count; i++) {
      const drop = document.createElement('div');
      drop.className = 'raindrop';
      drop.style.cssText = `left:${Math.random() * 100}%;animation-delay:${Math.random() * 2}s`;
      fragment.appendChild(drop);
    }
    this.container.appendChild(fragment);
  }

  createThunderstorm() {
    this.container.classList.add('thunder', 'rain');
    
    const fragment = document.createDocumentFragment();
    const rainCount = 50; // Reduced for performance
    for (let i = 0; i < rainCount; i++) {
      const drop = document.createElement('div');
      drop.className = 'raindrop';
      drop.style.cssText = `left:${Math.random() * 100}%;animation-delay:${Math.random() * 2}s`;
      fragment.appendChild(drop);
    }
    this.container.appendChild(fragment);
  }

  createClouds() {
    this.container.classList.add('cloudy');
    
    for (let i = 0; i < 4; i++) {
      const cloud = document.createElement('div');
      cloud.className = 'cloud';
      this.container.appendChild(cloud);
    }
  }

  createSunny() {
    this.container.classList.add('sunny');
    
    // Add sun rays
    for (let i = 0; i < 8; i++) {
      const ray = document.createElement('div');
      ray.className = 'sunray';
      ray.style.transform = `rotate(${i * 12 - 30}deg)`;
      ray.style.animationDelay = `${i * 0.3}s`;
      this.container.appendChild(ray);
    }
  }

  createFog() {
    this.container.classList.add('fog');
    
    for (let i = 0; i < 3; i++) {
      const layer = document.createElement('div');
      layer.className = 'fog-layer';
      this.container.appendChild(layer);
    }
  }

  createWind() {
    this.container.classList.add('windy');
    
    for (let i = 0; i < 8; i++) {
      const line = document.createElement('div');
      line.className = 'wind-line';
      line.style.left = `${Math.random() * 50}%`;
      this.container.appendChild(line);
    }
  }

  createStars() {
    this.container.classList.add('clear-night');
    const fragment = document.createDocumentFragment();
    const count = 40; // Reduced for performance
    
    for (let i = 0; i < count; i++) {
      const star = document.createElement('div');
      star.className = 'star';
      star.style.cssText = `left:${Math.random() * 100}%;top:${Math.random() * 60}%;animation-delay:${Math.random() * 3}s`;
      fragment.appendChild(star);
    }
    this.container.appendChild(fragment);
  }

  clear() {
    if (this.container) {
      this.container.classList.remove('active');
      setTimeout(() => {
        this.container.className = 'weather-effects';
        this.container.innerHTML = '';
        this.currentEffect = null;
      }, 2000);
    }
  }
}

// Export
window.ClockWidget = ClockWidget;
window.GreetingWidget = GreetingWidget;
window.WeatherWidget = WeatherWidget;
window.DadJokeWidget = DadJokeWidget;
window.TodaySummaryWidget = TodaySummaryWidget;
window.DaySnippetWidget = DaySnippetWidget;
window.CountdownWidget = CountdownWidget;
window.WeatherEffects = WeatherEffects;
window.CursorHider = CursorHider;
