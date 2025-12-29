/**
 * Dad Joke Widget
 */

class DadJokeWidget extends BaseWidget {
  constructor(config = {}) {
    super(config);
    this.type = 'dadjoke';
    this.currentJoke = '';
    this.apiUrl = 'https://icanhazdadjoke.com/';
  }

  getHTML() {
    return `
      <div class="widget-body" id="${this.id}-body">
        <div class="joke-loading">Loading joke...</div>
      </div>
    `;
  }

  onInit() {
    this.fetchJoke();
    // Update every 5 minutes
    this.startAutoUpdate(300000);
  }

  async fetchJoke() {
    try {
      const response = await fetch(this.apiUrl, {
        headers: {
          'Accept': 'application/json',
          'User-Agent': 'Family Calendar Dashboard'
        }
      });
      
      if (!response.ok) throw new Error('Failed to fetch joke');
      
      const data = await response.json();
      this.currentJoke = data.joke;
      this.render();
    } catch (e) {
      console.error('Dad joke error:', e);
      this.showError('Failed to load joke');
    }
  }

  render() {
    const body = this.element.querySelector(`#${this.id}-body`);
    if (body && this.currentJoke) {
      body.innerHTML = `<div class="joke-content">${Helpers.escapeHtml(this.currentJoke)}</div>`;
    }
  }

  async update() {
    await this.fetchJoke();
  }

  showError(message) {
    const body = this.element.querySelector(`#${this.id}-body`);
    if (body) {
      body.innerHTML = `<div class="joke-error">${message}</div>`;
    }
  }
}

// Register widget
if (typeof window !== 'undefined' && window.widgetRegistry) {
  window.widgetRegistry.register('dadjoke', DadJokeWidget);
}


