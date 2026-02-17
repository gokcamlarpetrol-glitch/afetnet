import { formatLastSeen, normalizeTimestampMs } from '../dateUtils';

describe('dateUtils timestamp normalization', () => {
  const FIXED_NOW = new Date('2026-02-14T12:00:00.000Z').getTime();

  beforeEach(() => {
    jest.spyOn(Date, 'now').mockReturnValue(FIXED_NOW);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('normalizes unix seconds to milliseconds', () => {
    expect(normalizeTimestampMs(1_770_743_061)).toBe(1_770_743_061_000);
    expect(normalizeTimestampMs('1770743061')).toBe(1_770_743_061_000);
  });

  it('returns null for invalid timestamps', () => {
    expect(normalizeTimestampMs(undefined)).toBeNull();
    expect(normalizeTimestampMs(null)).toBeNull();
    expect(normalizeTimestampMs(0)).toBeNull();
    expect(normalizeTimestampMs('not-a-date')).toBeNull();
  });

  it('formats invalid/old timestamps as unknown', () => {
    expect(formatLastSeen(0)).toBe('Bilinmiyor');
    expect(formatLastSeen('1970-01-01T00:00:00.000Z')).toBe('Bilinmiyor');
  });

  it('formats normalized seconds timestamp with correct relative text', () => {
    const twoMinutesAgoSeconds = Math.floor((FIXED_NOW - 2 * 60 * 1000) / 1000);
    expect(formatLastSeen(twoMinutesAgoSeconds)).toBe('2 dk önce');
  });
});
