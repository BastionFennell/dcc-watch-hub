import { describe, expect, it } from 'vitest';
import { parseYouTubeId } from './youtubeId';

const ID = 'aqz-KE-bpKQ';

describe('parseYouTubeId', () => {
  it('accepts a bare id', () => {
    expect(parseYouTubeId(ID)).toBe(ID);
    expect(parseYouTubeId(`  ${ID}  `)).toBe(ID);
    expect(parseYouTubeId('M7lc1UVf-VE')).toBe('M7lc1UVf-VE');
    expect(parseYouTubeId('_-__-__-__-')).toBe('_-__-__-__-');
  });

  it('reads watch URLs, with or without extra parameters', () => {
    expect(parseYouTubeId(`https://www.youtube.com/watch?v=${ID}`)).toBe(ID);
    expect(parseYouTubeId(`http://youtube.com/watch?v=${ID}`)).toBe(ID);
    expect(parseYouTubeId(`https://m.youtube.com/watch?v=${ID}&t=42s`)).toBe(ID);
    expect(parseYouTubeId(`https://www.youtube.com/watch?list=PL123&v=${ID}&index=3`)).toBe(ID);
    expect(parseYouTubeId(`www.youtube.com/watch?v=${ID}`)).toBe(ID);
    expect(parseYouTubeId(`//www.youtube.com/watch?v=${ID}`)).toBe(ID);
  });

  it('reads short, embed, shorts, live and legacy /v/ links', () => {
    expect(parseYouTubeId(`https://youtu.be/${ID}`)).toBe(ID);
    expect(parseYouTubeId(`https://youtu.be/${ID}?t=90`)).toBe(ID);
    expect(parseYouTubeId(`youtu.be/${ID}`)).toBe(ID);
    expect(parseYouTubeId(`https://www.youtube.com/embed/${ID}`)).toBe(ID);
    expect(parseYouTubeId(`https://www.youtube-nocookie.com/embed/${ID}?rel=0`)).toBe(ID);
    expect(parseYouTubeId(`https://www.youtube.com/shorts/${ID}`)).toBe(ID);
    expect(parseYouTubeId(`https://www.youtube.com/live/${ID}?feature=share`)).toBe(ID);
    expect(parseYouTubeId(`https://www.youtube.com/v/${ID}`)).toBe(ID);
  });

  it('returns null for anything that is not one video', () => {
    expect(parseYouTubeId('')).toBeNull();
    expect(parseYouTubeId('   ')).toBeNull();
    expect(parseYouTubeId('not a video')).toBeNull();
    expect(parseYouTubeId('too-short')).toBeNull();
    expect(parseYouTubeId(`${ID}TOOLONG`)).toBeNull();
    expect(parseYouTubeId('https://vimeo.com/123456789')).toBeNull();
    expect(parseYouTubeId('https://www.youtube.com/@DungeonCrawlCast')).toBeNull();
    expect(parseYouTubeId('https://www.youtube.com/playlist?list=PL123')).toBeNull();
    expect(parseYouTubeId('https://www.youtube.com/watch?v=short')).toBeNull();
    expect(parseYouTubeId('https://www.youtube.com/watch')).toBeNull();
    expect(parseYouTubeId('javascript:alert(1)')).toBeNull();
    expect(parseYouTubeId(null)).toBeNull();
    expect(parseYouTubeId(42)).toBeNull();
  });
});
