import { useState, useEffect } from 'react';

// Improved scroll direction hook with hysteresis and lockout to avoid jitter
const useScrollDirection = (threshold = 50, lockMs = 500, topTolerance = 20) => {
  const [scrollDirection, setScrollDirection] = useState('up');
  const [isScrolled, setIsScrolled] = useState(false);

  useEffect(() => {
    let lastScrollY = window.pageYOffset || 0;
    let ticking = false;
    let currentDirection = 'up';
    let accumDelta = 0;
    let idleTimer = 0;
    let lastSwitchAt = 0;

    const updateScrollDirection = () => {
      const scrollY = window.pageYOffset || 0;
      const now = Date.now();
      const rawDirection = scrollY > lastScrollY ? 'down' : 'up';

      // Accumulate small changes so slow moves still switch after surpassing threshold cumulatively
      const delta = scrollY - lastScrollY;
      accumDelta += delta;
      const absAccum = Math.abs(accumDelta);

      // Near-top bounce: force UP and reset accum
      if (scrollY <= topTolerance) {
        if (currentDirection !== 'up') {
          currentDirection = 'up';
          setScrollDirection('up');
          lastSwitchAt = now;
        }
        accumDelta = 0;
      } else if (rawDirection !== currentDirection && absAccum >= threshold) {
        // Hysteresis/lock: avoid switching too frequently
        if (now - lastSwitchAt >= lockMs) {
          currentDirection = rawDirection;
          setScrollDirection(rawDirection);
          lastSwitchAt = now;
          accumDelta = 0; // reset once we switch
        }
      }

      setIsScrolled(scrollY > 0);
      lastScrollY = scrollY > 0 ? scrollY : 0;
      ticking = false;
    };

    const onScroll = () => {
      if (!ticking) {
        requestAnimationFrame(updateScrollDirection);
        ticking = true;
      }
      // On each scroll event, restart an idle timer. When scrolling stops, finalize even if under threshold
      if (idleTimer) clearTimeout(idleTimer);
      idleTimer = setTimeout(() => {
        const now = Date.now();
        if (accumDelta !== 0) {
          const direction = accumDelta > 0 ? 'down' : 'up';
          // Only finalize if enough delta or we're outside lock window
          if (Math.abs(accumDelta) >= Math.max(6, threshold * 0.6) && now - lastSwitchAt >= lockMs) {
            if (direction !== currentDirection) {
              currentDirection = direction;
              setScrollDirection(direction);
              lastSwitchAt = now;
            }
          }
          accumDelta = 0;
        }
      }, 180);
    };

    window.addEventListener('scroll', onScroll, { passive: true });

    return () => {
      window.removeEventListener('scroll', onScroll);
      if (idleTimer) clearTimeout(idleTimer);
    };
  }, [threshold, lockMs, topTolerance]);

  return { scrollDirection, isScrolled };
};

export default useScrollDirection;
