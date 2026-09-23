import React from 'react';
import { Helmet } from 'react-helmet-async';
import { useLocation, matchPath } from 'react-router-dom';

const SITE_NAME = 'Sri Amman Smart Store';
const DEFAULT_DESC = 'Shop groceries and daily essentials online from Sri Amman Smart Store. Fast delivery, best prices, and secure payment options.';

function getMeta(pathname) {
  // Order matters: first match wins
  const rules = [
    { pattern: '/', title: 'Online Grocery & Essentials', desc: DEFAULT_DESC },
    { pattern: '/categories', title: 'Shop by Categories', desc: 'Browse all grocery and essentials categories.' },
    { pattern: '/category/:category', title: 'Category', desc: 'Discover products in this category at great prices.' },
    { pattern: '/product/:category/:id', title: 'Product Details', desc: 'View product details, price, and reviews.' },
    { pattern: '/cart', title: 'Your Cart', desc: 'Review the items in your shopping cart.', robots: 'noindex,nofollow' },
    { pattern: '/checkout', title: 'Checkout', desc: 'Secure checkout with multiple payment options.', robots: 'noindex,nofollow' },
    { pattern: '/login', title: 'Login', desc: 'Login to your Sri Amman Smart Store account.' },
    { pattern: '/signup', title: 'Sign Up', desc: 'Create your account to start shopping.' },
    { pattern: '/about', title: 'About Us', desc: 'Learn about Sri Amman Smart Store and our mission.' },
    { pattern: '/contact', title: 'Contact Us', desc: 'Get in touch with Sri Amman Smart Store support.' },
    { pattern: '/privacy', title: 'Privacy Policy', desc: 'Read our privacy policy and data practices.' },
    { pattern: '/terms', title: 'Terms & Conditions', desc: 'Read our terms and conditions.' },
    { pattern: '/refund-cancellation', title: 'Refund & Cancellation Policy', desc: 'Understand our refund and cancellation policy.' },
    { pattern: '/shipping', title: 'Shipping Policy', desc: 'Learn about shipping methods and timelines.' },
    { pattern: '/return', title: 'Return Policy', desc: 'Learn how returns work at Sri Amman Smart Store.' },
    { pattern: '/orders', title: 'My Orders', desc: 'View and track your orders.' },
    { pattern: '/wishlist', title: 'My Wishlist', desc: 'View and manage your wishlist.' },
  ];

  for (const r of rules) {
    if (matchPath({ path: r.pattern, end: false }, pathname)) {
      return r;
    }
  }
  return { title: SITE_NAME, desc: DEFAULT_DESC };
}

export default function GlobalPageSEO() {
  const { pathname } = useLocation();
  const meta = getMeta(pathname);
  const fullTitle = meta.title ? `${meta.title} | ${SITE_NAME}` : SITE_NAME;
  const robots = meta.robots || 'index,follow';

  return (
    <Helmet>
      <title>{fullTitle}</title>
      <meta name="description" content={meta.desc || DEFAULT_DESC} />
      <meta name="robots" content={robots} />
      <meta property="og:title" content={fullTitle} />
      <meta property="og:description" content={meta.desc || DEFAULT_DESC} />
      <meta name="twitter:title" content={fullTitle} />
      <meta name="twitter:description" content={meta.desc || DEFAULT_DESC} />
    </Helmet>
  );
}
