/**
 * User activity tracker — sends events + browser fingerprint to /api/track
 */
const API = process.env.REACT_APP_BACKEND_URL;
let eventQueue = [];
let flushTimer = null;
let currentPage = null;
let pageEnteredAt = null;
let fingerprintSent = false;

let authed = false;
export const setTrackerAuth = (value) => { authed = value; };
const getToken = () => authed;

const getFingerprint = () => {
  if (fingerprintSent) return null;
  fingerprintSent = true;
  const nav = navigator;
  const ua = nav.userAgent || '';
  let browser = 'Unknown', browserVersion = '', os = 'Unknown', osVersion = '', device = 'Desktop';

  // Parse browser
  if (ua.includes('Firefox/')) { browser = 'Firefox'; browserVersion = ua.match(/Firefox\/([\d.]+)/)?.[1] || ''; }
  else if (ua.includes('Edg/')) { browser = 'Edge'; browserVersion = ua.match(/Edg\/([\d.]+)/)?.[1] || ''; }
  else if (ua.includes('Chrome/')) { browser = 'Chrome'; browserVersion = ua.match(/Chrome\/([\d.]+)/)?.[1] || ''; }
  else if (ua.includes('Safari/') && !ua.includes('Chrome')) { browser = 'Safari'; browserVersion = ua.match(/Version\/([\d.]+)/)?.[1] || ''; }

  // Parse OS
  if (ua.includes('Windows')) { os = 'Windows'; osVersion = ua.match(/Windows NT ([\d.]+)/)?.[1] || ''; }
  else if (ua.includes('Mac OS')) { os = 'macOS'; osVersion = ua.match(/Mac OS X ([\d_]+)/)?.[1]?.replace(/_/g, '.') || ''; }
  else if (ua.includes('Android')) { os = 'Android'; osVersion = ua.match(/Android ([\d.]+)/)?.[1] || ''; device = 'Mobile'; }
  else if (ua.includes('iPhone') || ua.includes('iPad')) { os = 'iOS'; osVersion = ua.match(/OS ([\d_]+)/)?.[1]?.replace(/_/g, '.') || ''; device = ua.includes('iPad') ? 'Tablet' : 'Mobile'; }
  else if (ua.includes('Linux')) { os = 'Linux'; }

  if (/Mobi|Android|iPhone/.test(ua)) device = 'Mobile';
  else if (/iPad|Tablet/.test(ua)) device = 'Tablet';

  const conn = nav.connection || nav.mozConnection || nav.webkitConnection;

  return {
    user_agent: ua,
    browser,
    browser_version: browserVersion,
    os,
    os_version: osVersion,
    device,
    screen_resolution: `${screen.width}x${screen.height}`,
    viewport: `${window.innerWidth}x${window.innerHeight}`,
    language: nav.language || '',
    languages: Array.from(nav.languages || []),
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || '',
    timezone_offset: new Date().getTimezoneOffset(),
    platform: nav.platform || '',
    cookie_enabled: nav.cookieEnabled,
    do_not_track: nav.doNotTrack === '1',
    online: nav.onLine,
    connection_type: conn?.effectiveType || '',
    memory: nav.deviceMemory || 0,
    cores: nav.hardwareConcurrency || 0,
    touch_support: 'ontouchstart' in window || nav.maxTouchPoints > 0,
    referer: document.referrer || '',
  };
};

const flush = async () => {
  if (eventQueue.length === 0) return;
  const token = getToken();
  if (!token) { eventQueue = []; return; }

  const batch = [...eventQueue];
  eventQueue = [];
  const fingerprint = getFingerprint();

  try {
    await fetch(`${API}/api/track`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ events: batch, fingerprint })
    });
  } catch (err) {
    // Silently fail
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

export const trackPageView = (page) => {
  if (currentPage && pageEnteredAt) {
    const duration = Math.round((Date.now() - pageEnteredAt) / 1000);
    if (duration > 0 && duration < 3600) {
      push({ event_type: 'page_view', page: currentPage, duration });
    }
  }
  currentPage = page;
  pageEnteredAt = Date.now();
};

export const trackSearch = (query, page) => {
  if (!query || query.length < 2) return;
  push({ event_type: 'search', query, page: page || currentPage });
};

export const trackClick = (element, page) => {
  push({ event_type: 'button_click', element, page: page || currentPage });
};

if (typeof window !== 'undefined') {
  window.addEventListener('beforeunload', () => {
    if (currentPage && pageEnteredAt) {
      const duration = Math.round((Date.now() - pageEnteredAt) / 1000);
      if (duration > 0 && duration < 3600) {
        push({ event_type: 'page_view', page: currentPage, duration });
      }
    }
    const token = getToken();
    if (token && eventQueue.length > 0) {
      const fingerprint = getFingerprint();
      const data = JSON.stringify({ events: eventQueue, fingerprint });
      navigator.sendBeacon(`${API}/api/track`, new Blob([data], { type: 'application/json' }));
    }
  });
}
