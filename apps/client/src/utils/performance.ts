import { getPerformance } from 'firebase/performance';
import { app } from '../config/firebase.config';

// Initialize Firebase Performance
const perf = getPerformance(app);

export class PerformanceMonitor {
  private static traces: Map<string, any> = new Map();

  static startTrace(name: string) {
    if (typeof window !== 'undefined' && perf) {
      const trace = perf.trace(name);
      trace.start();
      this.traces.set(name, trace);
      return trace;
    }
  }

  static stopTrace(name: string) {
    const trace = this.traces.get(name);
    if (trace) {
      trace.stop();
      this.traces.delete(name);
    }
  }

  static recordMetric(traceName: string, metricName: string, value: number) {
    const trace = this.traces.get(traceName);
    if (trace) {
      trace.putMetric(metricName, value);
    }
  }

  // Monitor API calls
  static monitorApiCall(url: string, method: string) {
    const traceName = `api_${method.toLowerCase()}_${url.replace(/[^a-zA-Z0-9]/g, '_')}`;
    return this.startTrace(traceName);
  }

  // Monitor component render times
  static monitorComponentRender(componentName: string) {
    return this.startTrace(`component_render_${componentName}`);
  }

  // Monitor page load times
  static monitorPageLoad(pageName: string) {
    return this.startTrace(`page_load_${pageName}`);
  }
}

// Web Vitals monitoring
export const measureWebVitals = (metric: any) => {
  if (typeof window !== 'undefined') {
    console.log('Web Vital:', metric);
    
    // Send to Firebase Performance or analytics
    if (perf) {
      const trace = perf.trace(`web_vital_${metric.name}`);
      trace.start();
      trace.putMetric('value', metric.value);
      trace.stop();
    }
  }
};