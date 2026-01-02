/**
 * Spotify Now Playing Widget (Home Assistant)
 * Only displays when music is playing
 */

class SpotifyWidget extends BaseWidget {
  constructor(config = {}) {
    super(config);
    this.type = 'spotify';
    this.mediaPlayerEntity = config.mediaPlayerEntity || window.CONFIG?.spotify?.mediaPlayerEntity || 'media_player.spotify';
    this.haClient = null;
    this.currentTrack = null;
    this.isPlaying = false;
  }

  createElement() {
    super.createElement();
    // Hide widget initially until music is playing
    if (this.element) {
      this.element.style.display = 'none';
    }
  }

  getHTML() {
    return `
      <div class="widget-body" id="${this.id}-body">
        <div class="spotify-loading">Loading...</div>
      </div>
    `;
  }

  onInit() {
    // Get Home Assistant client from app
    if (window.app && window.app.haClient) {
      this.haClient = window.app.haClient;
      this.haClient.onStateChange((entityId, state) => {
        if (entityId === this.mediaPlayerEntity) {
          this.update();
        }
      });
    }
    
    this.update();
    // Update every 5 seconds to keep in sync
    this.startAutoUpdate(5000);
  }

  update() {
    if (!this.haClient || !this.haClient.isConnected) {
      this.hide();
      return;
    }

    const state = this.haClient.getState(this.mediaPlayerEntity);
    if (!state) {
      this.hide();
      return;
    }

    const attrs = state.attributes || {};
    const playerState = state.state;

    // Only show when playing or paused (not idle/off)
    this.isPlaying = playerState === 'playing';
    const isActive = playerState === 'playing' || playerState === 'paused';

    if (!isActive) {
      this.hide();
      return;
    }

    // Extract track information
    const title = attrs.media_title || attrs.media_track || 'Unknown Track';
    const artist = attrs.media_artist || attrs.artist || 'Unknown Artist';
    const album = attrs.media_album_name || attrs.album || '';
    const albumArt = attrs.entity_picture || attrs.media_image_url || attrs.media_image_uri || null;

    // Build full album art URL if needed
    let albumArtUrl = null;
    if (albumArt) {
      if (albumArt.startsWith('http')) {
        albumArtUrl = albumArt;
      } else if (this.haClient.config?.url) {
        const baseUrl = this.haClient.config.url.replace(/\/$/, '');
        albumArtUrl = baseUrl + albumArt;
      }
    }

    const trackInfo = {
      title,
      artist,
      album,
      albumArtUrl,
      isPlaying: this.isPlaying,
      state: playerState
    };

    this.currentTrack = trackInfo;
    this.render(trackInfo);
    this.show();
  }

  render(track) {
    const body = this.element.querySelector(`#${this.id}-body`);
    if (!body) return;
    
    // Don't render if no track data provided
    if (!track) {
      return;
    }

    body.innerHTML = `
      <div class="spotify-now-playing">
        ${track.albumArtUrl ? `
          <div class="spotify-artwork">
            <img src="${track.albumArtUrl}" alt="${track.album}">
            ${track.isPlaying ? '<div class="spotify-playback-indicator">▶</div>' : '<div class="spotify-playback-indicator paused">⏸</div>'}
          </div>
        ` : `
          <div class="spotify-artwork spotify-artwork-placeholder">
            <span class="spotify-icon">🎵</span>
            ${track.isPlaying ? '<div class="spotify-playback-indicator">▶</div>' : '<div class="spotify-playback-indicator paused">⏸</div>'}
          </div>
        `}
        <div class="spotify-info">
          <div class="spotify-title">${Helpers.escapeHtml(track.title)}</div>
          <div class="spotify-artist">${Helpers.escapeHtml(track.artist)}</div>
          ${track.album ? `<div class="spotify-album">${Helpers.escapeHtml(track.album)}</div>` : ''}
        </div>
      </div>
    `;
  }

  show() {
    if (this.element) {
      this.element.style.display = 'flex';
      this.element.style.flexDirection = 'column';
    }
  }

  hide() {
    if (this.element) {
      this.element.style.display = 'none';
    }
  }

  showLoading() {
    const body = this.element.querySelector(`#${this.id}-body`);
    if (body) {
      body.innerHTML = '<div class="spotify-loading">Loading...</div>';
    }
  }
}

// Register widget
if (typeof window !== 'undefined' && window.widgetRegistry) {
  window.widgetRegistry.register('spotify', SpotifyWidget);
}

