/**
 * Settings Manager
 * Handles configuration persistence and settings panel UI
 */

class SettingsManager {
  constructor() {
    this.storageKey = 'familyDashboardSettings';
    this.panelEl = null;
    this.isOpen = false;
    this.onSave = null;
  }

  /**
   * Initialize settings manager
   */
  init(onSaveCallback) {
    this.onSave = onSaveCallback;
    this.panelEl = document.getElementById('settings-panel');
    
    // Setup keyboard shortcut (S key to toggle settings)
    document.addEventListener('keydown', (e) => {
      if (e.key === 's' || e.key === 'S') {
        if (!e.ctrlKey && !e.metaKey) {
          this.toggle();
        }
      }
      if (e.key === 'Escape' && this.isOpen) {
        this.close();
      }
    });

    // Setup close button
    const closeBtn = document.getElementById('settings-close');
    if (closeBtn) {
      closeBtn.addEventListener('click', () => this.close());
    }

    // Setup save button
    const saveBtn = document.getElementById('settings-save');
    if (saveBtn) {
      saveBtn.addEventListener('click', () => this.save());
    }

    // Setup reset button
    const resetBtn = document.getElementById('settings-reset');
    if (resetBtn) {
      resetBtn.addEventListener('click', () => this.reset());
    }

    // Populate form with current settings
    this.populateForm();
  }

  /**
   * Load settings from localStorage, merged with defaults
   */
  load() {
    const defaults = window.CONFIG || {};
    const stored = localStorage.getItem(this.storageKey);
    
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        return this.deepMerge(defaults, parsed);
      } catch (e) {
        console.error('SettingsManager: Error parsing stored settings', e);
      }
    }
    
    return defaults;
  }

  /**
   * Save settings to localStorage
   */
  save() {
    const settings = this.gatherFormData();
    
    localStorage.setItem(this.storageKey, JSON.stringify(settings));
    
    // Update global CONFIG
    window.CONFIG = this.deepMerge(window.CONFIG, settings);
    
    // Notify callback
    if (this.onSave) {
      this.onSave(settings);
    }
    
    this.close();
    
    // Reload page to apply changes
    location.reload();
  }

  /**
   * Reset to defaults
   */
  reset() {
    if (confirm('Reset all settings to defaults? This will reload the page.')) {
      localStorage.removeItem(this.storageKey);
      location.reload();
    }
  }

  /**
   * Populate form with current settings
   */
  populateForm() {
    const config = this.load();
    
    // Unsplash
    this.setFormValue('unsplash-key', config.unsplash?.accessKey);
    this.setFormValue('unsplash-query', config.unsplash?.searchQuery);
    this.setFormValue('unsplash-interval', config.unsplash?.interval / 1000);
    
    // Calendar accounts
    this.populateCalendarAccounts(config.googleCalendar?.accounts || []);
    
    // Home Assistant
    this.setFormValue('ha-url', config.homeAssistant?.url);
    this.setFormValue('ha-token', config.homeAssistant?.accessToken);
    this.setFormValue('ha-entities', this.entitiesToText(config.homeAssistant?.entities || []));
    
    // Weather
    this.setFormValue('weather-use-ha', config.weather?.useHomeAssistant);
    this.setFormValue('weather-entity', config.weather?.weatherEntity);
    this.setFormValue('owm-key', config.weather?.openWeatherMap?.apiKey);
    this.setFormValue('owm-lat', config.weather?.openWeatherMap?.lat);
    this.setFormValue('owm-lon', config.weather?.openWeatherMap?.lon);
    this.setFormValue('owm-units', config.weather?.openWeatherMap?.units);
    
    // Countdowns
    this.setFormValue('countdowns', this.countdownsToText(config.countdowns || []));
    
    // Display
    this.setFormValue('display-24hour', config.display?.use24Hour);
    this.setFormValue('greeting-name', config.display?.greetingName);
  }

  /**
   * Populate calendar accounts section
   */
  populateCalendarAccounts(accounts) {
    const container = document.getElementById('calendar-accounts');
    if (!container) return;
    
    container.innerHTML = accounts.map((account, i) => `
      <div class="settings-account" data-index="${i}">
        <div class="settings-row">
          <label>Account Name</label>
          <input type="text" class="account-name" value="${this.escapeHtml(account.name || '')}" placeholder="Personal">
        </div>
        <div class="settings-row">
          <label>API Key</label>
          <input type="password" class="account-key" value="${account.apiKey || ''}" placeholder="Google Calendar API Key">
        </div>
        <div class="settings-row">
          <label>Calendars (one per line: id, color, name)</label>
          <textarea class="account-calendars" rows="3" placeholder="primary, #4285f4, My Calendar">${this.calendarsToText(account.calendars || [])}</textarea>
        </div>
      </div>
    `).join('') || '<p class="settings-hint">No accounts configured</p>';
    
    // Add "Add Account" button
    container.innerHTML += `
      <button type="button" class="settings-btn settings-btn-secondary" id="add-calendar-account">+ Add Account</button>
    `;
    
    document.getElementById('add-calendar-account')?.addEventListener('click', () => {
      this.addCalendarAccount();
    });
  }

  /**
   * Add a new calendar account
   */
  addCalendarAccount() {
    const container = document.getElementById('calendar-accounts');
    const btn = document.getElementById('add-calendar-account');
    
    const newAccount = document.createElement('div');
    newAccount.className = 'settings-account';
    newAccount.innerHTML = `
      <div class="settings-row">
        <label>Account Name</label>
        <input type="text" class="account-name" value="" placeholder="Work">
      </div>
      <div class="settings-row">
        <label>API Key</label>
        <input type="password" class="account-key" value="" placeholder="Google Calendar API Key">
      </div>
      <div class="settings-row">
        <label>Calendars (one per line: id, color, name)</label>
        <textarea class="account-calendars" rows="3" placeholder="primary, #ea4335, Work Calendar"></textarea>
      </div>
    `;
    
    container.insertBefore(newAccount, btn);
  }

  /**
   * Gather form data into settings object
   */
  gatherFormData() {
    return {
      unsplash: {
        accessKey: this.getFormValue('unsplash-key'),
        searchQuery: this.getFormValue('unsplash-query'),
        interval: (parseInt(this.getFormValue('unsplash-interval')) || 30) * 1000,
        transitionDuration: 2000,
        preloadCount: 5
      },
      googleCalendar: {
        accounts: this.gatherCalendarAccounts(),
        weeksAhead: 4,
        refreshInterval: 300000
      },
      homeAssistant: {
        url: this.getFormValue('ha-url'),
        accessToken: this.getFormValue('ha-token'),
        entities: this.textToEntities(this.getFormValue('ha-entities')),
        refreshInterval: 30000
      },
      weather: {
        useHomeAssistant: this.getFormValue('weather-use-ha') === true || this.getFormValue('weather-use-ha') === 'true',
        weatherEntity: this.getFormValue('weather-entity'),
        openWeatherMap: {
          apiKey: this.getFormValue('owm-key'),
          lat: parseFloat(this.getFormValue('owm-lat')) || 0,
          lon: parseFloat(this.getFormValue('owm-lon')) || 0,
          units: this.getFormValue('owm-units') || 'imperial'
        }
      },
      countdowns: this.textToCountdowns(this.getFormValue('countdowns')),
      display: {
        use24Hour: this.getFormValue('display-24hour') === true || this.getFormValue('display-24hour') === 'true',
        greetingName: this.getFormValue('greeting-name'),
        showSeconds: false,
        hideCursorAfter: 5000,
        widgets: {
          clock: true,
          greeting: true,
          weather: true,
          calendar: true,
          homeAssistant: true,
          countdown: true,
          todaySummary: true
        }
      }
    };
  }

  /**
   * Gather calendar accounts from form
   */
  gatherCalendarAccounts() {
    const accounts = [];
    const accountEls = document.querySelectorAll('.settings-account');
    
    accountEls.forEach(el => {
      const name = el.querySelector('.account-name')?.value || '';
      const apiKey = el.querySelector('.account-key')?.value || '';
      const calendarsText = el.querySelector('.account-calendars')?.value || '';
      
      if (apiKey) {
        accounts.push({
          name,
          apiKey,
          calendars: this.textToCalendars(calendarsText)
        });
      }
    });
    
    return accounts;
  }

  /**
   * Convert calendars array to text
   */
  calendarsToText(calendars) {
    return calendars.map(c => `${c.id}, ${c.color}, ${c.name}`).join('\n');
  }

  /**
   * Convert text to calendars array
   */
  textToCalendars(text) {
    return text.split('\n')
      .map(line => line.trim())
      .filter(line => line)
      .map(line => {
        const parts = line.split(',').map(p => p.trim());
        return {
          id: parts[0] || 'primary',
          color: parts[1] || '#4285f4',
          name: parts[2] || 'Calendar'
        };
      });
  }

  /**
   * Convert entities array to text
   */
  entitiesToText(entities) {
    return entities.map(e => `${e.entityId}, ${e.name}, ${e.icon || 'default'}`).join('\n');
  }

  /**
   * Convert text to entities array
   */
  textToEntities(text) {
    return text.split('\n')
      .map(line => line.trim())
      .filter(line => line)
      .map(line => {
        const parts = line.split(',').map(p => p.trim());
        return {
          entityId: parts[0],
          name: parts[1] || parts[0],
          icon: parts[2] || 'default'
        };
      });
  }

  /**
   * Convert countdowns array to text
   */
  countdownsToText(countdowns) {
    return countdowns.map(c => `${c.name}, ${c.date}`).join('\n');
  }

  /**
   * Convert text to countdowns array
   */
  textToCountdowns(text) {
    return text.split('\n')
      .map(line => line.trim())
      .filter(line => line)
      .map(line => {
        const parts = line.split(',').map(p => p.trim());
        return {
          name: parts[0],
          date: parts[1]
        };
      });
  }

  /**
   * Toggle settings panel
   */
  toggle() {
    if (this.isOpen) {
      this.close();
    } else {
      this.open();
    }
  }

  /**
   * Open settings panel
   */
  open() {
    if (this.panelEl) {
      this.panelEl.classList.add('open');
      this.isOpen = true;
      this.populateForm();
    }
  }

  /**
   * Close settings panel
   */
  close() {
    if (this.panelEl) {
      this.panelEl.classList.remove('open');
      this.isOpen = false;
    }
  }

  /**
   * Helper to set form value
   */
  setFormValue(id, value) {
    const el = document.getElementById(id);
    if (!el) return;
    
    if (el.type === 'checkbox') {
      el.checked = value === true || value === 'true';
    } else {
      el.value = value || '';
    }
  }

  /**
   * Helper to get form value
   */
  getFormValue(id) {
    const el = document.getElementById(id);
    if (!el) return '';
    
    if (el.type === 'checkbox') {
      return el.checked;
    }
    return el.value;
  }

  /**
   * Deep merge objects
   */
  deepMerge(target, source) {
    const result = { ...target };
    
    for (const key in source) {
      if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])) {
        result[key] = this.deepMerge(result[key] || {}, source[key]);
      } else {
        result[key] = source[key];
      }
    }
    
    return result;
  }

  /**
   * Escape HTML
   */
  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }
}

window.SettingsManager = SettingsManager;



