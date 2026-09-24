// @vitest-environment jsdom
/**
 * The only thing that matters here is the off switch: no env var, no script,
 * no global, no network.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  analyticsDomain,
  installAnalytics,
  track,
  trackCrawlerView,
  trackCta,
  trackOutbound,
} from './analytics';

afterEach(() => {
  vi.unstubAllEnvs();
  document.getElementById('plausible-analytics')?.remove();
  delete window.plausible;
});

describe('analyticsDomain', () => {
  it('is null when the env var is unset or empty', () => {
    expect(analyticsDomain()).toBeNull();
    vi.stubEnv('VITE_PLAUSIBLE_DOMAIN', '');
    expect(analyticsDomain()).toBeNull();
  });

  it('is the configured domain otherwise', () => {
    vi.stubEnv('VITE_PLAUSIBLE_DOMAIN', 'dungeoncrawlcast.com');
    expect(analyticsDomain()).toBe('dungeoncrawlcast.com');
  });
});

describe('installAnalytics', () => {
  it('appends nothing when no domain is configured', () => {
    installAnalytics();
    expect(document.getElementById('plausible-analytics')).toBeNull();
    expect(window.plausible).toBeUndefined();
  });

  it('appends the outbound-links script once, tagged with the domain', () => {
    vi.stubEnv('VITE_PLAUSIBLE_DOMAIN', 'dungeoncrawlcast.com');
    installAnalytics();
    installAnalytics();
    const scripts = document.head.querySelectorAll('script#plausible-analytics');
    expect(scripts).toHaveLength(1);
    const script = scripts[0] as HTMLScriptElement;
    expect(script.src).toBe('https://plausible.io/js/script.outbound-links.js');
    expect(script.getAttribute('data-domain')).toBe('dungeoncrawlcast.com');
    expect(script.defer).toBe(true);
  });

  it('queues events fired before the script lands', () => {
    vi.stubEnv('VITE_PLAUSIBLE_DOMAIN', 'dungeoncrawlcast.com');
    installAnalytics();
    track('hub_open', { episode: 3 });
    expect(window.plausible?.q).toEqual([['hub_open', { props: { episode: 3 } }]]);
  });
});

describe('track', () => {
  it('does nothing at all when the script was never installed', () => {
    expect(() => track('crawler_view', { id: 'harry' })).not.toThrow();
    expect(window.plausible).toBeUndefined();
  });

  it('forwards the name, and props only when there are any', () => {
    const calls: unknown[][] = [];
    window.plausible = ((...args: unknown[]) => calls.push(args)) as typeof window.plausible;
    track('crawler_view', { id: 'harry' });
    track('hub_open');
    expect(calls).toEqual([['crawler_view', { props: { id: 'harry' } }], ['hub_open']]);
  });
});

/* --------------------------------------------- the three events (T1127) */

describe('the named events', () => {
  function spy(): unknown[][] {
    const calls: unknown[][] = [];
    window.plausible = ((...args: unknown[]) => calls.push(args)) as typeof window.plausible;
    return calls;
  }

  it('calls a hub CTA hub_open and a YouTube CTA outbound', () => {
    const calls = spy();
    trackCta({ kind: 'hub', href: '/ep/3', label: 'Open the System feed' }, 3);
    trackCta({ kind: 'youtube', href: 'https://youtu.be/x', label: 'Watch on YouTube' }, 3);
    expect(calls).toEqual([
      ['hub_open', { props: { episode: 3 } }],
      ['outbound', { props: { to: 'youtube', episode: 3 } }],
    ]);
  });

  it('names the platform on an outbound link', () => {
    const calls = spy();
    trackOutbound('discord');
    expect(calls).toEqual([['outbound', { props: { to: 'discord' } }]]);
  });

  it('names the crawler on a crawler view', () => {
    const calls = spy();
    trackCrawlerView('harry');
    expect(calls).toEqual([['crawler_view', { props: { crawler: 'harry' } }]]);
  });
});
