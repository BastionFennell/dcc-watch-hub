import { describe, expect, it } from 'vitest';
import { clampTime, formatTimecode, parseTimecode } from './timecode';

describe('parseTimecode', () => {
  it('reads a bare second count', () => {
    expect(parseTimecode('245')).toBe(245);
    expect(parseTimecode('0')).toBe(0);
    expect(parseTimecode(245)).toBe(245);
  });

  it('reads m:ss and h:mm:ss', () => {
    expect(parseTimecode('4:05')).toBe(245);
    expect(parseTimecode('0:00')).toBe(0);
    expect(parseTimecode('90:00')).toBe(5400);
    expect(parseTimecode('1:02:03')).toBe(3723);
  });

  it('tolerates spaces anywhere', () => {
    expect(parseTimecode(' 1 : 02 : 03 ')).toBe(3723);
    expect(parseTimecode('  4:05')).toBe(245);
  });

  it('keeps a fractional second', () => {
    expect(parseTimecode('4:05.5')).toBe(245.5);
  });

  it('rejects junk', () => {
    expect(parseTimecode('')).toBeNull();
    expect(parseTimecode('   ')).toBeNull();
    expect(parseTimecode('abc')).toBeNull();
    expect(parseTimecode('1:2:3:4')).toBeNull();
    expect(parseTimecode('-5')).toBeNull();
    expect(parseTimecode(-5)).toBeNull();
    expect(parseTimecode('4:60')).toBeNull();
    expect(parseTimecode('1:70:00')).toBeNull();
    expect(parseTimecode('4:')).toBeNull();
    expect(parseTimecode(':30')).toBeNull();
    expect(parseTimecode(Number.NaN)).toBeNull();
    expect(parseTimecode(null)).toBeNull();
  });
});

describe('formatTimecode', () => {
  it('writes m:ss under an hour and h:mm:ss above it', () => {
    expect(formatTimecode(0)).toBe('0:00');
    expect(formatTimecode(5)).toBe('0:05');
    expect(formatTimecode(245)).toBe('4:05');
    expect(formatTimecode(3599)).toBe('59:59');
    expect(formatTimecode(3600)).toBe('1:00:00');
    expect(formatTimecode(3723)).toBe('1:02:03');
  });

  it('truncates and refuses to print a negative clock', () => {
    expect(formatTimecode(245.9)).toBe('4:05');
    expect(formatTimecode(-10)).toBe('0:00');
    expect(formatTimecode(Number.NaN)).toBe('0:00');
  });

  it('round-trips whole seconds', () => {
    for (const seconds of [0, 1, 59, 60, 245, 3599, 3600, 3723, 36000]) {
      expect(parseTimecode(formatTimecode(seconds))).toBe(seconds);
    }
  });
});

describe('clampTime', () => {
  it('clamps to [0, duration] when a duration is known', () => {
    expect(clampTime(-5, 100)).toBe(0);
    expect(clampTime(50, 100)).toBe(50);
    expect(clampTime(150, 100)).toBe(100);
  });

  it('leaves the upper bound open when the duration is unknown', () => {
    expect(clampTime(150, 0)).toBe(150);
    expect(clampTime(-1, 0)).toBe(0);
  });
});
