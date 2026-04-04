let intervalId = null;

/**
 * ocrWorker.js
 * 
 * Used to provide a stable 'tick' in the background.
 * Main thread setInterval is throttled to 1s-1min when backgrounded.
 * Web Worker setInterval is generally more stable.
 */
self.onmessage = function(e) {
  const { action, interval } = e.data;

  if (action === 'start') {
    if (intervalId) clearInterval(intervalId);
    
    // Default to 500ms if not provided
    const tickInterval = interval || 500;
    
    intervalId = setInterval(() => {
      self.postMessage({ type: 'tick', timestamp: Date.now() });
    }, tickInterval);
    
  } else if (action === 'stop') {
    if (intervalId) clearInterval(intervalId);
    intervalId = null;
  }
};
