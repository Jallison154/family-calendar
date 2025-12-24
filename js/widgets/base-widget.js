/**
 * Base Widget Class
 * All widgets extend this class
 */

class BaseWidget {
  constructor(config = {}) {
    this.config = config;
    this.id = config.id || `widget-${Date.now()}`;
    this.type = config.type || 'base';
    this.element = null;
    this.initialized = false;
    this.updateInterval = null;
  }

  /**
   * Initialize the widget
   */
  init() {
    if (this.initialized) return;
    
    this.createElement();
    this.attachToDOM();
    this.initialized = true;
    this.onInit();
  }

  /**
   * Create the widget DOM element
   */
  createElement() {
    this.element = document.createElement('div');
    this.element.className = `widget widget-${this.type}`;
    this.element.id = this.id;
    this.element.dataset.widgetType = this.type;
    
    // Apply grid positioning from config
    if (this.config.gridColumn) {
      this.element.style.gridColumn = this.config.gridColumn;
    }
    if (this.config.gridRow) {
      this.element.style.gridRow = this.config.gridRow;
    }
    
    // Build widget structure
    this.element.innerHTML = this.getHTML();
    
    // Call render hook
    this.render();
  }

  /**
   * Get widget HTML structure
   * Override in child classes
   */
  getHTML() {
    return `
      <div class="widget-header">
        <span class="widget-icon">📦</span>
        <span class="widget-title">${this.type}</span>
      </div>
      <div class="widget-body">
        ${this.getContent()}
      </div>
    `;
  }

  /**
   * Get widget content
   * Override in child classes
   */
  getContent() {
    return '<p>Widget content</p>';
  }

  /**
   * Attach widget to DOM
   */
  attachToDOM() {
    const dashboard = document.getElementById('dashboard');
    if (dashboard) {
      dashboard.appendChild(this.element);
    }
  }

  /**
   * Render widget content
   * Override in child classes
   */
  render() {
    // Override in child classes
  }

  /**
   * Update widget data
   * Override in child classes
   */
  async update() {
    // Override in child classes
  }

  /**
   * Called after initialization
   * Override in child classes
   */
  onInit() {
    // Override in child classes
  }

  /**
   * Start auto-update interval
   */
  startAutoUpdate(interval = 60000) {
    if (this.updateInterval) {
      clearInterval(this.updateInterval);
    }
    this.updateInterval = setInterval(() => this.update(), interval);
  }

  /**
   * Stop auto-update interval
   */
  stopAutoUpdate() {
    if (this.updateInterval) {
      clearInterval(this.updateInterval);
      this.updateInterval = null;
    }
  }

  /**
   * Destroy widget
   */
  destroy() {
    this.stopAutoUpdate();
    if (this.element && this.element.parentNode) {
      this.element.parentNode.removeChild(this.element);
    }
    this.initialized = false;
  }

  /**
   * Update widget position/size
   */
  updateLayout(layout) {
    if (layout.gridColumn) {
      this.element.style.gridColumn = layout.gridColumn;
      this.config.gridColumn = layout.gridColumn;
    }
    if (layout.gridRow) {
      this.element.style.gridRow = layout.gridRow;
      this.config.gridRow = layout.gridRow;
    }
  }
}

// Export
if (typeof window !== 'undefined') {
  window.BaseWidget = BaseWidget;
}


