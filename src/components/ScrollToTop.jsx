import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';

const ScrollToTop = () => {
  const { pathname } = useLocation();

  useEffect(() => {
    try {
      window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
      // Fallbacks for older browsers
      document.body.scrollTop = 0;
      document.documentElement.scrollTop = 0;
    } catch (_) {}
  }, [pathname]);

  return null;
};

export default ScrollToTop;
