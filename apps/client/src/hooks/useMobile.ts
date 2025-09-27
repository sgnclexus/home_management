import { useState, useEffect, useRef, useCallback } from 'react';
import {
  mobileDetector,
  viewportManager,
  TouchGestureHandler,
  mobilePerformanceOptimizer,
  DeviceInfo,
  ViewportInfo,
  TouchGesture,
} from '../utils/mobile';

// Hook for device detection
export function useDeviceDetection() {
  const [deviceInfo, setDeviceInfo] = useState<DeviceInfo>(mobileDetector.getDeviceInfo());

  useEffect(() => {
    const unsubscribe = mobileDetector.onDeviceChange(setDeviceInfo);
    return unsubscribe;
  }, []);

  return deviceInfo;
}

// Hook for viewport management
export function useViewport() {
  const [viewportInfo, setViewportInfo] = useState<ViewportInfo>(viewportManager.getViewportInfo());

  useEffect(() => {
    const unsubscribe = viewportManager.onViewportChange(setViewportInfo);
    return unsubscribe;
  }, []);

  return viewportInfo;
}

// Hook for touch gestures
export function useTouchGestures(elementRef: React.RefObject<HTMLElement>) {
  const gestureHandlerRef = useRef<TouchGestureHandler | null>(null);
  const [gestures, setGestures] = useState<TouchGesture[]>([]);

  const onGesture = useCallback((callback: (gesture: TouchGesture) => void, type: string = '*') => {
    if (!gestureHandlerRef.current) return () => {};
    
    return gestureHandlerRef.current.onGesture(type, callback);
  }, []);

  useEffect(() => {
    if (elementRef.current && !gestureHandlerRef.current) {
      gestureHandlerRef.current = new TouchGestureHandler(elementRef.current);
      
      // Track all gestures for debugging/analytics
      gestureHandlerRef.current.onGesture('*', (gesture) => {
        setGestures(prev => [...prev.slice(-9), gesture]); // Keep last 10 gestures
      });
    }

    return () => {
      if (gestureHandlerRef.current) {
        gestureHandlerRef.current.destroy();
        gestureHandlerRef.current = null;
      }
    };
  }, [elementRef]);

  return {
    onGesture,
    recentGestures: gestures,
  };
}

// Hook for responsive breakpoints
export function useBreakpoint() {
  const { screenSize } = useDeviceDetection();
  
  const breakpoints = {
    sm: screenSize === 'sm',
    md: screenSize === 'md',
    lg: screenSize === 'lg',
    xl: screenSize === 'xl',
    '2xl': screenSize === '2xl',
    mobile: screenSize === 'sm' || screenSize === 'md',
    tablet: screenSize === 'lg',
    desktop: screenSize === 'xl' || screenSize === '2xl',
  };

  return breakpoints;
}

// Hook for mobile-optimized scrolling
export function useMobileScroll(options: {
  onScroll?: () => void;
  onScrollEnd?: () => void;
  throttleDelay?: number;
} = {}) {
  const { onScroll, onScrollEnd, throttleDelay = 16 } = options;
  const scrollTimeoutRef = useRef<NodeJS.Timeout>();
  const isScrollingRef = useRef(false);

  const handleScroll = useCallback(() => {
    if (onScroll) {
      onScroll();
    }

    isScrollingRef.current = true;

    // Clear existing timeout
    if (scrollTimeoutRef.current) {
      clearTimeout(scrollTimeoutRef.current);
    }

    // Set new timeout for scroll end detection
    scrollTimeoutRef.current = setTimeout(() => {
      isScrollingRef.current = false;
      if (onScrollEnd) {
        onScrollEnd();
      }
    }, 150);
  }, [onScroll, onScrollEnd]);

  const throttledScrollHandler = useCallback(
    mobilePerformanceOptimizer.debounceScroll(handleScroll, throttleDelay),
    [handleScroll, throttleDelay]
  );

  useEffect(() => {
    return () => {
      if (scrollTimeoutRef.current) {
        clearTimeout(scrollTimeoutRef.current);
      }
    };
  }, []);

  return {
    onScroll: throttledScrollHandler,
    isScrolling: isScrollingRef.current,
  };
}

// Hook for mobile-friendly form handling
export function useMobileForm() {
  const { isKeyboardOpen } = useViewport();
  const [focusedField, setFocusedField] = useState<string | null>(null);

  const handleFieldFocus = useCallback((fieldName: string) => {
    setFocusedField(fieldName);
    
    // Scroll focused field into view on mobile
    if (mobileDetector.isMobile()) {
      setTimeout(() => {
        const element = document.querySelector(`[name="${fieldName}"]`) as HTMLElement;
        if (element) {
          element.scrollIntoView({ 
            behavior: 'smooth', 
            block: 'center',
            inline: 'nearest'
          });
        }
      }, 300); // Wait for keyboard animation
    }
  }, []);

  const handleFieldBlur = useCallback(() => {
    setFocusedField(null);
  }, []);

  return {
    isKeyboardOpen,
    focusedField,
    onFieldFocus: handleFieldFocus,
    onFieldBlur: handleFieldBlur,
    shouldAdjustLayout: isKeyboardOpen && focusedField !== null,
  };
}

// Hook for mobile navigation
export function useMobileNavigation() {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const { isMobile } = useDeviceDetection();

  const toggleMenu = useCallback(() => {
    setIsMenuOpen(prev => !prev);
  }, []);

  const closeMenu = useCallback(() => {
    setIsMenuOpen(false);
  }, []);

  const openMenu = useCallback(() => {
    setIsMenuOpen(true);
  }, []);

  // Close menu when switching to desktop
  useEffect(() => {
    if (!isMobile && isMenuOpen) {
      setIsMenuOpen(false);
    }
  }, [isMobile, isMenuOpen]);

  // Prevent body scroll when menu is open on mobile
  useEffect(() => {
    if (isMobile && isMenuOpen) {
      document.body.style.overflow = 'hidden';
      return () => {
        document.body.style.overflow = '';
      };
    }
  }, [isMobile, isMenuOpen]);

  return {
    isMenuOpen,
    toggleMenu,
    closeMenu,
    openMenu,
    isMobile,
  };
}

// Hook for mobile-optimized images
export function useMobileImages() {
  const { screenSize } = useDeviceDetection();

  const getOptimizedImageSrc = useCallback((baseSrc: string, sizes?: {
    sm?: string;
    md?: string;
    lg?: string;
    xl?: string;
    '2xl'?: string;
  }) => {
    if (!sizes) return baseSrc;

    switch (screenSize) {
      case 'sm':
        return sizes.sm || baseSrc;
      case 'md':
        return sizes.md || sizes.sm || baseSrc;
      case 'lg':
        return sizes.lg || sizes.md || sizes.sm || baseSrc;
      case 'xl':
        return sizes.xl || sizes.lg || sizes.md || baseSrc;
      case '2xl':
        return sizes['2xl'] || sizes.xl || sizes.lg || baseSrc;
      default:
        return baseSrc;
    }
  }, [screenSize]);

  const setupLazyLoading = useCallback(() => {
    mobilePerformanceOptimizer.setupLazyLoading();
  }, []);

  return {
    getOptimizedImageSrc,
    setupLazyLoading,
    currentScreenSize: screenSize,
  };
}

// Hook for mobile performance monitoring
export function useMobilePerformance() {
  const [performanceMetrics, setPerformanceMetrics] = useState({
    loadTime: 0,
    renderTime: 0,
    interactionTime: 0,
  });

  useEffect(() => {
    // Measure initial load time
    if (typeof window !== 'undefined' && window.performance) {
      const loadTime = window.performance.timing.loadEventEnd - window.performance.timing.navigationStart;
      setPerformanceMetrics(prev => ({ ...prev, loadTime }));
    }
  }, []);

  const measureRenderTime = useCallback((startTime: number) => {
    const renderTime = performance.now() - startTime;
    setPerformanceMetrics(prev => ({ ...prev, renderTime }));
    return renderTime;
  }, []);

  const measureInteractionTime = useCallback((startTime: number) => {
    const interactionTime = performance.now() - startTime;
    setPerformanceMetrics(prev => ({ ...prev, interactionTime }));
    return interactionTime;
  }, []);

  return {
    performanceMetrics,
    measureRenderTime,
    measureInteractionTime,
  };
}

// Hook for mobile-specific animations
export function useMobileAnimations() {
  const { isMobile, isTouchDevice } = useDeviceDetection();

  const getAnimationConfig = useCallback((type: 'slide' | 'fade' | 'scale' | 'bounce') => {
    // Reduce animations on mobile for better performance
    const baseConfig = {
      slide: {
        duration: isMobile ? 200 : 300,
        easing: 'ease-out',
      },
      fade: {
        duration: isMobile ? 150 : 250,
        easing: 'ease-in-out',
      },
      scale: {
        duration: isMobile ? 100 : 200,
        easing: 'ease-out',
      },
      bounce: {
        duration: isMobile ? 300 : 500,
        easing: 'cubic-bezier(0.68, -0.55, 0.265, 1.55)',
      },
    };

    return baseConfig[type];
  }, [isMobile]);

  const shouldReduceMotion = useCallback(() => {
    if (typeof window === 'undefined') return false;
    
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  }, []);

  return {
    getAnimationConfig,
    shouldReduceMotion: shouldReduceMotion(),
    isTouchDevice,
    preferFastAnimations: isMobile,
  };
}