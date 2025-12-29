/**
 * Home Assistant Widget
 */

class HomeAssistantWidget extends BaseWidget {
  constructor(config = {}) {
    super(config);
    this.type = 'homeassistant';
    this.haClient = null;
    // Get entities from global CONFIG, not widget config
    this.entities = (window.CONFIG?.homeAssistant?.entities || []);
    this.cacheKey = 'homeAssistantWidgetCache';
    this.cacheExpiryKey = 'homeAssistantWidgetCacheExpiry';
    this.cacheExpiryMs = 600000; // 10 minutes
    this.cachedStates = new Map();
  }

  getHTML() {
    return `
      <div class="widget-header">
        <span class="widget-icon">🏠</span>
        <span class="widget-title">Home</span>
        <span class="widget-status-indicator" id="${this.id}-status"></span>
      </div>
      <div class="widget-body" id="${this.id}-body">
        <div class="ha-loading">Loading...</div>
      </div>
    `;
  }

  loadCachedData() {
    try {
      const cached = localStorage.getItem(this.cacheKey);
      const expiry = localStorage.getItem(this.cacheExpiryKey);
      
      if (cached && expiry && Date.now() < parseInt(expiry, 10)) {
        const states = JSON.parse(cached);
        this.cachedStates = new Map(Object.entries(states));
        return true;
      }
    } catch (e) {
      console.warn('Failed to load cached Home Assistant data:', e);
    }
    return false;
  }

  saveCachedData() {
    try {
      const statesObj = Object.fromEntries(this.cachedStates);
      localStorage.setItem(this.cacheKey, JSON.stringify(statesObj));
      localStorage.setItem(this.cacheExpiryKey, (Date.now() + this.cacheExpiryMs).toString());
    } catch (e) {
      console.warn('Failed to cache Home Assistant data:', e);
    }
  }

  renderEntities() {
    const body = this.element.querySelector(`#${this.id}-body`);
    if (!body) return;

    if (this.entities.length === 0) {
      body.innerHTML = '<div class="ha-empty">No entities configured</div>';
      return;
    }

    const entitiesHTML = this.entities.map(entity => {
      const state = this.cachedStates.get(entity.entityId) || 
                   (this.haClient?.getState(entity.entityId));
      
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

  onInit() {
    if (window.app && window.app.haClient) {
      this.haClient = window.app.haClient;
      this.haClient.onStateChange((entityId, state) => {
        if (state) {
          this.cachedStates.set(entityId, state);
          this.saveCachedData();
        }
        this.update();
      });
    }
    
    // Load cached data immediately
    if (this.loadCachedData()) {
      this.renderEntities();
      this.setStatus('connected');
    }
    
    this.update();
    this.startAutoUpdate(30000);
  }

  update() {
    if (!this.haClient || !this.haClient.isConnected) {
      // Show cached data if available
      if (this.cachedStates.size > 0) {
        this.renderEntities();
        this.setStatus('connected');
      } else {
        this.showLoading();
      }
      return;
    }

    // Update cached states from client
    this.entities.forEach(entity => {
      const state = this.haClient.getState(entity.entityId);
      if (state) {
        this.cachedStates.set(entity.entityId, state);
      }
    });
    
    this.saveCachedData();
    this.renderEntities();
    this.setStatus('connected');
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


