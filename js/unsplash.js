/**
 * Unsplash Background Slideshow Module
 * Handles fetching and displaying background images with smooth transitions
 */

class UnsplashSlideshow {
  constructor(config) {
    this.config = {
      accessKey: config.accessKey || '',
      searchQuery: config.searchQuery || 'nature landscape',
      collectionId: config.collectionId || '',
      interval: config.interval || 30000,
      transitionDuration: config.transitionDuration || 2000,
      preloadCount: config.preloadCount || 5
    };
    
    this.photos = [];
    this.currentIndex = 0;
    this.slides = [];
    this.activeSlideIndex = 0;
    this.intervalId = null;
    this.isRunning = false;
  }

  /**
   * Initialize the slideshow
   */
  async init() {
    // Get slide elements
    this.slides = document.querySelectorAll('.background-slide');
    
    if (this.slides.length < 2) {
      console.error('UnsplashSlideshow: Need at least 2 slide elements');
      return;
    }

    // Set transition duration CSS variable
    document.documentElement.style.setProperty(
      '--transition-duration',
      `${this.config.transitionDuration}ms`
    );

    // Check for API key
    if (!this.config.accessKey || this.config.accessKey === 'YOUR_UNSPLASH_ACCESS_KEY') {
      console.warn('UnsplashSlideshow: No API key provided, using fallback backgrounds');
      this.useFallbackBackgrounds();
      return;
    }

    try {
      // Fetch initial batch of photos
      await this.fetchPhotos();
      
      if (this.photos.length > 0) {
        // Show first photo immediately
        await this.showPhoto(0);
        
        // Preload next photos
        this.preloadPhotos();
        
        // Start slideshow
        this.start();
      }
    } catch (error) {
      console.error('UnsplashSlideshow: Error initializing', error);
      this.useFallbackBackgrounds();
    }
  }

  /**
   * Fetch photos from Unsplash API
   */
  async fetchPhotos() {
    let url;
    
    if (this.config.collectionId) {
      // Fetch from specific collection
      url = `https://api.unsplash.com/collections/${this.config.collectionId}/photos?per_page=30&client_id=${this.config.accessKey}`;
    } else {
      // Search for photos
      url = `https://api.unsplash.com/search/photos?query=${encodeURIComponent(this.config.searchQuery)}&per_page=30&orientation=landscape&client_id=${this.config.accessKey}`;
    }

    const response = await fetch(url);
    
    if (!response.ok) {
      throw new Error(`Unsplash API error: ${response.status}`);
    }

    const data = await response.json();
    
    // Handle different response structures
    const photos = this.config.collectionId ? data : data.results;
    
    // Shuffle photos for variety
    this.photos = this.shuffleArray(photos.map(photo => ({
      id: photo.id,
      url: photo.urls.full || photo.urls.regular,
      thumb: photo.urls.thumb,
      color: photo.color,
      alt: photo.alt_description || photo.description || 'Background image',
      photographer: photo.user.name,
      photographerUrl: photo.user.links.html
    })));

    console.log(`UnsplashSlideshow: Loaded ${this.photos.length} photos`);
  }

  /**
   * Show a specific photo
   */
  async showPhoto(index) {
    if (this.photos.length === 0) return;

    const photo = this.photos[index];
    const nextSlideIndex = (this.activeSlideIndex + 1) % 2;
    const currentSlide = this.slides[this.activeSlideIndex];
    const nextSlide = this.slides[nextSlideIndex];

    // Preload the image
    await this.loadImage(photo.url);

    // Set background on next slide
    nextSlide.style.backgroundImage = `url(${photo.url})`;
    
    // Add Ken Burns effect class
    nextSlide.classList.add('ken-burns');
    
    // Trigger transition
    currentSlide.classList.remove('active');
    nextSlide.classList.add('active');

    // Update active slide index
    this.activeSlideIndex = nextSlideIndex;
    this.currentIndex = index;

    // Remove Ken Burns from old slide after transition
    setTimeout(() => {
      currentSlide.classList.remove('ken-burns');
    }, this.config.transitionDuration);
  }

  /**
   * Load an image and return a promise
   */
  loadImage(url) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = reject;
      img.src = url;
    });
  }

  /**
   * Preload upcoming photos
   */
  preloadPhotos() {
    for (let i = 1; i <= this.config.preloadCount; i++) {
      const index = (this.currentIndex + i) % this.photos.length;
      const photo = this.photos[index];
      if (photo) {
        const img = new Image();
        img.src = photo.url;
      }
    }
  }

  /**
   * Move to next photo
   */
  async next() {
    const nextIndex = (this.currentIndex + 1) % this.photos.length;
    
    // If we're near the end, fetch more photos
    if (nextIndex === 0 && this.config.accessKey) {
      try {
        await this.fetchPhotos();
      } catch (error) {
        console.warn('UnsplashSlideshow: Error fetching more photos', error);
      }
    }

    await this.showPhoto(nextIndex);
    this.preloadPhotos();
  }

  /**
   * Start the slideshow
   */
  start() {
    if (this.isRunning) return;
    
    this.isRunning = true;
    this.intervalId = setInterval(() => {
      this.next();
    }, this.config.interval);
    
    console.log('UnsplashSlideshow: Started');
  }

  /**
   * Stop the slideshow
   */
  stop() {
    if (!this.isRunning) return;
    
    this.isRunning = false;
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    
    console.log('UnsplashSlideshow: Stopped');
  }

  /**
   * Use fallback gradient backgrounds when API is unavailable
   */
  useFallbackBackgrounds() {
    const fallbackGradients = [
      'linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%)',
      'linear-gradient(135deg, #0f0c29 0%, #302b63 50%, #24243e 100%)',
      'linear-gradient(135deg, #232526 0%, #414345 100%)',
      'linear-gradient(135deg, #1e3c72 0%, #2a5298 100%)',
      'linear-gradient(135deg, #141e30 0%, #243b55 100%)'
    ];

    this.photos = fallbackGradients.map((gradient, index) => ({
      id: `fallback-${index}`,
      gradient: gradient,
      isFallback: true
    }));

    // Show first gradient
    const slide = this.slides[this.activeSlideIndex];
    slide.style.background = this.photos[0].gradient;
    slide.classList.add('active');

    // Start cycling through gradients (clear any existing interval first)
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    this.intervalId = setInterval(() => {
      this.currentIndex = (this.currentIndex + 1) % this.photos.length;
      const nextSlideIndex = (this.activeSlideIndex + 1) % 2;
      const currentSlide = this.slides[this.activeSlideIndex];
      const nextSlide = this.slides[nextSlideIndex];

      nextSlide.style.background = this.photos[this.currentIndex].gradient;
      currentSlide.classList.remove('active');
      nextSlide.classList.add('active');

      this.activeSlideIndex = nextSlideIndex;
    }, this.config.interval);

    this.isRunning = true;
  }

  /**
   * Shuffle array using Fisher-Yates algorithm
   */
  shuffleArray(array) {
    const shuffled = [...array];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
  }

  /**
   * Update configuration
   */
  updateConfig(newConfig) {
    this.stop();
    this.config = { ...this.config, ...newConfig };
    this.photos = [];
    this.currentIndex = 0;
    this.init();
  }
}

// Export for use in app.js
window.UnsplashSlideshow = UnsplashSlideshow;



