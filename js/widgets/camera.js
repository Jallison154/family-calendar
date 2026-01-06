/**
 * Camera Feed Widget (RTSP/HLS/WebRTC streams)
 */

class CameraWidget extends BaseWidget {
  constructor(config = {}) {
    super(config);
    this.type = 'camera';
    this.cameras = config.cameras || window.CONFIG?.cameras?.feeds || [];
    this.showTitles = config.showTitles !== undefined ? config.showTitles : window.CONFIG?.cameras?.showTitles !== undefined ? window.CONFIG?.cameras?.showTitles : true;
    this.updateInterval = null;
  }

  getHTML() {
    return `
      <div class="widget-body" id="${this.id}-body">
        <div class="camera-feeds-container" id="${this.id}-container">
          ${this.cameras.length === 0 ? '<div class="camera-empty">No camera feeds configured</div>' : ''}
        </div>
      </div>
    `;
  }

  onInit() {
    this.render();
  }

  render() {
    const container = this.element.querySelector(`#${this.id}-container`);
    if (!container) return;

    if (this.cameras.length === 0) {
      container.innerHTML = '<div class="camera-empty">No camera feeds configured</div>';
      return;
    }

    let html = '<div class="camera-feeds-grid">';
    
    this.cameras.forEach((camera, index) => {
      if (!camera.url || !camera.url.trim()) return;
      
      const cameraId = `camera-${this.id}-${index}`;
      
      // Use server proxy for RTSP/HTTP streams
      // For RTSP, this will return an error message (need ffmpeg conversion)
      // For HTTP/HLS, this will proxy the stream
      // MJPEG streams work directly in browsers
      // Scrypted WebRTC streams use iframe embedding
      const streamUrl = this.getStreamUrl(camera);
      const originalUrl = camera.url || '';
      // Use original URL for type detection (before credentials are added)
      const isScrypted = originalUrl.includes('@scrypted') || 
                         originalUrl.includes('/endpoint/@scrypted/') ||
                         originalUrl.includes('/webrtc/');
      const isScryptedHls = originalUrl.includes('/rebroadcast/hls/') ||
                            (isScrypted && originalUrl.includes('.m3u8'));
      const isHls = originalUrl.includes('.m3u8');
      const isMjpeg = originalUrl.includes('/mjpg/') || 
                      originalUrl.includes('/mjpeg/') ||
                      originalUrl.includes('video.cgi') ||
                      originalUrl.includes('.mjpg') ||
                      originalUrl.includes('.mjpeg');
      const isSnapshot = originalUrl.includes('/snapshot');
      
      html += `
        <div class="camera-feed-wrapper">
          ${(this.showTitles && camera.name) ? `<div class="camera-feed-name">${this.escapeHtml(camera.name)}</div>` : ''}
          <div class="camera-feed-container">
            ${isScryptedHls ? `
            <!-- Scrypted HLS rebroadcast - works without authentication -->
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
            ` : isScrypted ? `
            <!-- Scrypted WebRTC/public page - embed via iframe (may require auth) -->
            <iframe
              id="${cameraId}"
              class="camera-feed-iframe"
              src="${streamUrl}"
              allow="autoplay; fullscreen"
              allowfullscreen
              frameborder="0"
            ></iframe>
            ` : isSnapshot ? `
            <!-- Snapshot endpoint - refresh periodically -->
            <img
              id="${cameraId}"
              class="camera-feed-image"
              src="${streamUrl}"
              alt="${this.escapeHtml(camera.name || 'Camera')}"
            />
            ` : isHls ? `
            <!-- HLS stream -->
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
            ` : isMjpeg ? `
            <!-- MJPEG stream - works directly in browsers! -->
            <img
              id="${cameraId}"
              class="camera-feed-image"
              src="${streamUrl}"
              alt="${this.escapeHtml(camera.name || 'Camera')}"
            />
            ` : `
            <!-- Other video stream (MP4, WebM, etc.) -->
            <video
              id="${cameraId}"
              class="camera-feed-video"
              autoplay
              muted
              playsinline
              preload="auto"
              loop
            >
              <source src="${streamUrl}">
              Your browser does not support the video tag.
            </video>
            `}
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

    // Setup video elements after rendering
    this.setupVideos();
  }

  getStreamUrl(camera) {
    // camera can be an object with {url, username, password} or just a string URL
    const originalUrl = typeof camera === 'string' ? camera : (camera.url || '');
    const username = typeof camera === 'object' ? (camera.username || '') : '';
    const password = typeof camera === 'object' ? (camera.password || '') : '';
    
    // Build URL with credentials if provided
    let urlWithCredentials = originalUrl;
    if (username && password && !originalUrl.includes('@') && !originalUrl.includes('@scrypted')) {
      // Embed credentials in URL: http://user:pass@host/path
      try {
        const urlObj = new URL(originalUrl);
        urlObj.username = username;
        urlObj.password = password;
        urlWithCredentials = urlObj.toString();
      } catch (e) {
        // If URL parsing fails, try manual construction
        const match = originalUrl.match(/^(https?:\/\/)([^\/]+)(.*)$/);
        if (match) {
          urlWithCredentials = `${match[1]}${username}:${password}@${match[2]}${match[3]}`;
        }
      }
    }
    
    // ONVIF cameras typically provide:
    // 1. RTSP streams (rtsp://...) - needs server-side conversion
    // 2. MJPEG over HTTP (http://.../video.cgi or /mjpg/video.mjpg) - works directly in browsers!
    // 3. HLS streams (http://.../stream.m3u8) - works directly in browsers
    // 4. Snapshot endpoints (http://.../snapshot.cgi) - works directly as images
    // 5. Scrypted WebRTC/HLS (various endpoints) - use iframe or video embedding
    
    // Check if it's a Scrypted URL
    // Scrypted provides several endpoints:
    // - Public device page: /endpoint/@scrypted/core/public/#/device/{id} (requires auth)
    // - WebRTC endpoint: /webrtc/{camera-name} (may work without auth)
    // - HLS rebroadcast: /endpoint/@scrypted/rebroadcast/hls/{id} (no auth needed)
    const isScrypted = urlWithCredentials.includes('@scrypted') || 
                       urlWithCredentials.includes('/endpoint/@scrypted/') ||
                       urlWithCredentials.includes('/webrtc/');
    
    // Scrypted HLS rebroadcast works better than public page (no auth needed)
    const isScryptedHls = urlWithCredentials.includes('/rebroadcast/hls/') ||
                          (isScrypted && urlWithCredentials.includes('.m3u8'));
    
    // Check if it's an MJPEG stream (works directly in browsers)
    const isMjpeg = urlWithCredentials.includes('/mjpg/') || 
                    urlWithCredentials.includes('/mjpeg/') || 
                    urlWithCredentials.includes('video.cgi') ||
                    urlWithCredentials.includes('.mjpg') ||
                    urlWithCredentials.includes('.mjpeg');
    
    // Scrypted HLS rebroadcast - use video element (no auth, better performance)
    if (isScryptedHls) {
      return urlWithCredentials;
    }
    
    // Scrypted public page or WebRTC endpoint - use iframe (may require auth)
    // Note: Public pages often require authentication. Consider using HLS rebroadcast instead.
    if (isScrypted) {
      return urlWithCredentials;
    }
    
    // If it's MJPEG or snapshot, check if credentials are needed
    if (isMjpeg || urlWithCredentials.includes('/snapshot')) {
      // If credentials are provided, proxy through server for better reliability
      // Browsers may have issues with embedded credentials in some cases
      if (username && password) {
        // Proxy through server to handle credentials reliably
        return `/api/camera?url=${encodeURIComponent(originalUrl)}&username=${encodeURIComponent(username)}&password=${encodeURIComponent(password)}`;
      }
      // No credentials or already has embedded credentials, use directly
      return urlWithCredentials;
    }
    
    // For other HTTP/HTTPS streams with credentials, proxy through server
    if (urlWithCredentials.startsWith('http://') || urlWithCredentials.startsWith('https://')) {
      if (username && password) {
        // Proxy through server to handle credentials and CORS
        return `/api/camera?url=${encodeURIComponent(originalUrl)}&username=${encodeURIComponent(username)}&password=${encodeURIComponent(password)}`;
      }
      // No credentials, proxy for CORS handling
      return `/api/camera?url=${encodeURIComponent(originalUrl)}`;
    } 
    
    // RTSP needs server-side conversion
    if (urlWithCredentials.startsWith('rtsp://')) {
      if (username && password) {
        return `/api/camera?url=${encodeURIComponent(originalUrl)}&username=${encodeURIComponent(username)}&password=${encodeURIComponent(password)}`;
      }
      return `/api/camera?url=${encodeURIComponent(originalUrl)}`;
    }
    
    // Assume it needs proxying
    if (username && password) {
      return `/api/camera?url=${encodeURIComponent(originalUrl)}&username=${encodeURIComponent(username)}&password=${encodeURIComponent(password)}`;
    }
    return `/api/camera?url=${encodeURIComponent(originalUrl)}`;
  }

  setupVideos() {
    this.cameras.forEach((camera, index) => {
      const cameraId = `camera-${this.id}-${index}`;
      const video = this.element.querySelector(`#${cameraId}`);
      const image = this.element.querySelector(`#${cameraId}`);
      const iframe = this.element.querySelector(`#${cameraId}`);
      const errorEl = this.element.querySelector(`#${cameraId}-error`);
      
      if (!video && !image && !iframe) return;

      const isImage = image && image.tagName === 'IMG';
      const isVideo = video && video.tagName === 'VIDEO';
      const isIframe = iframe && iframe.tagName === 'IFRAME';

      if (isVideo) {
        // Handle video load errors
        video.addEventListener('error', (e) => {
          // Only log error details in debug mode to reduce console noise
          if (window.DEBUG_MODE === true) {
            console.error(`Camera feed error (${camera.name || camera.url}):`, e);
          }
          // Silent fail in production - error is already shown in UI
          if (errorEl) {
            errorEl.style.display = 'flex';
            // Provide helpful error message for common issues
            const url = camera.url || '';
            if (url.includes('/rebroadcast/hls/') || url.includes('404')) {
              errorEl.querySelector('.camera-error-text').textContent = 'Rebroadcast plugin not installed or URL incorrect. Try using camera\'s direct MJPEG URL.';
            } else if (url.includes('@scrypted')) {
              errorEl.querySelector('.camera-error-text').textContent = 'Scrypted endpoint error. Check device ID and plugin configuration.';
            } else {
              errorEl.querySelector('.camera-error-text').textContent = 'Unable to load feed. Check URL and network connection.';
            }
          }
          if (video) {
            video.style.display = 'none';
          }
        });

        // Hide error when video loads successfully
        video.addEventListener('loadeddata', () => {
          if (errorEl) {
            errorEl.style.display = 'none';
          }
          if (video) {
            video.style.display = 'block';
          }
        });

        // Try to play the video and ensure it stays playing
        const ensurePlaying = () => {
          if (video && !video.paused && video.readyState >= 2) {
            return; // Already playing
          }
          video.play().catch(err => {
            console.warn(`Camera feed play error (${camera.name || camera.url}):`, err);
            // Retry after a short delay
            setTimeout(ensurePlaying, 2000);
          });
        };
        
        // Start playing
        ensurePlaying();
        
        // Ensure video keeps playing if it pauses
        video.addEventListener('pause', () => {
          if (!document.hidden) {
            ensurePlaying();
          }
        });
        
        // Keep alive: check every 5 seconds that video is still playing
        setInterval(() => {
          if (!document.hidden && video.paused) {
            ensurePlaying();
          }
        }, 5000);
      } else if (isImage) {
        // Handle image load errors (for MJPEG streams and snapshots)
        image.addEventListener('error', (e) => {
          // Only log error details in debug mode to reduce console noise
          if (window.DEBUG_MODE === true) {
            console.error(`Camera image error (${camera.name || camera.url}):`, e);
          }
          // Silent fail in production - error is already shown in UI
          if (errorEl) {
            errorEl.style.display = 'flex';
          }
          if (image) {
            image.style.display = 'none';
          }
        });

        // Hide error when image loads successfully
        image.addEventListener('load', () => {
          if (errorEl) {
            errorEl.style.display = 'none';
          }
          if (image) {
            image.style.display = 'block';
          }
        });

        // For snapshot endpoints, refresh periodically
        const isSnapshot = camera.url.includes('/snapshot');
        if (isSnapshot) {
          // Refresh snapshot every 1 second for smoother updates
          const snapshotInterval = setInterval(() => {
            if (image && image.style.display !== 'none') {
              const currentSrc = image.src;
              // Add timestamp to bust cache
              image.src = currentSrc.split('?')[0] + '?t=' + Date.now();
            } else {
              clearInterval(snapshotInterval);
            }
          }, 1000);
        }
        // MJPEG streams auto-refresh, so no interval needed
        // But ensure they keep loading if paused
        else if (image && !isSnapshot) {
          let retryCount = 0;
          const maxRetries = 3;
          let retryTimeout = null;
          
          const handleMjpegError = () => {
            retryCount++;
            
            if (retryCount > maxRetries) {
              console.error(`Camera MJPEG stream failed after ${maxRetries} retries: ${camera.name || camera.url}`);
              if (errorEl) {
                errorEl.style.display = 'flex';
                errorEl.querySelector('.camera-error-text').textContent = 'Stream connection failed. Check camera URL and credentials.';
              }
              // Stop retrying
              return;
            }
            
            // Clear any existing timeout
            if (retryTimeout) {
              clearTimeout(retryTimeout);
            }
            
            // Exponential backoff: 2s, 4s, 8s
            const delay = Math.min(2000 * Math.pow(2, retryCount - 1), 10000);
            
            retryTimeout = setTimeout(() => {
              if (image && image.style.display !== 'none') {
                const currentSrc = image.src;
                // Preserve query parameters when adding timestamp
                const [base, query] = currentSrc.split('?');
                const timestamp = 't=' + Date.now();
                const newQuery = query ? query + '&' + timestamp : timestamp;
                image.src = base + '?' + newQuery;
                
                // Reset retry count on successful load
                image.addEventListener('load', () => {
                  retryCount = 0;
                }, { once: true });
              }
            }, delay);
          };
          
          image.addEventListener('error', handleMjpegError);
          
          // Also handle successful loads to reset retry count
          image.addEventListener('load', () => {
            retryCount = 0;
            if (errorEl) {
              errorEl.style.display = 'none';
            }
          });
        }
      } else if (isIframe) {
        // Handle iframe load errors (for Scrypted WebRTC)
        iframe.addEventListener('error', (e) => {
          // Only log error details in debug mode to reduce console noise
          if (window.DEBUG_MODE === true) {
            console.error(`Camera iframe error (${camera.name || camera.url}):`, e);
          }
          // Silent fail in production - error is already shown in UI
          if (errorEl) {
            errorEl.style.display = 'flex';
          }
          if (iframe) {
            iframe.style.display = 'none';
          }
        });

        // Hide error when iframe loads successfully
        iframe.addEventListener('load', () => {
          if (errorEl) {
            errorEl.style.display = 'none';
          }
          if (iframe) {
            iframe.style.display = 'block';
          }
        });
      }
    });
  }

  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  update() {
    // Refresh video sources if needed
    // This could be used to reconnect streams
    this.render();
  }

  destroy() {
    // Clean up video/iframe elements
    this.cameras.forEach((camera, index) => {
      const cameraId = `camera-${this.id}-${index}`;
      const video = this.element.querySelector(`#${cameraId}`);
      const iframe = this.element.querySelector(`#${cameraId}`);
      
      if (video && video.tagName === 'VIDEO') {
        video.pause();
        video.src = '';
        video.load();
      }
      
      if (iframe && iframe.tagName === 'IFRAME') {
        // Remove iframe src to stop loading
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

