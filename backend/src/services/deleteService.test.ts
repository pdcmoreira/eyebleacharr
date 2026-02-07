import { describe, it, expect, vi, beforeEach, Mock } from 'vitest';
import { findSonarrSeries } from './sonarrService';
import { SonarrClient } from '@/integrations/sonarr';
import { TmdbClient } from '@/integrations/tmdb';
import { WatchedSeriesRecord } from '@/db/schema';

// Mock the logger to suppress output during tests
vi.mock('@/services/logger', () => ({
  logger: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

describe('findSonarrSeries', () => {
  let mockSonarrClient: {
    findSeriesByTmdbId: Mock;
    findSeriesByTvdbId: Mock;
    findSeriesByImdbId: Mock;
    findSeriesByTitle: Mock;
  };

  let mockTmdbClient: {
    getTvExternalIds: Mock;
  } | null;

  const createSeries = (overrides: Partial<WatchedSeriesRecord> = {}): WatchedSeriesRecord => ({
    id: 1,
    jellyfinId: 'jellyfin-123',
    mediaServerId: 1,
    title: 'Foundation',
    year: 2021,
    tmdbId: 95403,
    tvdbId: 366924,
    imdbId: 'tt12759810',
    posterUrl: null,
    totalEpisodes: 10,
    watchedEpisodes: 5,
    status: 'watched',
    deleteMethod: null,
    deletedAt: null,
    createdAt: '2024-01-01',
    sonarrSeriesId: null,
    sonarrTitleSlug: null,
    ...overrides,
  });

  const mockSonarrSeries = {
    id: 42,
    title: 'Foundation',
    year: 2021,
    tvdbId: 366924,
  };

  // Helper to assert which methods were called/not called
  const expectMethodsCalled = (calls: {
    tmdb?: number | false;
    tvdb?: number | false;
    imdb?: string | false;
    title?: [string, number] | false;
    tmdbApi?: number | false;
  }) => {
    if (calls.tmdb === false) {
      expect(mockSonarrClient.findSeriesByTmdbId).not.toHaveBeenCalled();
    } else if (calls.tmdb) {
      expect(mockSonarrClient.findSeriesByTmdbId).toHaveBeenCalledWith(calls.tmdb);
    }

    if (calls.tvdb === false) {
      expect(mockSonarrClient.findSeriesByTvdbId).not.toHaveBeenCalled();
    } else if (calls.tvdb) {
      expect(mockSonarrClient.findSeriesByTvdbId).toHaveBeenCalledWith(calls.tvdb);
    }

    if (calls.imdb === false) {
      expect(mockSonarrClient.findSeriesByImdbId).not.toHaveBeenCalled();
    } else if (calls.imdb) {
      expect(mockSonarrClient.findSeriesByImdbId).toHaveBeenCalledWith(calls.imdb);
    }

    if (calls.title === false) {
      expect(mockSonarrClient.findSeriesByTitle).not.toHaveBeenCalled();
    } else if (calls.title) {
      expect(mockSonarrClient.findSeriesByTitle).toHaveBeenCalledWith(...calls.title);
    }

    if (calls.tmdbApi === false) {
      expect(mockTmdbClient!.getTvExternalIds).not.toHaveBeenCalled();
    } else if (calls.tmdbApi) {
      expect(mockTmdbClient!.getTvExternalIds).toHaveBeenCalledWith(calls.tmdbApi);
    }
  };

  const expectMatch = (
    result: { sonarrSeriesId: number | null; matchMethod: string },
    expectedMethod: string
  ) => {
    expect(result.sonarrSeriesId).toBe(42);

    expect(result.matchMethod).toBe(expectedMethod);
  };

  const expectNoMatch = (result: { sonarrSeriesId: number | null; matchMethod: string }) => {
    expect(result.sonarrSeriesId).toBeNull();

    expect(result.matchMethod).toBe('none');
  };

  beforeEach(() => {
    mockSonarrClient = {
      findSeriesByTmdbId: vi.fn(() => null),
      findSeriesByTvdbId: vi.fn(() => null),
      findSeriesByImdbId: vi.fn(() => null),
      findSeriesByTitle: vi.fn(() => null),
    };

    mockTmdbClient = {
      getTvExternalIds: vi.fn(() => ({ tvdbId: null, imdbId: null })),
    };

    vi.clearAllMocks();
  });

  // Strategy order is now: 1) TMDB, 2) TVDB, 3) IMDB, 4) TMDB API, 5) Title+Year
  // Title matching now requires year

  describe('With all IDs available', () => {
    let series: WatchedSeriesRecord;

    beforeEach(() => {
      series = createSeries();
    });

    it('should match by TMDB ID (Strategy 1)', async () => {
      mockSonarrClient.findSeriesByTmdbId.mockResolvedValue(mockSonarrSeries);

      const result = await findSonarrSeries(
        series,
        mockSonarrClient as unknown as SonarrClient,
        mockTmdbClient as unknown as TmdbClient
      );

      expectMatch(result, 'tmdb');

      expectMethodsCalled({
        tmdb: 95403,
        tvdb: false,
        imdb: false,
        title: false,
        tmdbApi: false,
      });
    });

    describe('If TMDB lookup fails', () => {
      it('should match by stored TVDB ID (Strategy 2)', async () => {
        mockSonarrClient.findSeriesByTvdbId.mockResolvedValue(mockSonarrSeries);

        const result = await findSonarrSeries(
          series,
          mockSonarrClient as unknown as SonarrClient,
          mockTmdbClient as unknown as TmdbClient
        );

        expectMatch(result, 'tvdb');

        expectMethodsCalled({
          tmdb: 95403,
          tvdb: 366924,
          imdb: false,
          title: false,
          tmdbApi: false, // Skip TMDB API since we have stored tvdbId
        });
      });

      describe('If TVDB lookup fails', () => {
        it('should match by stored IMDB ID (Strategy 3)', async () => {
          mockSonarrClient.findSeriesByImdbId.mockResolvedValue(mockSonarrSeries);

          const result = await findSonarrSeries(
            series,
            mockSonarrClient as unknown as SonarrClient,
            mockTmdbClient as unknown as TmdbClient
          );

          expectMatch(result, 'imdb');

          expectMethodsCalled({
            tmdb: 95403,
            tvdb: 366924,
            imdb: 'tt12759810',
            title: false,
            tmdbApi: false,
          });
        });

        describe('If IMDB lookup fails', () => {
          it('should match by title and year (Strategy 5)', async () => {
            // Strategy 4 (TMDB API) is skipped because we have stored tvdbId
            mockSonarrClient.findSeriesByTitle.mockResolvedValue(mockSonarrSeries);

            const result = await findSonarrSeries(
              series,
              mockSonarrClient as unknown as SonarrClient,
              mockTmdbClient as unknown as TmdbClient
            );

            expectMatch(result, 'title-year');

            expectMethodsCalled({
              tmdb: 95403,
              tvdb: 366924,
              imdb: 'tt12759810',
              title: ['Foundation', 2021],
              tmdbApi: false,
            });
          });

          it('should return null if title lookup also fails', async () => {
            const result = await findSonarrSeries(
              series,
              mockSonarrClient as unknown as SonarrClient,
              mockTmdbClient as unknown as TmdbClient
            );

            expectNoMatch(result);
          });
        });
      });
    });
  });

  describe('With TMDB ID but no stored TVDB ID (triggers TMDB API)', () => {
    let series: WatchedSeriesRecord;

    beforeEach(() => {
      series = createSeries({ tvdbId: null });
    });

    it('should match by TMDB ID', async () => {
      mockSonarrClient.findSeriesByTmdbId.mockResolvedValue(mockSonarrSeries);

      const result = await findSonarrSeries(
        series,
        mockSonarrClient as unknown as SonarrClient,
        mockTmdbClient as unknown as TmdbClient
      );

      expectMatch(result, 'tmdb');

      expectMethodsCalled({ tmdb: 95403, tvdb: false, imdb: false, tmdbApi: false });
    });

    describe('If TMDB lookup fails', () => {
      beforeEach(() => {
        mockSonarrClient.findSeriesByTmdbId.mockResolvedValue(null);
      });

      it('should match by stored IMDB ID (Strategy 3, before TMDB API)', async () => {
        mockSonarrClient.findSeriesByImdbId.mockResolvedValue(mockSonarrSeries);

        const result = await findSonarrSeries(
          series,
          mockSonarrClient as unknown as SonarrClient,
          mockTmdbClient as unknown as TmdbClient
        );

        // Since we have stored IMDB, it's tried in Strategy 3 before TMDB API

        expectMatch(result, 'imdb');

        expectMethodsCalled({
          tmdb: 95403,
          tvdb: false,
          imdb: 'tt12759810',
          tmdbApi: false, // Not called because IMDB succeeded first
        });
      });

      describe('If stored IMDB lookup fails', () => {
        beforeEach(() => {
          mockSonarrClient.findSeriesByImdbId.mockResolvedValue(null);
        });

        it('should fetch TVDB from TMDB API and match (Strategy 4)', async () => {
          mockTmdbClient!.getTvExternalIds.mockResolvedValue({ tvdbId: 366924, imdbId: null });

          mockSonarrClient.findSeriesByTvdbId.mockResolvedValue(mockSonarrSeries);

          const result = await findSonarrSeries(
            series,
            mockSonarrClient as unknown as SonarrClient,
            mockTmdbClient as unknown as TmdbClient
          );

          expectMatch(result, 'tmdb-api-tvdb');

          expectMethodsCalled({
            tmdb: 95403,
            tvdb: 366924,
            imdb: 'tt12759810', // Tried before API
            tmdbApi: 95403,
          });
        });

        it('should try IMDB from TMDB API when different from stored', async () => {
          // API returns different IMDB than stored
          mockTmdbClient!.getTvExternalIds.mockResolvedValue({
            tvdbId: 366924,
            imdbId: 'tt99999999', // Different from stored 'tt12759810'
          });

          mockSonarrClient.findSeriesByTvdbId.mockResolvedValue(null);

          mockSonarrClient.findSeriesByImdbId
            .mockResolvedValueOnce(null) // Stored IMDB fails
            .mockResolvedValueOnce(mockSonarrSeries); // API IMDB succeeds

          const result = await findSonarrSeries(
            series,
            mockSonarrClient as unknown as SonarrClient,
            mockTmdbClient as unknown as TmdbClient
          );

          expectMatch(result, 'tmdb-api-imdb');

          expect(mockSonarrClient.findSeriesByImdbId).toHaveBeenCalledTimes(2);
        });

        it('should skip TMDB API IMDB if same as stored (already tried)', async () => {
          // API returns same IMDB as stored
          mockTmdbClient!.getTvExternalIds.mockResolvedValue({
            tvdbId: 366924,
            imdbId: 'tt12759810', // Same as stored
          });

          mockSonarrClient.findSeriesByTvdbId.mockResolvedValue(null);

          mockSonarrClient.findSeriesByTitle.mockResolvedValue(mockSonarrSeries);

          const result = await findSonarrSeries(
            series,
            mockSonarrClient as unknown as SonarrClient,
            mockTmdbClient as unknown as TmdbClient
          );

          expectMatch(result, 'title-year');

          // IMDB only called once (Strategy 3), not again via API
          expect(mockSonarrClient.findSeriesByImdbId).toHaveBeenCalledTimes(1);
        });
      });
    });
  });

  describe('With only TVDB ID available', () => {
    let series: WatchedSeriesRecord;

    beforeEach(() => {
      series = createSeries({ tmdbId: null, imdbId: null });
    });

    it('should skip TMDB and match by stored TVDB ID', async () => {
      mockSonarrClient.findSeriesByTvdbId.mockResolvedValue(mockSonarrSeries);

      const result = await findSonarrSeries(
        series,
        mockSonarrClient as unknown as SonarrClient,
        mockTmdbClient as unknown as TmdbClient
      );

      expectMatch(result, 'tvdb');

      expectMethodsCalled({
        tmdb: false,
        tvdb: 366924,
        imdb: false,
        title: false,
        tmdbApi: false,
      });
    });
  });

  describe('With only IMDB ID available', () => {
    let series: WatchedSeriesRecord;

    beforeEach(() => {
      series = createSeries({ tmdbId: null, tvdbId: null });
    });

    it('should skip TMDB/TVDB and match by stored IMDB ID', async () => {
      mockSonarrClient.findSeriesByImdbId.mockResolvedValue(mockSonarrSeries);

      const result = await findSonarrSeries(
        series,
        mockSonarrClient as unknown as SonarrClient,
        mockTmdbClient as unknown as TmdbClient
      );

      expectMatch(result, 'imdb');

      expectMethodsCalled({
        tmdb: false,
        tvdb: false,
        imdb: 'tt12759810',
        title: false,
      });
    });
  });

  describe('With only title and year available', () => {
    let series: WatchedSeriesRecord;

    beforeEach(() => {
      series = createSeries({ tmdbId: null, tvdbId: null, imdbId: null });
    });

    it('should match by title and year', async () => {
      mockSonarrClient.findSeriesByTitle.mockResolvedValue(mockSonarrSeries);

      const result = await findSonarrSeries(
        series,
        mockSonarrClient as unknown as SonarrClient,
        mockTmdbClient as unknown as TmdbClient
      );

      expectMatch(result, 'title-year');

      expectMethodsCalled({
        tmdb: false,
        tvdb: false,
        imdb: false,
        title: ['Foundation', 2021],
      });
    });

    it('should return null if title lookup fails', async () => {
      const result = await findSonarrSeries(
        series,
        mockSonarrClient as unknown as SonarrClient,
        mockTmdbClient as unknown as TmdbClient
      );

      expectNoMatch(result);
    });
  });

  describe('Title matching requires year', () => {
    it('should skip title matching when year is not available', async () => {
      const series = createSeries({ tmdbId: null, tvdbId: null, imdbId: null, year: null });

      const result = await findSonarrSeries(
        series,
        mockSonarrClient as unknown as SonarrClient,
        mockTmdbClient as unknown as TmdbClient
      );

      expectNoMatch(result);

      expect(mockSonarrClient.findSeriesByTitle).not.toHaveBeenCalled();
    });
  });

  describe('Error handling', () => {
    it('should continue to next strategy when TMDB lookup throws', async () => {
      const series = createSeries();

      mockSonarrClient.findSeriesByTmdbId.mockRejectedValue(new Error('API error'));

      mockSonarrClient.findSeriesByTvdbId.mockResolvedValue(mockSonarrSeries);

      const result = await findSonarrSeries(
        series,
        mockSonarrClient as unknown as SonarrClient,
        mockTmdbClient as unknown as TmdbClient
      );

      expectMatch(result, 'tvdb');
    });

    it('should continue to next strategy when TMDB API throws', async () => {
      const series = createSeries({ tvdbId: null, imdbId: null });

      mockTmdbClient!.getTvExternalIds.mockRejectedValue(new Error('TMDB API error'));

      mockSonarrClient.findSeriesByTitle.mockResolvedValue(mockSonarrSeries);

      const result = await findSonarrSeries(
        series,
        mockSonarrClient as unknown as SonarrClient,
        mockTmdbClient as unknown as TmdbClient
      );

      expectMatch(result, 'title-year');
    });

    it('should work without TMDB client (null)', async () => {
      const series = createSeries({ tvdbId: null });

      mockSonarrClient.findSeriesByImdbId.mockResolvedValue(mockSonarrSeries);

      const result = await findSonarrSeries(
        series,
        mockSonarrClient as unknown as SonarrClient,
        null // No TMDB client
      );

      expectMatch(result, 'imdb');
    });
  });
});
