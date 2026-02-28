/**
 * User activity tracker — sends events to /api/track
 */
const API = process.env.REACT_APP_BACKEND_URL;
let eventQueue = [];
let flushTimer = null;
let currentPage = null;
let pageEnteredAt = null;

const getToken = () => localStorage.getItem('token');

const flush = async () => {
  if (eventQueue.length === 0) return;
  const token = getToken();
  if (!token) { eventQueue = []; return; }

  const batch = [...eventQueue];
  eventQueue = [];

  try {
    await fetch(`${API}/api/track`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
      body: JSON.stringify({ events: batch })
    });
  } catch (err) {
    // Silently fail — analytics should not disrupt UX
  }
};

const scheduleFlush = () => {
  if (flushTimer) return;
  flushTimer = setTimeout(() => {
    flushTimer = null;
    flush();
  }, 5000);
};

const push = (event) => {
  eventQueue.push(event);
  if (eventQueue.length >= 10) {
    flush();
  } else {
    scheduleFlush();
  }
};

// Track page view
export const trackPageView = (page) => {
  // Send duration for previous page
  if (currentPage && pageEnteredAt) {
    const duration = Math.round((Date.now() - pageEnteredAt) / 1000);
    if (duration > 0 && duration < 3600) {
      push({ event_type: 'page_view', page: currentPage, duration });
    }
  }
  currentPage = page;
  pageEnteredAt = Date.now();
};

// Track search query
export const trackSearch = (query, page) => {
  if (!query || query.length < 2) return;
  push({ event_type: 'search', query, page: page || currentPage });
};

// Track button click
export const trackClick = (element, page) => {
  push({ event_type: 'button_click', element, page: page || currentPage });
};

// Flush on page unload
if (typeof window !== 'undefined') {
  window.addEventListener('beforeunload', () => {
    if (currentPage && pageEnteredAt) {
      const duration = Math.round((Date.now() - pageEnteredAt) / 1000);
      if (duration > 0 && duration < 3600) {
        push({ event_type: 'page_view', page: currentPage, duration });
      }
    }
    // Sync flush on unload
    const token = getToken();
    if (token && eventQueue.length > 0) {
      const data = JSON.stringify({ events: eventQueue });
      navigator.sendBeacon(`${API}/api/track`, new Blob([data], { type: 'application/json' }));
    }
  });
}
