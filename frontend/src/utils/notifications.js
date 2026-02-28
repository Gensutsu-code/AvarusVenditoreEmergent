// Notification utilities with sound and push notifications

let audioCtx = null;

const getAudioContext = () => {
  if (!audioCtx || audioCtx.state === 'closed') {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  }
  if (audioCtx.state === 'suspended') {
    audioCtx.resume();
  }
  return audioCtx;
};

// Request permission for push notifications
export const requestNotificationPermission = async () => {
  if (!('Notification' in window)) return false;
  if (Notification.permission === 'granted') return true;
  if (Notification.permission !== 'denied') {
    const permission = await Notification.requestPermission();
    return permission === 'granted';
  }
  return false;
};

// Play notification sound — two-tone chime
export const playNotificationSound = () => {
  try {
    const ctx = getAudioContext();
    const now = ctx.currentTime;

    const playTone = (freq, start, duration, vol) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.frequency.value = freq;
      osc.type = 'sine';
      gain.gain.setValueAtTime(vol, start);
      gain.gain.exponentialRampToValueAtTime(0.001, start + duration);
      osc.start(start);
      osc.stop(start + duration);
    };

    // Two-tone ascending chime
    playTone(880, now, 0.15, 0.25);
    playTone(1320, now + 0.15, 0.2, 0.2);
  } catch (err) {
    console.log('Could not play notification sound:', err);
  }
};

// Show browser push notification
export const showPushNotification = (title, body, options = {}) => {
  if (!('Notification' in window) || Notification.permission !== 'granted') return;

  const notification = new Notification(title, {
    body,
    icon: '/logo192.png',
    badge: '/logo192.png',
    tag: options.tag || 'default',
    requireInteraction: false,
    ...options
  });

  notification.onclick = () => {
    window.focus();
    if (options.onClick) options.onClick();
    notification.close();
  };

  setTimeout(() => notification.close(), 8000);
  return notification;
};

// Combined notification function
export const sendNotification = async (title, body, options = {}) => {
  playNotificationSound();
  if (document.hidden) {
    await requestNotificationPermission();
    showPushNotification(title, body, options);
  }
};

export const isPageVisible = () => !document.hidden && document.hasFocus();
