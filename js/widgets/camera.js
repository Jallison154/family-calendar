/**
 * Camera Feed Widget (RTSP/HLS/WebRTC/MJPEG streams)
 * Rebuilt for reliability and simplicity
 */

class CameraWidget extends BaseWidget {
  constructor(config = {}) {
    super(config);
    this.type = 'camera';
    this.cameras = [];
    this.showTitles = true;
    this.updateInterval = null;
    this.lastConfigHash = null;
  }

  getHTML() {
    return `
      <div class="widget-body" id="${this.id}-body">
        <div class="camera-feeds-container" id="${this.id}-container">
          <div class="camera-loading">Loading cameras...</div>
        </div>
      </div>
    `;
  }

  onInit() {
    this.loadCameras();
    this.render();
    
    // Check for config changes periodically (every 30 seconds)
    this.startAutoUpdate(30000);
  }

  loadCameras() {
    // Always read from current CONFIG
    const config = window.CONFIG || {};
    const camerasConfig = config.cameras || {};
    
    this.cameras = camerasConfig.feeds || [];
    this.showTitles = camerasConfig.showTitles !== false;
    
    // Create config hash to detect changes
    this.lastConfigHash = JSON.stringify(this.cameras);
  }

  render() {
    const container = this.element.querySelector(`#${this.id}-container`);
    if (!container) return;

    // Reload cameras from config
    this.loadCameras();

    // Check if config changed
    const currentHash = JSON.stringify(this.cameras);
    const configChanged = currentHash !== this.lastConfigHash;
    this.lastConfigHash = currentHash;

    if (this.cameras.length === 0) {
      container.innerHTML = '<div class="camera-empty">No camera feeds configured</div>';
      return;
    }

    // Only re-render if config changed or container is empty
    if (!configChanged && container.children.length > 0 && !container.querySelector('.camera-loading')) {
      return; // No need to re-render
    }

    let html = '<div class="camera-feeds-grid">';
    
    this.cameras.forEach((camera, index) => {
      if (!camera || !camera.url || !camera.url.trim()) {
        return;
      }
      
      const cameraId = `camera-${this.id}-${index}`;
      const cameraName = this.escapeHtml(camera.name || `Camera ${index + 1}`);
      const streamUrl = this.buildStreamUrl(camera);
      
      html += `
        <div class="camera-feed-wrapper">
          ${this.showTitles ? `<div class="camera-feed-name">${cameraName}</div>` : ''}
          <div class="camera-feed-container">
            ${this.getCameraHTML(camera, cameraId, streamUrl)}
            <div class="camera-feed-error" id="${cameraId}-error" style="display: none;">
              <div class="camera-error-icon">⚠️</div>
              <div class="camera-error-text">Unable to load feed</div>
            </div>
          </div>
        </div>
      `;
    });
    
    html += '</div>';
    container.innerHTML = html;

    // Setup event handlers after rendering
    this.setupCameraHandlers();
  }

  getCameraHTML(camera, cameraId, streamUrl) {
    const url = camera.url.toLowerCase();
    
    // Scrypted HLS rebroadcast
    if (url.includes('/rebroadcast/hls/') || (url.includes('@scrypted') && url.includes('.m3u8'))) {
      return `
        <video
          id="${cameraId}"
          class="camera-feed-video"
          autoplay
          muted
          playsinline
          preload="auto"
          loop
          controls
        >
          <source src="${streamUrl}" type="application/vnd.apple.mpegurl">
          Your browser does not support HLS video.
        </video>
      `;
    }
    
    // Scrypted WebRTC/public page (iframe)
    if (url.includes('@scrypted') || url.includes('/webrtc/')) {
      return `
        <iframe
          id="${cameraId}"
          class="camera-feed-iframe"
          src="${streamUrl}"
          allow="autoplay; fullscreen"
          allowfullscreen
          frameborder="0"
        ></iframe>
      `;
    }
    
    // HLS streams
    if (url.includes('.m3u8')) {
      return `
        <video
          id="${cameraId}"
          class="camera-feed-video"
          autoplay
          muted
          playsinline
          preload="auto"
          controls
        >
          <source src="${streamUrl}" type="application/vnd.apple.mpegurl">
          Your browser does not support HLS video.
        </video>
      `;
    }
    
    // Snapshot endpoints
    if (url.includes('/snapshot')) {
      return `
        <img
          id="${cameraId}"
          class="camera-feed-image"
          src="${streamUrl}"
          alt="${this.escapeHtml(camera.name || 'Camera')}"
        />
      `;
    }
    
    // MJPEG streams (most common for IP cameras)
    if (url.includes('/mjpg/') || url.includes('/mjpeg/') || url.includes('video.cgi') || 
        url.includes('.mjpg') || url.includes('.mjpeg')) {
      return `
        <img
          id="${cameraId}"
          class="camera-feed-image"
          src="${streamUrl}"
          alt="${this.escapeHtml(camera.name || 'Camera')}"
        />
      `;
    }
    
    // Default: try as image (for MJPEG or other image streams)
    return `
      <img
        id="${cameraId}"
        class="camera-feed-image"
        src="${streamUrl}"
        alt="${this.escapeHtml(camera.name || 'Camera')}"
      />
    `;
  }

  buildStreamUrl(camera) {
    const originalUrl = camera.url || '';
    const username = camera.username || '';
    const password = camera.password || '';
    
    // Scrypted URLs - use as-is
    if (originalUrl.includes('@scrypted') || originalUrl.includes('/endpoint/@scrypted/')) {
      return originalUrl;
    }
    
    // For HTTP/HTTPS streams with credentials, use server proxy
    if ((username || password) && (originalUrl.startsWith('http://') || originalUrl.startsWith('https://'))) {
      const params = new URLSearchParams({
        url: originalUrl
      });
      if (username) params.append('username', username);
      if (password) params.append('password', password);
      return `/api/camera?${params.toString()}`;
    }
    
    // RTSP - needs server proxy
    if (originalUrl.startsWith('rtsp://')) {
      const params = new URLSearchParams({
        url: originalUrl
      });
      if (username) params.append('username', username);
      if (password) params.append('password', password);
      return `/api/camera?${params.toString()}`;
    }
    
    // HTTP/HTTPS without credentials - try direct first, fallback to proxy for CORS
    if (originalUrl.startsWith('http://') || originalUrl.startsWith('https://')) {
      // For MJPEG and snapshots, try direct first
      if (originalUrl.includes('video.cgi') || originalUrl.includes('/mjpg/') || 
          originalUrl.includes('/snapshot') || originalUrl.includes('/mjpeg/')) {
        // Try direct - if it fails, browser will show error and we can proxy
        return originalUrl;
      }
      // For other streams, use proxy for CORS handling
      return `/api/camera?url=${encodeURIComponent(originalUrl)}`;
    }
    
    // Unknown format - proxy it
    return `/api/camera?url=${encodeURIComponent(originalUrl)}`;
  }

  setupCameraHandlers() {
    this.cameras.forEach((camera, index) => {
      if (!camera || !camera.url) return;
      
      const cameraId = `camera-${this.id}-${index}`;
      const video = this.element.querySelector(`#${cameraId}`);
      const image = this.element.querySelector(`#${cameraId}`);
      const iframe = this.element.querySelector(`#${cameraId}`);
      const errorEl = this.element.querySelector(`#${cameraId}-error`);
      
      if (!video && !image && !iframe) return;

      // Handle video elements
      if (video && video.tagName === 'VIDEO') {
        this.setupVideoHandler(video, errorEl, camera);
      }
      
      // Handle image elements (MJPEG, snapshots)
      if (image && image.tagName === 'IMG') {
        this.setupImageHandler(image, errorEl, camera);
      }
      
      // Handle iframe elements (Scrypted)
      if (iframe && iframe.tagName === 'IFRAME') {
        this.setupIframeHandler(iframe, errorEl, camera);
      }
    });
  }

  setupVideoHandler(video, errorEl, camera) {
    video.addEventListener('error', (e) => {
      if (window.DEBUG_MODE === true) {
        console.error(`Camera video error (${camera.name || camera.url}):`, e);
      }
      if (errorEl) {
        errorEl.style.display = 'flex';
        const url = camera.url || '';
        if (url.includes('/rebroadcast/hls/')) {
          errorEl.querySelector('.camera-error-text').textContent = 'Rebroadcast plugin not installed';
        } else {
          errorEl.querySelector('.camera-error-text').textContent = 'Unable to load video stream';
        }
      }
      if (video) video.style.display = 'none';
    });

    video.addEventListener('loadeddata', () => {
      if (errorEl) errorEl.style.display = 'none';
      if (video) video.style.display = 'block';
    });

    // Try to play
    const playVideo = () => {
      if (video && video.paused && video.readyState >= 2) {
        video.play().catch(err => {
          if (window.DEBUG_MODE === true) {
            console.warn(`Camera play error (${camera.name || camera.url}):`, err);
          }
        });
      }
    };
    
    video.addEventListener('canplay', playVideo);
    playVideo();
    
    // Keep playing if paused
    video.addEventListener('pause', () => {
      if (!document.hidden) {
        setTimeout(playVideo, 1000);
      }
    });
  }

  setupImageHandler(image, errorEl, camera) {
    const url = camera.url || '';
    const isSnapshot = url.includes('/snapshot');
    
    image.addEventListener('error', (e) => {
      if (window.DEBUG_MODE === true) {
        console.error(`Camera image error (${camera.name || camera.url}):`, e);
      }
      if (errorEl) {
        errorEl.style.display = 'flex';
        errorEl.querySelector('.camera-error-text').textContent = 'Unable to load camera feed';
      }
      if (image) image.style.display = 'none';
      
      // If direct URL failed and we have credentials, try proxy
      if (url.startsWith('http') && !url.includes('/api/camera') && (camera.username || camera.password)) {
        const streamUrl = this.buildStreamUrl(camera);
        if (streamUrl !== image.src) {
          setTimeout(() => {
            image.src = streamUrl;
          }, 2000);
        }
      }
    });

    image.addEventListener('load', () => {
      if (errorEl) errorEl.style.display = 'none';
      if (image) image.style.display = 'block';
    });

    // For snapshot endpoints, refresh periodically
    if (isSnapshot) {
      const snapshotInterval = setInterval(() => {
        if (image && image.style.display !== 'none') {
          const currentSrc = image.src.split('?')[0];
          image.src = currentSrc + '?t=' + Date.now();
        } else {
          clearInterval(snapshotInterval);
        }
      }, 1000);
    }
  }

  setupIframeHandler(iframe, errorEl, camera) {
    iframe.addEventListener('load', () => {
      if (errorEl) errorEl.style.display = 'none';
      if (iframe) iframe.style.display = 'block';
    });
    
    // Note: iframes don't fire error events reliably, so we check after a timeout
    setTimeout(() => {
      try {
        // Try to access iframe content (will fail if error)
        if (iframe.contentWindow) {
          // Iframe loaded successfully
          if (errorEl) errorEl.style.display = 'none';
        }
      } catch (e) {
        // Cross-origin or error - show error message
        if (errorEl) {
          errorEl.style.display = 'flex';
          errorEl.querySelector('.camera-error-text').textContent = 'Unable to load iframe (may require authentication)';
        }
      }
    }, 3000);
  }

  escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  update() {
    // Check if config changed
    const currentCameras = window.CONFIG?.cameras?.feeds || [];
    const currentHash = JSON.stringify(currentCameras);
    
    if (currentHash !== this.lastConfigHash) {
      console.log('📹 Camera config changed, updating...');
      this.render();
    }
  }

  destroy() {
    // Clean up all camera elements
    this.cameras.forEach((camera, index) => {
      const cameraId = `camera-${this.id}-${index}`;
      const video = this.element?.querySelector(`#${cameraId}`);
      const iframe = this.element?.querySelector(`#${cameraId}`);
      
      if (video && video.tagName === 'VIDEO') {
        video.pause();
        video.src = '';
        video.load();
      }
      
      if (iframe && iframe.tagName === 'IFRAME') {
        iframe.src = 'about:blank';
      }
    });
    
    super.destroy();
  }
}

// Register widget
if (typeof window !== 'undefined' && window.widgetRegistry) {
  window.widgetRegistry.register('camera', CameraWidget);
}
