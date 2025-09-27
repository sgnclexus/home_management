// Mobile detection and optimization utilities

export interface DeviceInfo {
  isMobile: boolean;
  isTablet: boolean;
  isDesktop: boolean;
  isTouchDevice: boolean;
  screenSize: 'sm' | 'md' | 'lg' | 'xl' | '2xl';
  orientation: 'portrait' | 'landscape';
}

export class MobileDetector {
  private static instance: MobileDetector;
  private deviceInfo: DeviceInfo;
  private listeners: Array<(deviceInfo: DeviceInfo) => void> = [];

  private constructor() {
    this.deviceInfo = this.detectDevice();
    this.setupListeners();
  }

  public static getInstance(): MobileDetector {
    if (!MobileDetector.instance) {
      MobileDetector.instance = new MobileDetector();
    }
    return MobileDetector.instance;
  }

  private detectDevice(): DeviceInfo {
    if (typeof window === 'undefined') {
      return {
        isMobile: false,
        isTablet: false,
        isDesktop: true,
        isTouchDevice: false,
        screenSize: 'lg',
        orientation: 'landscape',
      };
    }

    const userAgent = navigator.userAgent.toLowerCase();
    const width = window.innerWidth;
    const height = window.innerHeight;

    // Mobile detection
    const isMobile = /android|webos|iphone|ipod|blackberry|iemobile|opera mini/i.test(userAgent) || width < 768;
    
    // Tablet detection
    const isTablet = /ipad|android(?!.*mobile)|tablet/i.test(userAgent) || (width >= 768 && width < 1024);
    
    // Desktop detection
    const isDesktop = !isMobile && !isTablet;
    
    // Touch device detection
    const isTouchDevice = 'ontouchstart' in window || navigator.maxTouchPoints > 0;

    // Screen size detection based on Tailwind breakpoints
    let screenSize: 'sm' | 'md' | 'lg' | 'xl' | '2xl';
    if (width < 640) {
      screenSize = 'sm';
    } else if (width < 768) {
      screenSize = 'md';
    } else if (width < 1024) {
      screenSize = 'lg';
    } else if (width < 1280) {
      screenSize = 'xl';
    } else {
      screenSize = '2xl';
    }

    // Orientation detection
    const orientation = height > width ? 'portrait' : 'landscape';

    return {
      isMobile,
      isTablet,
      isDesktop,
      isTouchDevice,
      screenSize,
      orientation,
    };
  }

  private setupListeners(): void {
    if (typeof window === 'undefined') return;

    const handleResize = () => {
      const newDeviceInfo = this.detectDevice();
      const hasChanged = JSON.stringify(this.deviceInfo) !== JSON.stringify(newDeviceInfo);
      
      if (hasChanged) {
        this.deviceInfo = newDeviceInfo;
        this.notifyListeners();
      }
    };

    const handleOrientationChange = () => {
      // Delay to ensure dimensions are updated
      setTimeout(() => {
        const newDeviceInfo = this.detectDevice();
        this.deviceInfo = newDeviceInfo;
        this.notifyListeners();
      }, 100);
    };

    window.addEventListener('resize', handleResize);
    window.addEventListener('orientationchange', handleOrientationChange);
  }

  private notifyListeners(): void {
    this.listeners.forEach(listener => listener(this.deviceInfo));
  }

  public getDeviceInfo(): DeviceInfo {
    return { ...this.deviceInfo };
  }

  public onDeviceChange(callback: (deviceInfo: DeviceInfo) => void): () => void {
    this.listeners.push(callback);
    
    // Immediately call with current device info
    callback(this.deviceInfo);

    // Return unsubscribe function
    return () => {
      const index = this.listeners.indexOf(callback);
      if (index > -1) {
        this.listeners.splice(index, 1);
      }
    };
  }

  public isMobile(): boolean {
    return this.deviceInfo.isMobile;
  }

  public isTablet(): boolean {
    return this.deviceInfo.isTablet;
  }

  public isDesktop(): boolean {
    return this.deviceInfo.isDesktop;
  }

  public isTouchDevice(): boolean {
    return this.deviceInfo.isTouchDevice;
  }

  public getScreenSize(): 'sm' | 'md' | 'lg' | 'xl' | '2xl' {
    return this.deviceInfo.screenSize;
  }

  public getOrientation(): 'portrait' | 'landscape' {
    return this.deviceInfo.orientation;
  }
}

// Singleton instance
export const mobileDetector = MobileDetector.getInstance();

// Touch gesture utilities
export interface TouchGesture {
  type: 'tap' | 'swipe' | 'pinch' | 'longpress';
  direction?: 'up' | 'down' | 'left' | 'right';
  distance?: number;
  duration?: number;
  scale?: number;
}

export class TouchGestureHandler {
  private element: HTMLElement;
  private startTouch: Touch | null = null;
  private startTime: number = 0;
  private longPressTimer: NodeJS.Timeout | null = null;
  private callbacks: Map<string, (gesture: TouchGesture) => void> = new Map();

  constructor(element: HTMLElement) {
    this.element = element;
    this.setupEventListeners();
  }

  private setupEventListeners(): void {
    this.element.addEventListener('touchstart', this.handleTouchStart.bind(this), { passive: false });
    this.element.addEventListener('touchmove', this.handleTouchMove.bind(this), { passive: false });
    this.element.addEventListener('touchend', this.handleTouchEnd.bind(this), { passive: false });
    this.element.addEventListener('touchcancel', this.handleTouchCancel.bind(this), { passive: false });
  }

  private handleTouchStart(event: TouchEvent): void {
    if (event.touches.length === 1) {
      this.startTouch = event.touches[0];
      this.startTime = Date.now();
      
      // Setup long press detection
      this.longPressTimer = setTimeout(() => {
        if (this.startTouch) {
          this.triggerGesture({
            type: 'longpress',
            duration: Date.now() - this.startTime,
          });
        }
      }, 500); // 500ms for long press
    }
  }

  private handleTouchMove(event: TouchEvent): void {
    // Cancel long press if finger moves
    if (this.longPressTimer) {
      clearTimeout(this.longPressTimer);
      this.longPressTimer = null;
    }
  }

  private handleTouchEnd(event: TouchEvent): void {
    if (this.longPressTimer) {
      clearTimeout(this.longPressTimer);
      this.longPressTimer = null;
    }

    if (!this.startTouch) return;

    const endTouch = event.changedTouches[0];
    const duration = Date.now() - this.startTime;
    const deltaX = endTouch.clientX - this.startTouch.clientX;
    const deltaY = endTouch.clientY - this.startTouch.clientY;
    const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);

    // Determine gesture type
    if (distance < 10 && duration < 300) {
      // Tap gesture
      this.triggerGesture({
        type: 'tap',
        duration,
      });
    } else if (distance > 30) {
      // Swipe gesture
      const direction = this.getSwipeDirection(deltaX, deltaY);
      this.triggerGesture({
        type: 'swipe',
        direction,
        distance,
        duration,
      });
    }

    this.startTouch = null;
  }

  private handleTouchCancel(): void {
    if (this.longPressTimer) {
      clearTimeout(this.longPressTimer);
      this.longPressTimer = null;
    }
    this.startTouch = null;
  }

  private getSwipeDirection(deltaX: number, deltaY: number): 'up' | 'down' | 'left' | 'right' {
    if (Math.abs(deltaX) > Math.abs(deltaY)) {
      return deltaX > 0 ? 'right' : 'left';
    } else {
      return deltaY > 0 ? 'down' : 'up';
    }
  }

  private triggerGesture(gesture: TouchGesture): void {
    const callback = this.callbacks.get(gesture.type);
    if (callback) {
      callback(gesture);
    }

    // Also trigger generic gesture callback
    const genericCallback = this.callbacks.get('*');
    if (genericCallback) {
      genericCallback(gesture);
    }
  }

  public onGesture(type: string, callback: (gesture: TouchGesture) => void): () => void {
    this.callbacks.set(type, callback);

    return () => {
      this.callbacks.delete(type);
    };
  }

  public destroy(): void {
    this.element.removeEventListener('touchstart', this.handleTouchStart.bind(this));
    this.element.removeEventListener('touchmove', this.handleTouchMove.bind(this));
    this.element.removeEventListener('touchend', this.handleTouchEnd.bind(this));
    this.element.removeEventListener('touchcancel', this.handleTouchCancel.bind(this));
    
    if (this.longPressTimer) {
      clearTimeout(this.longPressTimer);
    }
    
    this.callbacks.clear();
  }
}

// Performance optimization utilities
export class MobilePerformanceOptimizer {
  private static instance: MobilePerformanceOptimizer;
  private observers: Map<string, IntersectionObserver> = new Map();

  private constructor() {}

  public static getInstance(): MobilePerformanceOptimizer {
    if (!MobilePerformanceOptimizer.instance) {
      MobilePerformanceOptimizer.instance = new MobilePerformanceOptimizer();
    }
    return MobilePerformanceOptimizer.instance;
  }

  // Lazy loading for images
  public setupLazyLoading(selector: string = 'img[data-src]'): void {
    if (!('IntersectionObserver' in window)) {
      // Fallback for browsers without IntersectionObserver
      this.loadAllImages(selector);
      return;
    }

    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          const img = entry.target as HTMLImageElement;
          const src = img.getAttribute('data-src');
          if (src) {
            img.src = src;
            img.removeAttribute('data-src');
            observer.unobserve(img);
          }
        }
      });
    }, {
      rootMargin: '50px 0px',
      threshold: 0.01,
    });

    document.querySelectorAll(selector).forEach(img => {
      observer.observe(img);
    });

    this.observers.set('lazyImages', observer);
  }

  private loadAllImages(selector: string): void {
    document.querySelectorAll(selector).forEach(img => {
      const element = img as HTMLImageElement;
      const src = element.getAttribute('data-src');
      if (src) {
        element.src = src;
        element.removeAttribute('data-src');
      }
    });
  }

  // Debounced scroll handler
  public debounceScroll(callback: () => void, delay: number = 16): () => void {
    let timeoutId: NodeJS.Timeout;
    let lastExecTime = 0;

    const debouncedCallback = () => {
      const currentTime = Date.now();
      
      if (currentTime - lastExecTime > delay) {
        callback();
        lastExecTime = currentTime;
      } else {
        clearTimeout(timeoutId);
        timeoutId = setTimeout(() => {
          callback();
          lastExecTime = Date.now();
        }, delay - (currentTime - lastExecTime));
      }
    };

    return debouncedCallback;
  }

  // Throttled resize handler
  public throttleResize(callback: () => void, delay: number = 100): () => void {
    let timeoutId: NodeJS.Timeout;
    let lastExecTime = 0;

    return () => {
      const currentTime = Date.now();
      
      if (currentTime - lastExecTime > delay) {
        callback();
        lastExecTime = currentTime;
      } else {
        clearTimeout(timeoutId);
        timeoutId = setTimeout(() => {
          callback();
          lastExecTime = Date.now();
        }, delay - (currentTime - lastExecTime));
      }
    };
  }

  // Cleanup observers
  public cleanup(): void {
    this.observers.forEach(observer => observer.disconnect());
    this.observers.clear();
  }
}

// Singleton instance
export const mobilePerformanceOptimizer = MobilePerformanceOptimizer.getInstance();

// Viewport utilities
export interface ViewportInfo {
  width: number;
  height: number;
  availableHeight: number; // Height minus browser UI
  isKeyboardOpen: boolean;
}

export class ViewportManager {
  private static instance: ViewportManager;
  private viewportInfo: ViewportInfo;
  private listeners: Array<(viewportInfo: ViewportInfo) => void> = [];
  private initialHeight: number;

  private constructor() {
    this.initialHeight = typeof window !== 'undefined' ? window.innerHeight : 0;
    this.viewportInfo = this.calculateViewportInfo();
    this.setupListeners();
  }

  public static getInstance(): ViewportManager {
    if (!ViewportManager.instance) {
      ViewportManager.instance = new ViewportManager();
    }
    return ViewportManager.instance;
  }

  private calculateViewportInfo(): ViewportInfo {
    if (typeof window === 'undefined') {
      return {
        width: 0,
        height: 0,
        availableHeight: 0,
        isKeyboardOpen: false,
      };
    }

    const width = window.innerWidth;
    const height = window.innerHeight;
    const availableHeight = window.screen.availHeight || height;
    
    // Detect if keyboard is open (mobile)
    const isKeyboardOpen = mobileDetector.isMobile() && height < this.initialHeight * 0.75;

    return {
      width,
      height,
      availableHeight,
      isKeyboardOpen,
    };
  }

  private setupListeners(): void {
    if (typeof window === 'undefined') return;

    const handleResize = () => {
      const newViewportInfo = this.calculateViewportInfo();
      const hasChanged = JSON.stringify(this.viewportInfo) !== JSON.stringify(newViewportInfo);
      
      if (hasChanged) {
        this.viewportInfo = newViewportInfo;
        this.notifyListeners();
      }
    };

    window.addEventListener('resize', handleResize);
    window.addEventListener('orientationchange', () => {
      setTimeout(handleResize, 100);
    });
  }

  private notifyListeners(): void {
    this.listeners.forEach(listener => listener(this.viewportInfo));
  }

  public getViewportInfo(): ViewportInfo {
    return { ...this.viewportInfo };
  }

  public onViewportChange(callback: (viewportInfo: ViewportInfo) => void): () => void {
    this.listeners.push(callback);
    
    // Immediately call with current viewport info
    callback(this.viewportInfo);

    // Return unsubscribe function
    return () => {
      const index = this.listeners.indexOf(callback);
      if (index > -1) {
        this.listeners.splice(index, 1);
      }
    };
  }

  public isKeyboardOpen(): boolean {
    return this.viewportInfo.isKeyboardOpen;
  }

  public getAvailableHeight(): number {
    return this.viewportInfo.availableHeight;
  }
}

// Singleton instance
export const viewportManager = ViewportManager.getInstance();