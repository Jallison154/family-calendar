/**
 * Widget Registry
 * Manages widget registration and instantiation
 */

class WidgetRegistry {
  constructor() {
    this.widgets = new Map();
    this.instances = new Map();
  }

  /**
   * Register a widget class
   */
  register(type, WidgetClass) {
    this.widgets.set(type, WidgetClass);
    console.log(`✓ Registered widget: ${type}`);
  }

  /**
   * Create a widget instance
   */
  create(config) {
    const { type, id } = config;
    
    if (!this.widgets.has(type)) {
      console.error(`Widget type "${type}" not registered`);
      return null;
    }

    const WidgetClass = this.widgets.get(type);
    const widget = new WidgetClass(config);
    
    if (id) {
      this.instances.set(id, widget);
    }
    
    return widget;
  }

  /**
   * Get widget instance by ID
   */
  get(id) {
    return this.instances.get(id);
  }

  /**
   * Get all widget instances
   */
  getAll() {
    return Array.from(this.instances.values());
  }

  /**
   * Destroy a widget
   */
  destroy(id) {
    const widget = this.instances.get(id);
    if (widget) {
      widget.destroy();
      this.instances.delete(id);
    }
  }

  /**
   * Destroy all widgets
   */
  destroyAll() {
    this.instances.forEach(widget => widget.destroy());
    this.instances.clear();
  }
}

// Create global instance
const widgetRegistry = new WidgetRegistry();

// Export
if (typeof window !== 'undefined') {
  window.WidgetRegistry = WidgetRegistry;
  window.widgetRegistry = widgetRegistry;
}


