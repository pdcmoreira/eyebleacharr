import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SonarrClient } from './sonarr';

// Mock fetch globally
const mockFetch = vi.fn();
global.fetch = mockFetch;

describe('SonarrClient', () => {
  let client: SonarrClient;

  beforeEach(() => {
    client = new SonarrClient({
      url: 'http://localhost:8989',
      apiKey: 'test-api-key',
    });
    mockFetch.mockReset();
  });

  describe('findSeriesByTmdbId', () => {
    it('should find series by TMDB ID', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: async () =>
          JSON.stringify([
            { id: 1, title: 'Foundation', year: 2021, tvdbId: 12345, tmdbId: 95403 },
            { id: 2, title: 'Other Show', year: 2020, tvdbId: 99999, tmdbId: 11111 },
          ]),
      });

      const result = await client.findSeriesByTmdbId(95403);

      expect(result).toEqual({
        id: 1,
        title: 'Foundation',
        year: 2021,
        tvdbId: 12345,
        tmdbId: 95403,
      });
    });

    it('should return null when TMDB ID not found', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: async () =>
          JSON.stringify([
            { id: 1, title: 'Foundation', year: 2021, tvdbId: 12345, tmdbId: 95403 },
          ]),
      });

      const result = await client.findSeriesByTmdbId(99999);

      expect(result).toBeNull();
    });
  });

  describe('findSeriesByTvdbId', () => {
    it('should find series by TVDB ID', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: async () =>
          JSON.stringify([
            { id: 1, title: 'Foundation', year: 2021, tvdbId: 12345, tmdbId: 95403 },
          ]),
      });

      const result = await client.findSeriesByTvdbId(12345);

      expect(result).not.toBeNull();

      expect(result?.title).toBe('Foundation');
    });
  });

  describe('findSeriesByImdbId', () => {
    it('should find series by IMDB ID', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: async () =>
          JSON.stringify([
            { id: 1, title: 'Foundation', year: 2021, tvdbId: 12345, imdbId: 'tt12759810' },
          ]),
      });

      const result = await client.findSeriesByImdbId('tt12759810');

      expect(result).not.toBeNull();

      expect(result?.title).toBe('Foundation');
    });
  });

  describe('findSeriesByTitle', () => {
    const mockSeriesList = [
      { id: 1, title: 'Foundation', year: 2021, tvdbId: 12345 },
      { id: 2, title: 'The Foundation', year: 2019, tvdbId: 11111 },
      { id: 3, title: 'Breaking Bad', year: 2008, tvdbId: 22222 },
      { id: 4, title: 'The Office', year: 2005, tvdbId: 33333 },
      { id: 5, title: 'The Office', year: 2001, tvdbId: 44444 }, // UK version
    ];

    beforeEach(() => {
      mockFetch.mockResolvedValue({
        ok: true,
        text: async () => JSON.stringify(mockSeriesList),
      });
    });

    it('should match by exact title and year', async () => {
      const result = await client.findSeriesByTitle('Foundation', 2021);

      expect(result).not.toBeNull();

      expect(result?.id).toBe(1);

      expect(result?.title).toBe('Foundation');
    });

    it('should handle "The" prefix (finds "Foundation" when searching "The Foundation")', async () => {
      // When searching for "The Foundation" year 2021, it should normalize and find "Foundation" 2021
      const result = await client.findSeriesByTitle('The Foundation', 2021);

      expect(result).not.toBeNull();

      expect(result?.id).toBe(1); // Matches "Foundation" 2021 (normalized removes "The")
    });

    it('should handle "The" prefix (finds "The Foundation" when searching "Foundation")', async () => {
      // When searching for "Foundation" year 2019, it should find "The Foundation" 2019
      const result = await client.findSeriesByTitle('Foundation', 2019);

      expect(result).not.toBeNull();

      expect(result?.id).toBe(2); // Matches "The Foundation" 2019
    });

    it('should return single match when only one title matches', async () => {
      const result = await client.findSeriesByTitle('Breaking Bad');

      expect(result).not.toBeNull();

      expect(result?.title).toBe('Breaking Bad');
    });

    it('should prefer year match when multiple titles match', async () => {
      // "The Office" has two entries: 2005 (US) and 2001 (UK)
      const result = await client.findSeriesByTitle('The Office', 2005);

      expect(result).not.toBeNull();

      expect(result?.year).toBe(2005);
    });

    it('should return null when multiple matches and no year provided', async () => {
      // "The Office" has two entries, no year to disambiguate
      const result = await client.findSeriesByTitle('The Office');

      expect(result).toBeNull();
    });

    it('should handle case-insensitive matching', async () => {
      const result = await client.findSeriesByTitle('BREAKING BAD', 2008);

      expect(result).not.toBeNull();

      expect(result?.title).toBe('Breaking Bad');
    });

    it('should handle special characters', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: async () =>
          JSON.stringify([
            { id: 1, title: "Marvel's Agents of S.H.I.E.L.D.", year: 2013, tvdbId: 55555 },
          ]),
      });

      const result = await client.findSeriesByTitle('Marvels Agents of SHIELD', 2013);

      expect(result).not.toBeNull();
    });

    it('should return null when no match found', async () => {
      const result = await client.findSeriesByTitle('Nonexistent Show', 2020);

      expect(result).toBeNull();
    });
  });
});
