import '@testing-library/jest-dom';
import L from 'leaflet';

// Polyfill window.matchMedia for JSDOM
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: (query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false,
  }),
});

// Polyfill scrollIntoView
if (!Element.prototype.scrollIntoView) {
  Element.prototype.scrollIntoView = () => {};
}

// Polyfill ResizeObserver for Recharts / ResponsiveContainer in JSDOM
class ResizeObserverMock {
  observe() {}
  unobserve() {}
  disconnect() {}
}

if (typeof window.ResizeObserver === 'undefined') {
  (window as any).ResizeObserver = ResizeObserverMock;
}

// Safe Leaflet vector path mocking for headless JSDOM environments
if (L && L.Path && L.Path.prototype) {
  L.Path.prototype.beforeAdd = function () {
    return this;
  };
  L.Path.prototype.onAdd = function (map: any) {
    this._map = map;
    return this;
  };
  L.Path.prototype.onRemove = function () {
    return this;
  };
  L.Path.prototype.redraw = function () {
    return this;
  };
  L.Path.prototype.setStyle = function () {
    return this;
  };
}
