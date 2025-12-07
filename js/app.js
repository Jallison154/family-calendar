/**
 * Dashboard - Main Application
 * Performance optimized version
 */

class Dashboard {
  constructor() {
    this.modules = {};
    this.config = null;
    this.intervals = []; // Track intervals for cleanup
    this.weatherEffectIndex = 0;
  }

  async init() {
    console.log('📅 Dashboard starting...');
    
    this.loadConfig();
    this.setupLiveSync();
    this.setupErrorHandling();
    
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', () => this.start());
    } else {
      await this.start();
    }
  }

  loadConfig() {
    const stored = localStorage.getItem('familyDashboardSettings');
    if (stored) {
      try {
        this.config = JSON.parse(stored);
      } catch (e) {
        console.warn('Invalid stored config, using defaults');
        this.config = window.CONFIG || {};
      }
    } else {
      this.config = window.CONFIG || {};
    }
    window.CONFIG = this.config;
  }

  setupLiveSync() {
    window.addEventListener('storage', (e) => {
      if (e.key === 'dashboardUpdate' || e.key === 'familyDashboardSettings') {
        console.log('🔄 Settings changed, reloading...');
        this.cleanup();
        location.reload();
      }
    });
  }

  setupErrorHandling() {
    window.addEventListener('error', (e) => {
      console.error('Dashboard error:', e.error);
    });
    
    window.addEventListener('unhandledrejection', (e) => {
      console.error('Unhandled promise rejection:', e.reason);
    });
  }

  async start() {
    const config = this.config;
    const display = config.display || {};

    try {
      // Time-of-day theme (depends on sunrise/sunset)
      if (window.TimeTheme) {
        TimeTheme.init();
        console.log('✓ Time Theme');
      }

      // Background - non-blocking
      this.modules.slideshow = new UnsplashSlideshow(config.unsplash || {});
      this.modules.slideshow.init().catch(e => console.warn('Slideshow error:', e));
      console.log('✓ Background');

      // Clock - high priority
      this.modules.clock = new ClockWidget({
        use24Hour: display.use24Hour,
        showSeconds: display.showSeconds
      });
      this.modules.clock.init();
      console.log('✓ Clock');

      // Greeting
      this.modules.greeting = new GreetingWidget({
        name: display.greetingName || ''
      });
      this.modules.greeting.init();
      console.log('✓ Greeting');

      // Weather Effects (animated background)
      this.modules.weatherEffects = new WeatherEffects();
      this.modules.weatherEffects.init();
      console.log('✓ Weather Effects');

      // Home Assistant - non-blocking
      this.modules.homeAssistant = new HomeAssistantClient(config.homeAssistant || {});
      this.modules.homeAssistant.init().catch(e => console.warn('HA error:', e));
      console.log('✓ Home Assistant');

      // Weather
      this.modules.weather = new WeatherWidget(config.weather || {});
      this.modules.weather.init(this.modules.homeAssistant, this.modules.weatherEffects);
      console.log('✓ Weather');

      // Dad Joke - non-blocking
      this.modules.dadJoke = new DadJokeWidget(config.dadJoke || {});
      this.modules.dadJoke.init();
      console.log('✓ Dad Jokes');

      // Calendar
      this.modules.calendar = new GoogleCalendarWidget(config.googleCalendar || {});
      await this.modules.calendar.init();
      console.log('✓ Calendar');

      // Today Summary - depends on calendar
      this.modules.todaySummary = new TodaySummaryWidget();
      this.modules.todaySummary.init(this.modules.calendar);
      console.log('✓ Today Summary');

      // Day Snippet - depends on calendar & weather
      this.modules.daySnippet = new DaySnippetWidget();
      this.modules.daySnippet.init(this.modules.calendar, this.modules.weather);
      console.log('✓ Day Snippet');

      // Countdown - auto-detects holidays and birthdays from calendar
      this.modules.countdown = new CountdownWidget({
        events: config.countdowns || []
      });
      this.modules.countdown.init(this.modules.calendar);
      console.log('✓ Countdown');

      // Cursor hider
      if (display.hideCursorAfter > 0) {
        this.modules.cursorHider = new CursorHider(display.hideCursorAfter);
        this.modules.cursorHider.init();
      }

      // Family tabs (display only)
      this.initFamilyTabs();

      this.setupKeyboard();
      this.setupVisibilityHandler();
      this.setupPerformanceMonitor();

      console.log('🎉 Dashboard ready!');

    } catch (error) {
      console.error('❌ Error:', error);
    }
  }

  setupVisibilityHandler() {
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') {
        // Delay refresh slightly to let browser settle
        setTimeout(() => this.refresh(), 500);
      }
    });
  }

  setupPerformanceMonitor() {
    // Log performance metrics in dev mode
    if (location.hostname === 'localhost' || location.hostname === '127.0.0.1') {
      setInterval(() => {
        if (performance.memory) {
          const used = Math.round(performance.memory.usedJSHeapSize / 1048576);
          const total = Math.round(performance.memory.totalJSHeapSize / 1048576);
          if (used > 100) {
            console.warn(`⚠️ Memory usage: ${used}MB / ${total}MB`);
          }
        }
      }, 60000);
    }
  }

  setupKeyboard() {
    document.addEventListener('keydown', (e) => {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;

      switch (e.key.toLowerCase()) {
        case 'f':
          if (!document.fullscreenElement) {
            document.documentElement.requestFullscreen().catch(() => {});
          } else {
            document.exitFullscreen().catch(() => {});
          }
          break;
        case 'r':
          this.refresh();
          break;
        case ' ':
          e.preventDefault();
          this.modules.slideshow?.next();
          break;
        case 'j':
          this.modules.dadJoke?.nextJoke();
          break;
        case 'c':
          window.open('control.html', '_blank');
          break;
        case 'w':
          this.cycleWeatherEffect();
          break;
        case 't':
          this.cycleTimeTheme();
          break;
      }
    });
  }

  cycleTimeTheme() {
    const phases = ['night', 'dawn', 'morning', 'midday', 'afternoon', 'dusk', 'evening'];
    const currentClass = [...document.body.classList].find(c => c.startsWith('time-'));
    const currentPhase = currentClass ? currentClass.replace('time-', '') : '';
    const currentIndex = phases.indexOf(currentPhase);
    const nextIndex = (currentIndex + 1) % phases.length;
    const nextPhase = phases[nextIndex];
    
    document.body.classList.remove(...phases.map(p => `time-${p}`));
    document.body.classList.add(`time-${nextPhase}`);
    console.log('⏰ Time theme:', nextPhase);
  }

  cycleWeatherEffect() {
    const effects = ['snow', 'rain', 'thunder', 'cloudy', 'sunny', 'fog', 'clear-night', 'wind'];
    this.weatherEffectIndex = (this.weatherEffectIndex + 1) % effects.length;
    const effect = effects[this.weatherEffectIndex];
    console.log('🌤️ Weather effect:', effect);
    this.modules.weatherEffects?.setWeather(effect);
  }

  initFamilyTabs() {
    const tabsEl = document.getElementById('family-tabs');
    if (!tabsEl) return;

    // Default family members (can be configured later)
    const familyMembers = [
      { id: 'david', name: 'Da David', color: 'red', count: '2/5' },
      { id: 'emily', name: 'Em Emily', color: 'purple', count: '2/3' },
      { id: 'lucas', name: 'Lu Lucas', color: 'yellow', count: '3/4' }
    ];

    // Display-only tabs (no interaction)
    tabsEl.innerHTML = familyMembers.map(member => `
      <div class="family-tab color-${member.color}">
        <span>${member.name}</span>
        <span class="family-tab-count">${member.count}</span>
      </div>
    `).join('');
  }

  refresh() {
    console.log('🔄 Refreshing...');
    
    // Batch updates with requestAnimationFrame for smoother performance
    requestAnimationFrame(() => {
      this.modules.calendar?.refresh();
      this.modules.weather?.update();
      this.modules.todaySummary?.update();
      this.modules.daySnippet?.update();
      this.modules.countdown?.render();
    });
  }

  cleanup() {
    // Clean up intervals and connections
    this.intervals.forEach(id => clearInterval(id));
    this.modules.homeAssistant?.disconnect();
    this.modules.slideshow?.stop();
  }
}

// Initialize
const dashboard = new Dashboard();
dashboard.init();

// Expose for debugging
window.dashboard = dashboard;

// Cleanup on page unload
window.addEventListener('beforeunload', () => dashboard.cleanup());
