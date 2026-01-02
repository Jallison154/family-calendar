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
      const iconHtml = this.getIconHtml(state);
      const isActive = this.isEntityActive(state);
      const stateClass = this.getEntityStateClass(state);

      return `
        <div class="entity-card ${stateClass} ${isActive ? 'entity-active' : ''}" data-entity-id="${entity.entityId}">
          <div class="entity-icon">${iconHtml}</div>
          <div class="entity-name">${entity.name || entity.entityId}</div>
          <div class="entity-value">${value}</div>
        </div>
      `;
    }).join('');

    body.innerHTML = `<div class="entity-grid">${entitiesHTML}</div>`;
  }
  
  isEntityActive(state) {
    if (!state) return false;
    const activeStates = ['on', 'playing', 'home', 'open', 'heat', 'cool', 'active'];
    return activeStates.includes(state.state?.toLowerCase());
  }
  
  getEntityStateClass(state) {
    if (!state) return '';
    const stateStr = state.state?.toLowerCase() || '';
    if (stateStr === 'unavailable' || stateStr === 'unknown') return 'entity-unavailable';
    if (stateStr === 'on' || stateStr === 'playing') return 'entity-on';
    if (stateStr === 'off' || stateStr === 'idle') return 'entity-off';
    return 'entity-other';
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

  getIconHtml(state) {
    const attrs = state.attributes || {};
    
    // First, try to use entity_picture (actual icon from Home Assistant)
    const entityPicture = attrs.entity_picture;
    if (entityPicture) {
      let iconUrl = entityPicture;
      
      // If relative URL, construct full URL using Home Assistant base URL
      if (!entityPicture.startsWith('http://') && !entityPicture.startsWith('https://')) {
        if (this.haClient?.config?.url) {
          const baseUrl = this.haClient.config.url.replace(/\/$/, '');
          iconUrl = baseUrl + entityPicture;
        }
      }
      
      // Return image tag for the icon (don't escape URL, but escape alt text)
      const entityName = state.entity_id || 'entity';
      // Escape quotes in URL for HTML attribute safety
      const safeUrl = String(iconUrl).replace(/"/g, '&quot;');
      return `<img src="${safeUrl}" alt="${Helpers.escapeHtml(entityName)}" class="ha-entity-icon-img" loading="lazy">`;
    }
    
    // Fallback to icon attribute (MDI icon name like "mdi:lightbulb")
    // For now, we'll use emoji fallback, but could potentially use HA icon API
    const iconName = attrs.icon;
    if (iconName) {
      // Try to render MDI icons using Home Assistant's icon API
      if (iconName.startsWith('mdi:') && this.haClient?.config?.url) {
        const baseUrl = this.haClient.config.url.replace(/\/$/, '');
        // Home Assistant provides icons via /static/icons/{domain}/{icon}.png
        // But entity_picture is preferred and more reliable
        // For now, fall through to emoji fallback
      }
    }
    
    // Final fallback to emoji
    return '📊';
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


