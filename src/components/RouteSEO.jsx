import React from 'react';
import { Helmet } from 'react-helmet-async';
import { useLocation } from 'react-router-dom';

// Global per-route canonical handler
// Uses the requested domain for all pages
const BASE_URL = 'https://www.sriammansmartstore.in';

export default function RouteSEO() {
  const location = useLocation();
  const canonical = `${BASE_URL}${location.pathname || ''}${location.search || ''}`;

  return (
    <Helmet>
      <link rel="canonical" href={canonical} />
      <meta property="og:url" content={canonical} />
    </Helmet>
  );
}
