// notificationSound.js
export function playNotificationSound() {
  try {
    // Try playing the notification sound
    const audio = new Audio('/notification.mp3');
    audio.volume = 1;
    const playPromise = audio.play();
    
    if (playPromise !== undefined) {
      playPromise
        .then(() => {
          console.log('Notification sound played successfully');
        })
        .catch((err) => {
          console.warn('Notification sound playback failed:', err);
          // Fallback: try a simple beep using Web Audio API
          playBeepSound();
        });
    }
  } catch (err) {
    console.warn('Error playing notification sound:', err);
    playBeepSound();
  }
}

function playBeepSound() {
  try {
    const audioContext = new (window.AudioContext || window.webkitAudioContext)();
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();
    
    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);
    
    oscillator.frequency.value = 800;
    oscillator.type = 'sine';
    
    gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.5);
    
    oscillator.start(audioContext.currentTime);
    oscillator.stop(audioContext.currentTime + 0.5);
    
    console.log('Fallback beep sound played');
  } catch (err) {
    console.warn('Beep sound also failed:', err);
  }
}
