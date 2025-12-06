/**
 * Time-of-Day Theme System
 * Adjusts dashboard feel based on sunrise/sunset
 */

const TimeTheme = {
  currentTheme: null,
  sunData: null,
  
  // Default sun times (will be overridden by actual data)
  defaults: {
    sunrise: 7,  // 7am
    sunset: 18   // 6pm
  },
  
  init() {
    this.update();
    // Update theme every minute
    setInterval(() => this.update(), 60000);
  },
  
  setSunData(sunrise, sunset) {
    // sunrise/sunset should be Date objects or timestamps
    this.sunData = {
      sunrise: sunrise instanceof Date ? sunrise : new Date(sunrise),
      sunset: sunset instanceof Date ? sunset : new Date(sunset)
    };
    this.update();
  },
  
  getTimePhase() {
    const now = new Date();
    const hour = now.getHours();
    const minutes = now.getMinutes();
    const currentTime = hour + minutes / 60;
    
    // Use actual sun data if available, otherwise use defaults
    let sunriseHour = this.defaults.sunrise;
    let sunsetHour = this.defaults.sunset;
    
    if (this.sunData) {
      sunriseHour = this.sunData.sunrise.getHours() + this.sunData.sunrise.getMinutes() / 60;
      sunsetHour = this.sunData.sunset.getHours() + this.sunData.sunset.getMinutes() / 60;
    }
    
    // Calculate transition periods based on actual sun times
    const dawnStart = sunriseHour - 1;           // 1 hour before sunrise
    const morningStart = sunriseHour + 0.5;      // 30 min after sunrise
    const middayStart = sunriseHour + 4;         // ~4 hours after sunrise
    const middayEnd = sunsetHour - 4;            // ~4 hours before sunset
    const afternoonEnd = sunsetHour - 1;         // 1 hour before sunset
    const duskEnd = sunsetHour + 1.5;            // 1.5 hours after sunset
    const eveningEnd = sunsetHour + 3;           // 3 hours after sunset
    
    // Determine current phase
    if (currentTime >= eveningEnd || currentTime < dawnStart) {
      return 'night';
    } else if (currentTime >= dawnStart && currentTime < morningStart) {
      return 'dawn';
    } else if (currentTime >= morningStart && currentTime < middayStart) {
      return 'morning';
    } else if (currentTime >= middayStart && currentTime < middayEnd) {
      return 'midday';
    } else if (currentTime >= middayEnd && currentTime < afternoonEnd) {
      return 'afternoon';
    } else if (currentTime >= afternoonEnd && currentTime < duskEnd) {
      return 'dusk';
    } else if (currentTime >= duskEnd && currentTime < eveningEnd) {
      return 'evening';
    }
    
    return 'night';
  },
  
  update() {
    const phase = this.getTimePhase();
    
    if (phase === this.currentTheme) return;
    
    // Remove all time classes
    document.body.classList.remove(
      'time-night', 'time-dawn', 'time-morning', 
      'time-midday', 'time-afternoon', 'time-dusk', 'time-evening'
    );
    
    // Add new class with transition
    document.body.style.transition = 'background-color 2s ease';
    document.body.classList.add(`time-${phase}`);
    
    this.currentTheme = phase;
    console.log(`Theme changed to: ${phase}`);
    
    // Dispatch event for other modules
    window.dispatchEvent(new CustomEvent('themeChanged', { detail: { phase } }));
  },
  
  // Get info about current state
  getInfo() {
    return {
      phase: this.currentTheme,
      sunData: this.sunData,
      isDaytime: ['dawn', 'morning', 'midday', 'afternoon'].includes(this.currentTheme)
    };
  }
};



