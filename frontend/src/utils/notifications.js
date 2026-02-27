// Notification utilities with sound and push notifications

// Request permission for push notifications
export const requestNotificationPermission = async () => {
  if (!('Notification' in window)) {
    console.log('This browser does not support notifications');
    return false;
  }
  
  if (Notification.permission === 'granted') {
    return true;
  }
  
  if (Notification.permission !== 'denied') {
    const permission = await Notification.requestPermission();
    return permission === 'granted';
  }
  
  return false;
};

// Play notification sound
export const playNotificationSound = () => {
  try {
    // Create audio context for sound
    const audioContext = new (window.AudioContext || window.webkitAudioContext)();
    
    // Create oscillator for notification beep
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();
    
    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);
    
    oscillator.frequency.value = 800; // Hz
    oscillator.type = 'sine';
    
    gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.3);
    
    oscillator.start(audioContext.currentTime);
    oscillator.stop(audioContext.currentTime + 0.3);
    
    // Second beep
    setTimeout(() => {
      const oscillator2 = audioContext.createOscillator();
      const gainNode2 = audioContext.createGain();
      
      oscillator2.connect(gainNode2);
      gainNode2.connect(audioContext.destination);
      
      oscillator2.frequency.value = 1000; // Hz
      oscillator2.type = 'sine';
      
      gainNode2.gain.setValueAtTime(0.3, audioContext.currentTime);
      gainNode2.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.3);
      
      oscillator2.start(audioContext.currentTime);
      oscillator2.stop(audioContext.currentTime + 0.3);
    }, 150);
    
  } catch (err) {
    console.log('Could not play notification sound:', err);
  }
};

// Show browser push notification
export const showPushNotification = (title, body, options = {}) => {
  if (!('Notification' in window)) return;
  
  if (Notification.permission === 'granted') {
    const notification = new Notification(title, {
      body,
      icon: '/logo192.png',
      badge: '/logo192.png',
      tag: options.tag || 'default',
      requireInteraction: options.requireInteraction || false,
      ...options
    });
    
    notification.onclick = () => {
      window.focus();
      if (options.onClick) options.onClick();
      notification.close();
    };
    
    // Auto close after 10 seconds
    setTimeout(() => notification.close(), 10000);
    
    return notification;
  }
};

// Combined notification function
export const sendNotification = async (title, body, options = {}) => {
  // Play sound
  playNotificationSound();
  
  // Show push notification if tab is not focused or browser minimized
  if (document.hidden || !document.hasFocus()) {
    await requestNotificationPermission();
    showPushNotification(title, body, options);
  }
};

// Check if page is visible
export const isPageVisible = () => {
  return !document.hidden && document.hasFocus();
};
