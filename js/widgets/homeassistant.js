/**
 * Home Assistant Widget
 */

class HomeAssistantWidget extends BaseWidget {
  constructor(config = {}) {
    super(config);
    this.type = 'homeassistant';
    this.haClient = null;
    this.entities = config.entities || [];
  }

  getHTML() {
    return `
      <div class="widget-header">
        <span class="widget-icon">🏠</span>
        <span class="widget-title">Home</span>
      </div>
      <div class="widget-body" id="${this.id}-body">
        <div class="ha-loading">Loading...</div>
      </div>
    `;
  }

  onInit() {
    if (window.app && window.app.haClient) {
      this.haClient = window.app.haClient;
      this.haClient.onStateChange(() => {
        this.update();
      });
    }
    
    this.update();
    this.startAutoUpdate(30000);
  }

  update() {
    if (!this.haClient || !this.haClient.isConnected) {
      this.showLoading();
      return;
    }

    const body = this.element.querySelector(`#${this.id}-body`);
    if (!body) return;

    if (this.entities.length === 0) {
      body.innerHTML = '<div class="ha-empty">No entities configured</div>';
      return;
    }

    const entitiesHTML = this.entities.map(entity => {
      const state = this.haClient.getState(entity.entityId);
      if (!state) return '';

      const value = this.formatValue(state);
      const icon = this.getIcon(state);

      return `
        <div class="entity-card">
          <div class="entity-icon">${icon}</div>
          <div class="entity-name">${entity.name || entity.entityId}</div>
          <div class="entity-value">${value}</div>
        </div>
      `;
    }).join('');

    body.innerHTML = `<div class="entity-grid">${entitiesHTML}</div>`;
  }

  formatValue(state) {
    const attrs = state.attributes;
    const unit = attrs.unit_of_measurement || '';
    
    if (state.state === 'on' || state.state === 'off') {
      return state.state.toUpperCase();
    }
    
    return `${state.state}${unit ? ' ' + unit : ''}`;
  }

  getIcon(state) {
    const attrs = state.attributes;
    return attrs.icon || '📊';
  }

  showLoading() {
    const body = this.element.querySelector(`#${this.id}-body`);
    if (body) {
      body.innerHTML = '<div class="ha-loading">Connecting to Home Assistant...</div>';
    }
  }
}

// Register widget
if (typeof window !== 'undefined' && window.widgetRegistry) {
  window.widgetRegistry.register('homeassistant', HomeAssistantWidget);
}


