import { describe, it, expect } from 'vitest';
import { isValidElement } from 'react';
import { linkifyText } from './linkify';

describe('linkifyText', () => {
  it('returns plain text as a single string segment when there is no URL', () => {
    const nodes = linkifyText('No links here.');
    expect(nodes).toHaveLength(1);
    expect(nodes[0]).toBe('No links here.');
  });

  it('turns an https URL into an anchor with noreferrer', () => {
    const nodes = linkifyText('See https://example.com/path for details.');
    expect(nodes.length).toBeGreaterThan(1);
    const anchorish = nodes.find((n) => isValidElement(n));
    expect(anchorish).toBeDefined();
    if (!isValidElement(anchorish)) return;
    // The shared helper wraps the <a> in a <span>; walk children for the anchor props.
    const props = anchorish.props as { children?: unknown };
    const child = Array.isArray(props.children)
      ? props.children.find((c) => isValidElement(c) && c.type === 'a')
      : isValidElement(props.children) && props.children.type === 'a'
        ? props.children
        : null;
    expect(child).toBeTruthy();
    if (!isValidElement(child)) return;
    const aProps = child.props as { href: string; rel: string; target: string };
    expect(aProps.href).toBe('https://example.com/path');
    expect(aProps.rel).toMatch(/noreferrer/);
    expect(aProps.target).toBe('_blank');
  });
});
