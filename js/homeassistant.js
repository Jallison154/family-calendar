/**
 * Home Assistant Integration Module
 * Display-only - shows entity states without controls
 * Connects via WebSocket for real-time updates
 */

class HomeAssistantClient {
  constructor(config) {
    this.config = {
      url: config.url || '',
      accessToken: config.accessToken || '',
      entities: config.entities || [],
      refreshInterval: config.refreshInterval || 30000
    };
    
    this.ws = null;
    this.messageId = 1;
    this.pendingRequests = new Map();
    this.entityStates = new Map();
    this.isConnected = false;
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 5;
    this.reconnectDelay = 5000;
    
    this.entityGridEl = null;
    this.statusEl = null;
  }

  /**
   * Initialize Home Assistant connection
   */
  async init() {
    this.entityGridEl = document.getElementById('entity-grid');
    this.statusEl = document.getElementById('ha-status');
    
    if (!this.entityGridEl) {
      console.error('HomeAssistantClient: Entity grid element not found');
      return;
    }

    // Check for configuration
    if (!this.config.url || this.config.url === 'https://your-home-assistant.example.com' ||
        !this.config.accessToken || this.config.accessToken === 'YOUR_HOME_ASSISTANT_TOKEN') {
      console.warn('HomeAssistantClient: No valid configuration, showing demo entities');
      this.showDemoEntities();
      return;
    }

    // Connect via WebSocket
    this.connect();
  }

  /**
   * Connect to Home Assistant WebSocket API
   */
  connect() {
    this.updateStatus('connecting');
    
    const wsUrl = this.config.url
      .replace(/^http/, 'ws')
      .replace(/\/$/, '') + '/api/websocket';

    try {
      this.ws = new WebSocket(wsUrl);
      
      this.ws.onopen = () => this.onOpen();
      this.ws.onmessage = (event) => this.onMessage(event);
      this.ws.onclose = () => this.onClose();
      this.ws.onerror = (error) => this.onError(error);
    } catch (error) {
      console.error('HomeAssistantClient: WebSocket connection error', error);
      this.updateStatus('error');
      this.showDemoEntities();
    }
  }

  onOpen() {
    console.log('HomeAssistantClient: WebSocket connected');
    this.reconnectAttempts = 0;
  }

  async onMessage(event) {
    const message = JSON.parse(event.data);

    switch (message.type) {
      case 'auth_required':
        this.authenticate();
        break;
        
      case 'auth_ok':
        console.log('HomeAssistantClient: Authenticated');
        this.isConnected = true;
        this.updateStatus('connected');
        this.subscribeToStateChanges();
        this.fetchInitialStates();
        break;
        
      case 'auth_invalid':
        console.error('HomeAssistantClient: Authentication failed');
        this.updateStatus('error');
        this.showDemoEntities();
        break;
        
      case 'result':
        this.handleResult(message);
        break;
        
      case 'event':
        this.handleEvent(message);
        break;
    }
  }

  onClose() {
    console.log('HomeAssistantClient: WebSocket disconnected');
    this.isConnected = false;
    this.updateStatus('disconnected');
    
    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      this.reconnectAttempts++;
      setTimeout(() => this.connect(), this.reconnectDelay);
    } else {
      this.updateStatus('error');
    }
  }

  onError(error) {
    console.error('HomeAssistantClient: WebSocket error', error);
    this.updateStatus('error');
  }

  authenticate() {
    this.ws.send(JSON.stringify({
      type: 'auth',
      access_token: this.config.accessToken
    }));
  }

  sendMessage(message) {
    return new Promise((resolve, reject) => {
      const id = this.messageId++;
      message.id = id;
      
      this.pendingRequests.set(id, { resolve, reject });
      this.ws.send(JSON.stringify(message));
      
      setTimeout(() => {
        if (this.pendingRequests.has(id)) {
          this.pendingRequests.delete(id);
          reject(new Error('Request timeout'));
        }
      }, 10000);
    });
  }

  handleResult(message) {
    const request = this.pendingRequests.get(message.id);
    if (request) {
      this.pendingRequests.delete(message.id);
      if (message.success) {
        request.resolve(message.result);
      } else {
        request.reject(new Error(message.error?.message || 'Unknown error'));
      }
    }
  }

  handleEvent(message) {
    if (message.event?.event_type === 'state_changed') {
      const newState = message.event.data.new_state;
      if (newState) {
        this.entityStates.set(newState.entity_id, newState);
        this.updateEntityDisplay(newState.entity_id);
        
        // Notify state change callbacks
        if (this._stateChangeCallbacks) {
          this._stateChangeCallbacks.forEach(cb => cb(newState.entity_id, newState));
        }
      }
    }
  }

  async subscribeToStateChanges() {
    try {
      await this.sendMessage({
        type: 'subscribe_events',
        event_type: 'state_changed'
      });
    } catch (error) {
      console.error('HomeAssistantClient: Error subscribing to events', error);
    }
  }

  async fetchInitialStates() {
    try {
      const states = await this.sendMessage({ type: 'get_states' });
      states.forEach(state => {
        this.entityStates.set(state.entity_id, state);
      });
      this.renderEntities();
    } catch (error) {
      console.error('HomeAssistantClient: Error fetching states', error);
    }
  }

  /**
   * Render all entity cards (display only)
   */
  renderEntities() {
    if (!this.entityGridEl) return;

    this.entityGridEl.innerHTML = this.config.entities.map(entity => {
      const state = this.entityStates.get(entity.entityId);
      return this.createEntityCard(entity, state);
    }).join('');
  }

  /**
   * Create HTML for a display-only entity card
   */
  createEntityCard(entity, state) {
    const entityId = entity.entityId;
    const domain = entityId.split('.')[0];
    const isActive = state && ['on', 'playing', 'home', 'open', 'heat', 'cool'].includes(state.state);
    const isUnavailable = !state || state.state === 'unavailable';
    
    const stateValue = this.formatStateValue(state, entity);
    const icon = this.getEntityIcon(entity, domain, isActive, state);
    const stateClass = this.getStateClass(state, domain);

    return `
      <div class="entity-card ${stateClass} ${isUnavailable ? 'unavailable' : ''}"
           data-entity-id="${entityId}"
           aria-label="${entity.name}: ${stateValue}">
        <div class="entity-icon-wrap">
          <span class="entity-icon">${icon}</span>
        </div>
        <div class="entity-info">
          <span class="entity-name">${entity.name}</span>
          <span class="entity-state">${stateValue}</span>
        </div>
      </div>
    `;
  }

  /**
   * Update a single entity display with fade effect
   */
  updateEntityDisplay(entityId) {
    const entity = this.config.entities.find(e => e.entityId === entityId);
    if (!entity) return;

    const card = this.entityGridEl.querySelector(`[data-entity-id="${entityId}"]`);
    if (!card) return;

    const state = this.entityStates.get(entityId);
    const domain = entityId.split('.')[0];
    const isActive = state && ['on', 'playing', 'home', 'open', 'heat', 'cool'].includes(state.state);
    const isUnavailable = !state || state.state === 'unavailable';
    
    // Update state text with fade
    const stateEl = card.querySelector('.entity-state');
    if (stateEl) {
      const newValue = this.formatStateValue(state, entity);
      if (stateEl.textContent !== newValue) {
        stateEl.style.opacity = '0';
        setTimeout(() => {
          stateEl.textContent = newValue;
          stateEl.style.opacity = '1';
        }, 250);
      }
    }

    // Update classes
    card.className = `entity-card ${this.getStateClass(state, domain)} ${isUnavailable ? 'unavailable' : ''}`;

    // Update icon
    const iconEl = card.querySelector('.entity-icon');
    if (iconEl) {
      iconEl.textContent = this.getEntityIcon(entity, domain, isActive, state);
    }
  }

  /**
   * Get state class for styling
   */
  getStateClass(state, domain) {
    if (!state) return '';
    
    const s = state.state.toLowerCase();
    
    if (['on', 'playing', 'home', 'open'].includes(s)) return 'state-on';
    if (['off', 'paused', 'away', 'closed'].includes(s)) return 'state-off';
    if (['heat', 'heating'].includes(s)) return 'state-heat';
    if (['cool', 'cooling'].includes(s)) return 'state-cool';
    if (s === 'unavailable') return 'state-unavailable';
    
    return '';
  }

  /**
   * Format state value for display
   */
  formatStateValue(state, entity) {
    if (!state) return 'Unknown';
    if (state.state === 'unavailable') return 'Unavailable';
    
    const domain = entity.entityId.split('.')[0];
    
    // Sensors - show value with unit
    if (domain === 'sensor') {
      const value = state.state;
      const unit = entity.unit || state.attributes?.unit_of_measurement || '';
      return `${value}${unit}`;
    }
    
    // Binary sensors
    if (domain === 'binary_sensor') {
      return state.state === 'on' ? 'Detected' : 'Clear';
    }
    
    // Climate - show current and target temp
    if (domain === 'climate') {
      const current = state.attributes?.current_temperature;
      const target = state.attributes?.temperature;
      const unit = '°';
      
      if (current && target) {
        return `${current}${unit} → ${target}${unit}`;
      } else if (current) {
        return `${current}${unit}`;
      }
      return state.state;
    }
    
    // Weather
    if (domain === 'weather') {
      const temp = state.attributes?.temperature;
      const unit = state.attributes?.temperature_unit || '°';
      return temp ? `${temp}${unit} ${state.state}` : state.state;
    }
    
    // Lights with brightness
    if (domain === 'light' && state.state === 'on' && state.attributes?.brightness) {
      const brightness = Math.round((state.attributes.brightness / 255) * 100);
      return `On (${brightness}%)`;
    }
    
    // Default - capitalize state
    return state.state.charAt(0).toUpperCase() + state.state.slice(1);
  }

  /**
   * Get icon for entity
   */
  getEntityIcon(entity, domain, isActive, state) {
    const iconName = entity.icon;
    
    const icons = {
      lightbulb: isActive ? '💡' : '🔅',
      fan: isActive ? '🌀' : '💨',
      thermometer: '🌡️',
      droplet: '💧',
      humidity: '💧',
      lock: isActive ? '🔓' : '🔒',
      door: isActive ? '🚪' : '🚪',
      window: '🪟',
      tv: isActive ? '📺' : '📺',
      speaker: isActive ? '🔊' : '🔇',
      plug: isActive ? '🔌' : '⭕',
      motion: isActive ? '🚶' : '👤',
      battery: this.getBatteryIcon(state),
      weather: this.getWeatherIcon(state),
      sun: isActive ? '☀️' : '🌙',
      power: '⚡',
      energy: '⚡',
      default: '📊'
    };

    return icons[iconName] || icons.default;
  }

  /**
   * Get battery icon based on level
   */
  getBatteryIcon(state) {
    if (!state) return '🔋';
    const level = parseInt(state.state);
    if (isNaN(level)) return '🔋';
    if (level > 80) return '🔋';
    if (level > 50) return '🔋';
    if (level > 20) return '🪫';
    return '🪫';
  }

  /**
   * Get weather icon based on condition
   */
  getWeatherIcon(state) {
    if (!state) return '🌡️';
    const condition = state.state.toLowerCase();
    
    const icons = {
      'sunny': '☀️', 'clear': '☀️', 'clear-night': '🌙',
      'cloudy': '☁️', 'partlycloudy': '⛅',
      'rainy': '🌧️', 'pouring': '🌧️',
      'snowy': '❄️', 'fog': '🌫️',
      'windy': '💨', 'lightning': '⛈️'
    };
    
    return icons[condition] || '🌡️';
  }

  /**
   * Update connection status indicator
   */
  updateStatus(status) {
    if (!this.statusEl) return;
    
    this.statusEl.classList.remove('connected', 'error');
    
    switch (status) {
      case 'connecting':
        break;
      case 'connected':
        this.statusEl.classList.add('connected');
        break;
      case 'disconnected':
        break;
      case 'error':
        this.statusEl.classList.add('error');
        break;
    }
  }

  /**
   * Show empty state when not configured
   */
  showDemoEntities() {
    this.updateStatus('disconnected');
    
    // Show empty state - no demo data
    const grid = document.getElementById('entity-grid');
    if (grid) {
      grid.innerHTML = `
        <div style="grid-column: 1/-1; text-align:center; padding:1rem; color:var(--color-text-muted); font-size:0.875rem;">
          Configure Home Assistant in Control Panel
        </div>
      `;
    }
  }

  
  /**
   * Call a Home Assistant service
   */
  async callService(domain, service, data = {}) {
    if (!this.isConnected) return null;
    
    try {
      const result = await this.sendMessage({
        type: 'call_service',
        domain: domain,
        service: service,
        service_data: data,
        return_response: true
      });
      return result;
    } catch (error) {
      console.error(`HomeAssistantClient: Error calling ${domain}.${service}`, error);
      return null;
    }
  }

  /**
   * Get weather forecast using the weather.get_forecasts service (HA 2024+)
   */
  async getWeatherForecast(entityId, type = 'daily') {
    // Try REST API first (more reliable for return_response)
    try {
      console.log('HA: Trying REST API for forecast', entityId, 'type:', type);
      const baseUrl = this.config.url.replace(/\/$/, '');
      
      const response = await fetch(baseUrl + '/api/services/weather/get_forecasts', {
        method: 'POST',
        headers: {
          'Authorization': 'Bearer ' + this.config.accessToken,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          entity_id: entityId,
          type: type
        })
      });
      
      if (response.ok) {
        const data = await response.json();
        console.log('HA: REST API response:', JSON.stringify(data).substring(0, 500));
        
        // Response format: { "weather.entity_id": { "forecast": [...] } }
        if (data && data[entityId] && data[entityId].forecast) {
          console.log('HA: Got forecast from REST API:', data[entityId].forecast.length, 'entries');
          return data[entityId].forecast;
        }
      } else {
        console.log('HA: REST API failed:', response.status);
      }
    } catch (e) {
      console.warn('HA: REST API error:', e.message);
    }
    
    // Fallback to WebSocket
    if (!this.isConnected) {
      console.log('HA: WebSocket not connected');
      return null;
    }
    
    try {
      console.log('HA: Trying WebSocket for forecast');
      const result = await this.sendMessage({
        type: 'call_service',
        domain: 'weather',
        service: 'get_forecasts',
        target: { entity_id: entityId },
        service_data: { type: type },
        return_response: true
      });
      
      console.log('HA: WebSocket result:', JSON.stringify(result).substring(0, 500));
      
      if (result) {
        if (result.response && result.response[entityId] && result.response[entityId].forecast) {
          return result.response[entityId].forecast;
        }
        if (result[entityId] && result[entityId].forecast) {
          return result[entityId].forecast;
        }
      }
      return [];
    } catch (error) {
      console.warn('HA: WebSocket error:', error.message);
      return null;
    }
  }

  /**
   * Get an entity state
   */
  getState(entityId) {
    return this.entityStates.get(entityId);
  }

  /**
   * Register a callback for state changes
   */
  onStateChange(callback) {
    if (!this._stateChangeCallbacks) {
      this._stateChangeCallbacks = [];
    }
    this._stateChangeCallbacks.push(callback);
  }

  disconnect() {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    this.isConnected = false;
  }
}

window.HomeAssistantClient = HomeAssistantClient;
