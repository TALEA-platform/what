import "core-js/modules/es.array.at.js";
import "core-js/modules/es.array.flat.js";
import "core-js/modules/es.array.flat-map.js";
import "core-js/modules/es.object.from-entries.js";
import "core-js/modules/es.object.has-own.js";
import "core-js/modules/es.promise.all-settled.js";
import "core-js/modules/es.string.replace-all.js";

if (typeof window.queueMicrotask !== "function") {
  window.queueMicrotask = (callback) => Promise.resolve().then(callback);
}

// MediaQueryList only exposed addListener/removeListener on iOS 13.3.
if (typeof window.matchMedia === "function") {
  const nativeMatchMedia = window.matchMedia.bind(window);
  window.matchMedia = (query) => {
    const result = nativeMatchMedia(query);
    if (typeof result.addEventListener !== "function") {
      result.addEventListener = (type, listener) => {
        if (type === "change") result.addListener(listener);
      };
      result.removeEventListener = (type, listener) => {
        if (type === "change") result.removeListener(listener);
      };
    }
    return result;
  };
}

// ResizeObserver arrived after iOS 13.3. The story only uses it to remeasure
// responsive layout; a window/orientation-driven observer preserves that
// contract without polling or a permanent animation frame.
if (typeof window.ResizeObserver !== "function") {
  window.ResizeObserver = class LegacySafariResizeObserver {
    constructor(callback) {
      this.callback = callback;
      this.targets = [];
      this.frame = 0;
      this.handleResize = () => {
        if (this.frame) return;
        this.frame = requestAnimationFrame(() => {
          this.frame = 0;
          this.notify();
        });
      };
    }

    observe(target) {
      if (!this.targets.includes(target)) this.targets.push(target);
      if (this.targets.length === 1) {
        window.addEventListener("resize", this.handleResize, false);
        window.addEventListener("orientationchange", this.handleResize, false);
      }
      this.handleResize();
    }

    unobserve(target) {
      this.targets = this.targets.filter((item) => item !== target);
      if (!this.targets.length) this.disconnect();
    }

    disconnect() {
      window.removeEventListener("resize", this.handleResize, false);
      window.removeEventListener("orientationchange", this.handleResize, false);
      if (this.frame) cancelAnimationFrame(this.frame);
      this.frame = 0;
      this.targets = [];
    }

    notify() {
      const entries = this.targets.map((target) => ({
        target,
        contentRect: target.getBoundingClientRect(),
      }));
      if (entries.length) this.callback(entries, this);
    }
  };
}
