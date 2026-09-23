import React, { useEffect, useRef, useState } from 'react';
import { LinearProgress } from '@mui/material';

const withPullToRefresh = (WrappedComponent, onRefreshCallback) => {
  return function WithPullToRefreshComponent(props) {
    const [isRefreshing, setIsRefreshing] = useState(false);
    const pullState = useRef({ startY: 0, pulling: false });

    useEffect(() => {
      const onTouchStart = (e) => {
        if (window.scrollY === 0 && !isRefreshing) {
          pullState.current.startY = e.touches[0].clientY;
          pullState.current.pulling = true;
        }
      };

      const onTouchMove = (e) => {
        if (!pullState.current.pulling) return;
        const delta = e.touches[0].clientY - pullState.current.startY;
        if (delta < 0) {
          pullState.current.pulling = false;
        }
      };

      const onTouchEnd = async () => {
        if (!pullState.current.pulling) return;
        pullState.current.pulling = false;
        
        setIsRefreshing(true);
        if (typeof onRefreshCallback === 'function') {
          try {
            await onRefreshCallback();
          } catch (error) {
            console.error('Error during refresh:', error);
          }
        }
        setIsRefreshing(false);
      };

      window.addEventListener('touchstart', onTouchStart, { passive: true });
      window.addEventListener('touchmove', onTouchMove, { passive: true });
      window.addEventListener('touchend', onTouchEnd, { passive: true });

      return () => {
        window.removeEventListener('touchstart', onTouchStart);
        window.removeEventListener('touchmove', onTouchMove);
        window.removeEventListener('touchend', onTouchEnd);
      };
    }, [isRefreshing, onRefreshCallback]);

    return (
      <div style={{ position: 'relative' }}>
        {isRefreshing && (
          <div style={{ position: 'absolute', left: 0, right: 0, top: 0, zIndex: 1000 }}>
            <LinearProgress />
          </div>
        )}
        <WrappedComponent {...props} isRefreshing={isRefreshing} />
      </div>
    );
  };
};

export default withPullToRefresh;