/**
 * Weather Effects Controller
 * Creates animated weather overlays based on current conditions
 */

class WeatherEffectsController {
  constructor() {
    this.container = document.getElementById('weather-effects');
    this.currentEffect = null;
    this.enabled = true;
  }

  init() {
    if (!this.container) {
      console.warn('Weather effects container not found');
      return;
    }
    
    console.log('🌦️ Weather effects initialized');
    
    // Check config for enabled state
    this.enabled = window.CONFIG?.weather?.enableEffects !== false;
    
    if (!this.enabled) {
      console.log('🌦️ Weather effects disabled in config');
      return;
    }
  }

  setWeather(condition) {
    if (!this.container || !this.enabled) return;
    
    const normalizedCondition = (condition || '').toLowerCase().replace(/[^a-z]/g, '');
    console.log('🌦️ Setting weather effect:', condition, '→', normalizedCondition);
    
    // Clear previous effects
    this.clear();
    
    // Map conditions to effects
    const effectMap = {
      'snow': 'snow',
      'snowy': 'snow',
      'snowyrainy': 'snow',
      'rain': 'rain',
      'rainy': 'rain',
      'pouring': 'rain',
      'thunder': 'thunder',
      'thunderstorm': 'thunder',
      'lightning': 'thunder',
      'lightningrainy': 'thunder',
      'cloudy': 'cloudy',
      'overcast': 'cloudy',
      'partlycloudy': 'cloudy',
      'sunny': 'sunny',
      'clear': this.isNight() ? 'clear-night' : 'sunny',
      'clearnight': 'clear-night',
      'fog': 'fog',
      'foggy': 'fog',
      'hazy': 'fog',
      'mist': 'fog',
      'windy': 'windy',
      'windyvariant': 'windy'
    };
    
    const effect = effectMap[normalizedCondition];
    
    if (effect) {
      this.applyEffect(effect);
    } else {
      console.log('🌦️ No effect for condition:', condition);
    }
  }

  isNight() {
    const hour = new Date().getHours();
    return hour < 6 || hour >= 20;
  }

  applyEffect(effectType) {
    this.currentEffect = effectType;
    this.container.className = `weather-effects ${effectType} active`;
    
    // Generate effect elements
    switch (effectType) {
      case 'snow':
        this.createSnowflakes();
        break;
      case 'rain':
        this.createRaindrops();
        break;
      case 'thunder':
        this.createRaindrops();
        this.container.classList.add('thunder');
        break;
      case 'cloudy':
        this.createClouds();
        break;
      case 'sunny':
        this.createSunrays();
        break;
      case 'fog':
        this.createFog();
        break;
      case 'windy':
        this.createWindLines();
        break;
      case 'clear-night':
        this.createStars();
        break;
    }
    
    console.log('🌦️ Applied effect:', effectType);
  }

  createSnowflakes() {
    const count = 50;
    for (let i = 0; i < count; i++) {
      const flake = document.createElement('div');
      flake.className = 'snowflake';
      flake.innerHTML = '❄';
      flake.style.left = Math.random() * 100 + '%';
      flake.style.animationDelay = Math.random() * 10 + 's';
      this.container.appendChild(flake);
    }
  }

  createRaindrops() {
    const count = 100;
    for (let i = 0; i < count; i++) {
      const drop = document.createElement('div');
      drop.className = 'raindrop';
      drop.style.left = Math.random() * 100 + '%';
      drop.style.animationDelay = Math.random() * 2 + 's';
      this.container.appendChild(drop);
    }
  }

  createClouds() {
    const count = 4;
    for (let i = 0; i < count; i++) {
      const cloud = document.createElement('div');
      cloud.className = 'cloud';
      this.container.appendChild(cloud);
    }
  }

  createSunrays() {
    const count = 8;
    for (let i = 0; i < count; i++) {
      const ray = document.createElement('div');
      ray.className = 'sunray';
      ray.style.transform = `rotate(${i * 15}deg)`;
      ray.style.animationDelay = i * 0.2 + 's';
      this.container.appendChild(ray);
    }
  }

  createFog() {
    const count = 3;
    for (let i = 0; i < count; i++) {
      const layer = document.createElement('div');
      layer.className = 'fog-layer';
      this.container.appendChild(layer);
    }
  }

  createWindLines() {
    const count = 5;
    for (let i = 0; i < count; i++) {
      const line = document.createElement('div');
      line.className = 'wind-line';
      this.container.appendChild(line);
    }
  }

  createStars() {
    const count = 50;
    for (let i = 0; i < count; i++) {
      const star = document.createElement('div');
      star.className = 'star';
      star.style.left = Math.random() * 100 + '%';
      star.style.top = Math.random() * 60 + '%';
      star.style.animationDelay = Math.random() * 3 + 's';
      this.container.appendChild(star);
    }
  }

  clear() {
    if (this.container) {
      this.container.innerHTML = '';
      this.container.className = 'weather-effects';
    }
    this.currentEffect = null;
  }

  toggle(enabled) {
    this.enabled = enabled;
    if (!enabled) {
      this.clear();
    }
  }
}

// Create global instance
window.WeatherEffectsController = WeatherEffectsController;
window.weatherEffects = new WeatherEffectsController();

// Auto-init when DOM ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => window.weatherEffects.init());
} else {
  window.weatherEffects.init();
}
