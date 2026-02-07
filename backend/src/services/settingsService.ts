/**
 * Settings Service
 *
 * NOTE: The database schema supports multiple media servers and arr services, but the current
 * implementation enforces a single-server model:
 * - 1 media server (Jellyfin)
 * - 1 Radarr (optional)
 * - 1 Sonarr (optional)
 *
 * This is intentional. Multi-server support requires mapping which arr service provides media to
 * which server - complexity we've deferred for now.
 * The schema is designed to support future multi-server/provider setups.
 */

import { eq, and, sql } from 'drizzle-orm';
import { db } from '@/db';
import {
  mediaServers,
  arrServices,
  appSettings,
  MediaServerRecord,
  NewMediaServerRecord,
  ArrServiceRecord,
  NewArrServiceRecord,
} from '@/db/schema';
import { ArrServiceType } from '@shared/types/enums';
import { TmdbClient } from '@/integrations/tmdb';
import { JellyfinClient } from '@/integrations/jellyfin';
import { RadarrClient } from '@/integrations/radarr';
import { SonarrClient } from '@/integrations/sonarr';
import { logger } from '@/services/logger';

// Arr Service Type Detection

interface ArrSystemStatus {
  version: string;
  appName: string;
}

/**
 * Detect arr service type by calling the /system/status endpoint
 * Returns 'radarr' or 'sonarr' based on appName, or throws if unrecognized
 */
export async function detectArrServiceType(
  url: string,
  apiKey: string
): Promise<{ type: ArrServiceType; appName: string; version: string }> {
  const baseUrl = url.replace(/\/$/, '');

  const statusUrl = `${baseUrl}/api/v3/system/status`;

  const response = await fetch(statusUrl, {
    headers: {
      'X-Api-Key': apiKey,
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    const errorText = await response.text();

    throw new Error(`Failed to connect: ${response.status} ${response.statusText} - ${errorText}`);
  }

  const status = (await response.json()) as ArrSystemStatus;

  const appNameLower = status.appName.toLowerCase();

  if (appNameLower === 'radarr') {
    return { type: ArrServiceType.RADARR, appName: status.appName, version: status.version };
  }

  if (appNameLower === 'sonarr') {
    return { type: ArrServiceType.SONARR, appName: status.appName, version: status.version };
  }

  throw new Error(`Unrecognized service: ${status.appName}. Expected Radarr or Sonarr.`);
}

// Media Servers

export async function getMediaServers(): Promise<MediaServerRecord[]> {
  return db.select().from(mediaServers).all();
}

export async function getMediaServerById(id: number): Promise<MediaServerRecord | undefined> {
  return db.select().from(mediaServers).where(eq(mediaServers.id, id)).get();
}

export async function getActiveMediaServer(): Promise<MediaServerRecord | undefined> {
  return db.select().from(mediaServers).where(eq(mediaServers.isActive, true)).get();
}

/**
 * Create a media server with simplified input (only url and apiKey required)
 * Name/type/isActive are set automatically since we only support one Jellyfin server
 */
export async function createMediaServer(data: {
  url: string;
  apiKey: string;
}): Promise<MediaServerRecord> {
  // Enforce single media server - reject if one already exists

  const existing = await getMediaServers();

  if (existing.length > 0) {
    throw new Error('A media server is already configured. Delete the existing one first.');
  }

  const result = db
    .insert(mediaServers)
    .values({
      name: '', // Name not user-facing, kept in DB for future use
      type: 'jellyfin',
      url: data.url,
      apiKey: data.apiKey,
      isActive: true,
    })
    .returning()
    .get();

  logger.info('Created Jellyfin media server', { source: 'settings' });

  return result;
}

export async function updateMediaServer(
  id: number,
  data: Partial<NewMediaServerRecord>
): Promise<MediaServerRecord | undefined> {
  const result = db
    .update(mediaServers)
    .set({ ...data, updatedAt: new Date().toISOString() })
    .where(eq(mediaServers.id, id))
    .returning()
    .get();

  if (result) {
    logger.info(`Updated media server: ${result.name}`, { source: 'settings' });
  }

  return result;
}

export async function deleteMediaServer(id: number): Promise<boolean> {
  const server = await getMediaServerById(id);

  if (!server) {
    return false;
  }

  db.delete(mediaServers).where(eq(mediaServers.id, id)).run();

  logger.info(`Deleted media server: ${server.name}`, { source: 'settings' });

  return true;
}

export async function testMediaServerConnection(
  id: number
): Promise<{ success: boolean; message: string; version?: string }> {
  const server = await getMediaServerById(id);

  if (!server) {
    return { success: false, message: 'Media server not found' };
  }

  // Currently only Jellyfin is supported
  if (server.type === 'jellyfin') {
    const client = new JellyfinClient({
      url: server.url,
      apiKey: server.apiKey,
    });

    return client.testConnection();
  }

  return { success: false, message: `Unsupported server type: ${server.type}` };
}

// Arr Services

export async function getArrServices(): Promise<ArrServiceRecord[]> {
  return db.select().from(arrServices).all();
}

export async function getArrServiceById(id: number): Promise<ArrServiceRecord | undefined> {
  return db.select().from(arrServices).where(eq(arrServices.id, id)).get();
}

export async function getActiveRadarr(): Promise<ArrServiceRecord | undefined> {
  return db
    .select()
    .from(arrServices)
    .where(and(eq(arrServices.type, 'radarr'), eq(arrServices.isActive, true)))
    .get();
}

export async function getActiveSonarr(): Promise<ArrServiceRecord | undefined> {
  return db
    .select()
    .from(arrServices)
    .where(and(eq(arrServices.type, 'sonarr'), eq(arrServices.isActive, true)))
    .get();
}

/**
 * Create an arr service with auto-detection of type (Radarr/Sonarr)
 * Only accepts url and apiKey - type is detected via /system/status API
 */
export async function createArrService(data: {
  url: string;
  apiKey: string;
  isActive?: boolean;
}): Promise<ArrServiceRecord> {
  // Auto-detect service type by calling the API
  const detection = await detectArrServiceType(data.url, data.apiKey);

  // Enforce max 1 per type
  const existingOfType = db
    .select()
    .from(arrServices)
    .where(eq(arrServices.type, detection.type))
    .get();

  if (existingOfType) {
    const typeName = detection.type === ArrServiceType.RADARR ? 'Radarr' : 'Sonarr';

    throw new Error(`A ${typeName} service is already configured.`);
  }

  const result = db
    .insert(arrServices)
    .values({
      name: '', // Name field not user-facing, kept in DB for future use
      type: detection.type,
      url: data.url,
      apiKey: data.apiKey,
      isActive: data.isActive ?? true,
    })
    .returning()
    .get();

  logger.info(`Created arr service: ${detection.appName} (${detection.type})`, {
    source: 'settings',
  });

  return result;
}

export async function updateArrService(
  id: number,
  data: Partial<NewArrServiceRecord>
): Promise<ArrServiceRecord | undefined> {
  const result = db
    .update(arrServices)
    .set({ ...data, updatedAt: new Date().toISOString() })
    .where(eq(arrServices.id, id))
    .returning()
    .get();

  if (result) {
    logger.info(`Updated arr service: ${result.name}`, { source: 'settings' });
  }

  return result;
}

export async function deleteArrService(id: number): Promise<boolean> {
  const service = await getArrServiceById(id);

  if (!service) {
    return false;
  }

  db.delete(arrServices).where(eq(arrServices.id, id)).run();

  logger.info(`Deleted arr service: ${service.name}`, { source: 'settings' });

  return true;
}

export async function testArrServiceConnection(
  id: number
): Promise<{ success: boolean; message: string; version?: string }> {
  const service = await getArrServiceById(id);

  if (!service) {
    return { success: false, message: 'Arr service not found' };
  }

  const config = { url: service.url, apiKey: service.apiKey };

  if (service.type === 'radarr') {
    const client = new RadarrClient(config);

    return client.testConnection();
  }

  if (service.type === 'sonarr') {
    const client = new SonarrClient(config);

    return client.testConnection();
  }

  return { success: false, message: `Unsupported service type: ${service.type}` };
}

// App Settings (generic key-value store)

export async function getAppSetting<T = unknown>(key: string): Promise<T | null> {
  const setting = db.select().from(appSettings).where(eq(appSettings.key, key)).get();

  if (!setting || !setting.value) {
    return null;
  }

  try {
    return JSON.parse(setting.value) as T;
  } catch {
    return null;
  }
}

export async function setAppSetting(key: string, value: unknown): Promise<void> {
  const jsonValue = JSON.stringify(value);

  db.insert(appSettings)
    .values({ key, value: jsonValue, updatedAt: sql`(datetime('now'))` })
    .onConflictDoUpdate({
      target: appSettings.key,
      set: { value: jsonValue, updatedAt: sql`(datetime('now'))` },
    })
    .run();

  logger.info(`Updated app setting: ${key}`, { source: 'settings' });
}

// Hidden User IDs Helper

const HIDDEN_USER_IDS_KEY = 'hiddenUserIds';

export async function getHiddenUserIds(): Promise<string[]> {
  const hidden = await getAppSetting<string[]>(HIDDEN_USER_IDS_KEY);
  return hidden ?? [];
}

// TMDB API Key Helpers

const TMDB_API_KEY_SETTING = 'tmdbApiKey';

export async function getTmdbApiKey(): Promise<string | null> {
  return getAppSetting<string>(TMDB_API_KEY_SETTING);
}

export async function setTmdbApiKey(apiKey: string): Promise<void> {
  await setAppSetting(TMDB_API_KEY_SETTING, apiKey);
}

export async function testTmdbConnection(
  apiKey: string
): Promise<{ success: boolean; message: string }> {
  if (!apiKey) {
    return { success: false, message: 'No API key provided' };
  }

  const client = new TmdbClient({ apiKey });

  return client.testConnection();
}
