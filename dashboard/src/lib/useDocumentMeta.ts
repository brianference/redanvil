import { useEffect } from 'react';

const SITE_ORIGIN = 'https://redanvil-dashboard.pages.dev';

export interface DocumentMeta {
  /** Document title (browser tab). */
  title: string;
  /** Meta description content. */
  description: string;
  /** Path only (e.g. "/about"); used for the canonical URL. */
  path: string;
}

/**
 * Ensure a meta tag with the given name or property exists and has content.
 *
 * @param attr - Attribute name to match ("name" or "property").
 * @param key - Attribute value (e.g. "description", "og:title").
 * @param content - Content to set.
 */
function setMeta(attr: 'name' | 'property', key: string, content: string): void {
  const selector = `meta[${attr}="${key}"]`;
  let el = document.head.querySelector(selector);
  if (el === null) {
    el = document.createElement('meta');
    el.setAttribute(attr, key);
    document.head.appendChild(el);
  }
  el.setAttribute('content', content);
}

/**
 * Ensure a canonical link exists and points at the absolute URL for this path.
 *
 * @param href - Absolute canonical URL.
 */
function setCanonical(href: string): void {
  let el = document.head.querySelector('link[rel="canonical"]');
  if (el === null) {
    el = document.createElement('link');
    el.setAttribute('rel', 'canonical');
    document.head.appendChild(el);
  }
  el.setAttribute('href', href);
}

/**
 * Set per-route document title, description, OG tags, and canonical URL at runtime.
 * Safe for SPAs — call once per page mount with that route's meta.
 *
 * @param meta - Title, description, and path for the current route.
 */
export function useDocumentMeta(meta: DocumentMeta): void {
  useEffect(() => {
    const path = meta.path.startsWith('/') ? meta.path : `/${meta.path}`;
    const canonical = `${SITE_ORIGIN}${path === '/' ? '/' : path}`;

    document.title = meta.title;
    setMeta('name', 'description', meta.description);
    setMeta('property', 'og:title', meta.title);
    setMeta('property', 'og:description', meta.description);
    setMeta('property', 'og:url', canonical);
    setCanonical(canonical);
  }, [meta.title, meta.description, meta.path]);
}
