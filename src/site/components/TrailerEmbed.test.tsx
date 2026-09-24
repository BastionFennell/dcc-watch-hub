// @vitest-environment jsdom
/**
 * No autoplay anywhere on the front door (constitution VIII). The proof is that
 * there is no player at all until the viewer clicks.
 */
import { describe, expect, it } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { TrailerEmbed } from './TrailerEmbed';
import { siteCopy } from '../copy';

describe('TrailerEmbed', () => {
  it('is a poster and a play button before the click - no iframe', () => {
    const { container } = render(<TrailerEmbed youtubeId="aqz-KE-bpKQ" title="Trailer" />);
    expect(container.querySelector('iframe')).toBeNull();
    expect(screen.getByRole('button', { name: siteCopy.playLabel('Trailer') })).toBeInTheDocument();
    expect(container.querySelector('img')).toHaveAttribute(
      'src',
      'https://i.ytimg.com/vi/aqz-KE-bpKQ/hqdefault.jpg',
    );
  });

  it('mounts the player with autoplay only after the click', () => {
    const { container } = render(<TrailerEmbed youtubeId="aqz-KE-bpKQ" title="Trailer" />);
    fireEvent.click(screen.getByRole('button'));
    const iframe = container.querySelector('iframe');
    expect(iframe).not.toBeNull();
    expect(iframe?.getAttribute('src')).toContain('autoplay=1');
    expect(iframe?.getAttribute('src')).toContain('rel=0');
    expect(iframe).toHaveAttribute('title', 'Trailer');
  });
});
