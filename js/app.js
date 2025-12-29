/**
 * Main Application
 * Initializes and manages the dashboard
 */

class DashboardApp {
  constructor() {
    this.config = window.CONFIG || {};
    this.haClient = null;
    this.calendarClient = null;
    this.widgets = [];
    this.visitorMode = false;
    this.unsplashSlideshow = null;
  }

  async init() {
    console.log('🚀 Initializing Family Calendar Dashboard...');
    
    // Initialize Unsplash Background Slideshow
    if (this.config.unsplash && window.UnsplashSlideshow) {
      this.unsplashSlideshow = new UnsplashSlideshow(this.config.unsplash);
      await this.unsplashSlideshow.init();
    }
    
    // Initialize Home Assistant
    if (this.config.homeAssistant?.url && this.config.homeAssistant?.accessToken) {
      this.haClient = new HomeAssistantClient(this.config.homeAssistant);
      await this.haClient.init();
      window.app = this; // Make available to widgets
    }
    
    // Initialize Google Calendar
    if (this.config.googleCalendar?.icsFeeds?.length > 0) {
      this.calendarClient = new GoogleCalendarClient(this.config.googleCalendar);
      await this.calendarClient.fetchEvents();
    }
    
    // Load layout and create widgets
    const layout = layoutManager.loadLayout();
    this.createWidgets(layout);
    
    // Check visitor mode
    this.checkVisitorMode();
    
    // Listen for config changes
    window.addEventListener('storage', (e) => {
      if (e.key === 'familyDashboardConfig' || e.key === 'familyDashboardSettings') {
        console.log('🔄 Config changed, reloading...');
        location.reload();
      }
    });
    
    console.log('✅ Dashboard initialized');
  }

  createWidgets(layout) {
    if (!layout || !layout.widgets) {
      console.warn('No layout configuration found');
      return;
    }

    layout.widgets.forEach(widgetConfig => {
      try {
        const widget = widgetRegistry.create(widgetConfig);
        if (widget) {
          widget.init();
          this.widgets.push(widget);
          console.log(`✓ Created widget: ${widgetConfig.type} (${widgetConfig.id})`);
        }
      } catch (e) {
        console.error(`Failed to create widget ${widgetConfig.type}:`, e);
      }
    });
  }

  checkVisitorMode() {
    // Check localStorage or Home Assistant for visitor mode
    const stored = localStorage.getItem('visitorMode');
    if (stored === 'true') {
      this.setVisitorMode(true);
    }
  }

  setVisitorMode(enabled) {
    this.visitorMode = enabled;
    document.body.classList.toggle('visitor-mode', enabled);
    localStorage.setItem('visitorMode', enabled.toString());
  }
}

// Initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    const app = new DashboardApp();
    app.init();
  });
} else {
  const app = new DashboardApp();
  app.init();
}
