import { useEffect } from 'react';

const CANONICAL = 'https://az-planting-calendar.pages.dev/';
const JSON_LD = {
  '@context': 'https://schema.org',
  '@type': 'WebApplication',
  name: 'AZ Planting Calendar',
  url: CANONICAL,
  description:
    'Arizona low-desert planting calendar for Cave Creek AZ 85331. Seed and transplant windows from University of Arizona Cooperative Extension az1005.',
  applicationCategory: 'LifestyleApplication',
  operatingSystem: 'Any',
  offers: {
    '@type': 'Offer',
    price: '0',
    priceCurrency: 'USD'
  }
};

/**
 * Inject absolute canonical + JSON-LD on the home surface (and keep them in head).
 * Per-app-pack requires application/ld+json with @context and @type, and an
 * absolute rel=canonical on home at minimum.
 */
export function StructuredData(): null {
  useEffect(() => {
    let canonical = document.querySelector('link[rel="canonical"]') as HTMLLinkElement | null;
    if (!canonical) {
      canonical = document.createElement('link');
      canonical.setAttribute('rel', 'canonical');
      document.head.appendChild(canonical);
    }
    canonical.setAttribute('href', CANONICAL);

    const existing = document.querySelector('script[type="application/ld+json"][data-app-ld]');
    if (!existing) {
      const script = document.createElement('script');
      script.type = 'application/ld+json';
      script.setAttribute('data-app-ld', 'true');
      script.textContent = JSON.stringify(JSON_LD);
      document.head.appendChild(script);
    }
  }, []);

  return null;
}
