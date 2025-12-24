/**
 * Home Assistant Integration
 * WebSocket connection to Home Assistant
 */

class HomeAssistantClient {
  constructor(config = {}) {
    this.config = {
      url: config.url || '',
      accessToken: config.accessToken || '',
      refreshInterval: config.refreshInterval || 30000
    };
    this.ws = null;
    this.isConnected = false;
    this.entityStates = new Map();
    this.messageId = 1;
    this.reconnectTimeout = null;
    this.listeners = [];
  }

  /**
   * Initialize connection
   */
  async init() {
    if (!this.config.url || !this.config.accessToken) {
      console.warn('Home Assistant not configured');
      return;
    }

    await this.connect();
  }

  /**
   * Connect to Home Assistant WebSocket
   */
  async connect() {
    try {
      const wsUrl = this.config.url.replace(/^http/, 'ws') + '/api/websocket';
      this.ws = new WebSocket(wsUrl);

      this.ws.onopen = () => {
        console.log('✓ Home Assistant WebSocket connected');
      };

      this.ws.onmessage = (event) => {
        const message = JSON.parse(event.data);
        this.handleMessage(message);
      };

      this.ws.onerror = (error) => {
        console.error('Home Assistant WebSocket error:', error);
      };

      this.ws.onclose = () => {
        console.warn('Home Assistant WebSocket closed');
        this.isConnected = false;
        this.scheduleReconnect();
      };

    } catch (error) {
      console.error('Failed to connect to Home Assistant:', error);
      this.scheduleReconnect();
    }
  }

  /**
   * Handle WebSocket messages
   */
  handleMessage(message) {
    if (message.type === 'auth_required') {
      this.ws.send(JSON.stringify({
        type: 'auth',
        access_token: this.config.accessToken
      }));
    } else if (message.type === 'auth_ok') {
      this.isConnected = true;
      this.subscribeToStates();
      this.subscribeToEvents();
    } else if (message.type === 'event' && message.event) {
      if (message.event.event_type === 'state_changed') {
        const entityId = message.event.data.entity_id;
        const newState = message.event.data.new_state;
        if (newState) {
          this.entityStates.set(entityId, newState);
          this.notifyListeners(entityId, newState);
        }
      }
    } else if (message.type === 'result' && message.result) {
      // Handle state subscription results
      if (Array.isArray(message.result)) {
        message.result.forEach(state => {
          this.entityStates.set(state.entity_id, state);
        });
      }
    }
  }

  /**
   * Subscribe to state changes
   */
  subscribeToStates() {
    const id = this.messageId++;
    this.ws.send(JSON.stringify({
      id: id,
      type: 'subscribe_events',
      event_type: 'state_changed'
    }));

    // Get initial states
    this.fetchStates();
  }

  /**
   * Subscribe to events
   */
  subscribeToEvents() {
    // Already subscribed via subscribeToStates
  }

  /**
   * Fetch current states
   */
  async fetchStates() {
    if (!this.isConnected) return;

    const id = this.messageId++;
    this.ws.send(JSON.stringify({
      id: id,
      type: 'get_states'
    }));
  }

  /**
   * Get entity state
   */
  getState(entityId) {
    return this.entityStates.get(entityId);
  }

  /**
   * Add state change listener
   */
  onStateChange(callback) {
    this.listeners.push(callback);
  }

  /**
   * Notify listeners of state change
   */
  notifyListeners(entityId, state) {
    this.listeners.forEach(callback => {
      try {
        callback(entityId, state);
      } catch (e) {
        console.error('Listener error:', e);
      }
    });
  }

  /**
   * Schedule reconnection
   */
  scheduleReconnect() {
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
    }
    this.reconnectTimeout = setTimeout(() => {
      console.log('Attempting to reconnect to Home Assistant...');
      this.connect();
    }, 5000);
  }

  /**
   * Disconnect
   */
  disconnect() {
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
    }
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    this.isConnected = false;
  }
}

// Export
if (typeof window !== 'undefined') {
  window.HomeAssistantClient = HomeAssistantClient;
}


