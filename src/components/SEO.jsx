import React from 'react';
import { Helmet } from 'react-helmet-async';

/*
  Reusable SEO component
  Usage:
  <SEO
    title="Page Title"
    description="Short description of the page"
    canonical="https://yourdomain.com/path"
    image="https://yourdomain.com/og-image.jpg"
    type="product" // or 'website', 'article'
    jsonLd={{
      '@context': 'https://schema.org',
      '@type': 'Product',
      name: 'Product Name',
      image: ['https://yourdomain.com/image.jpg'],
      description: 'Product description',
      offers: { '@type': 'Offer', priceCurrency: 'INR', price: '199', availability: 'https://schema.org/InStock' }
    }}
  />
*/

const SITE_NAME = 'Sri Amman Smart Store';
const DEFAULT_DESCRIPTION = 'Shop groceries and daily essentials online from Sri Amman Smart Store. Fast delivery, best prices, and secure payment options.';

export default function SEO({
  title,
  description = DEFAULT_DESCRIPTION,
  canonical,
  image,
  type = 'website',
  jsonLd
}) {
  const fullTitle = title ? `${title} | ${SITE_NAME}` : SITE_NAME;
  return (
    <Helmet>
      <title>{fullTitle}</title>
      {description && <meta name="description" content={description} />}
      <meta name="application-name" content={SITE_NAME} />
      <meta name="theme-color" content="#388e3c" />
      <meta name="robots" content="index,follow" />

      {/* Open Graph */}
      <meta property="og:site_name" content={SITE_NAME} />
      <meta property="og:title" content={fullTitle} />
      {description && <meta property="og:description" content={description} />}
      <meta property="og:type" content={type} />
      {canonical && <meta property="og:url" content={canonical} />}
      {image && <meta property="og:image" content={image} />}

      {/* Twitter */}
      <meta name="twitter:card" content={image ? 'summary_large_image' : 'summary'} />
      <meta name="twitter:title" content={fullTitle} />
      {description && <meta name="twitter:description" content={description} />}
      {image && <meta name="twitter:image" content={image} />}

      {/* Canonical */}
      {canonical && <link rel="canonical" href={canonical} />}

      {/* JSON-LD */}
      {jsonLd && (
        <script type="application/ld+json">
          {JSON.stringify(jsonLd)}
        </script>
      )}
    </Helmet>
  );
}
