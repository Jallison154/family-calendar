/**
 * Layout Manager
 * Handles saving and loading widget layouts
 */

class LayoutManager {
  constructor() {
    this.storageKey = 'familyDashboardLayout';
    this.currentLayout = null;
  }

  /**
   * Load layout from storage or config
   */
  loadLayout() {
    // Try localStorage first
    if (typeof Storage !== 'undefined') {
      const stored = localStorage.getItem(this.storageKey);
      if (stored) {
        try {
          this.currentLayout = JSON.parse(stored);
          return this.currentLayout;
        } catch (e) {
          console.warn('Failed to parse stored layout:', e);
        }
      }
    }

    // Fall back to config
    if (window.CONFIG && window.CONFIG.layout) {
      this.currentLayout = window.CONFIG.layout;
      return this.currentLayout;
    }

    // Default layout
    return this.getDefaultLayout();
  }

  /**
   * Save layout to storage
   */
  saveLayout(layout) {
    this.currentLayout = layout;
    
    if (typeof Storage !== 'undefined') {
      try {
        localStorage.setItem(this.storageKey, JSON.stringify(layout));
        console.log('✓ Layout saved');
      } catch (e) {
        console.error('Failed to save layout:', e);
      }
    }
  }

  /**
   * Get default layout
   */
  getDefaultLayout() {
    return {
      widgets: [
        {
          id: 'clock',
          type: 'clock',
          gridColumn: '1 / 5',
          gridRow: '1 / 4'
        },
        {
          id: 'weather',
          type: 'weather',
          gridColumn: '5 / 9',
          gridRow: '1 / 4'
        },
        {
          id: 'calendar',
          type: 'calendar',
          gridColumn: '1 / 13',
          gridRow: '4 / 11'
        },
        {
          id: 'homeassistant',
          type: 'homeassistant',
          gridColumn: '1 / 7',
          gridRow: '11 / 13'
        },
        {
          id: 'dadjoke',
          type: 'dadjoke',
          gridColumn: '7 / 13',
          gridRow: '11 / 13'
        }
      ]
    };
  }

  /**
   * Update widget layout
   */
  updateWidgetLayout(widgetId, layout) {
    if (!this.currentLayout) {
      this.currentLayout = this.loadLayout();
    }

    const widget = this.currentLayout.widgets.find(w => w.id === widgetId);
    if (widget) {
      Object.assign(widget, layout);
      this.saveLayout(this.currentLayout);
    }
  }

  /**
   * Get layout for a widget
   */
  getWidgetLayout(widgetId) {
    if (!this.currentLayout) {
      this.currentLayout = this.loadLayout();
    }

    return this.currentLayout.widgets.find(w => w.id === widgetId);
  }
}

// Create global instance
const layoutManager = new LayoutManager();

// Export
if (typeof window !== 'undefined') {
  window.LayoutManager = LayoutManager;
  window.layoutManager = layoutManager;
}


