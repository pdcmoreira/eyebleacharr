import { MediaServerType, ArrServiceType } from './enums';

/**
 * Media Server configuration
 *
 * NOTE: The database stores a `name` field for future multi-server support,
 * but it's not user-facing. The UI always shows "Jellyfin".
 */
export interface MediaServer {
  id: number;
  type: MediaServerType;
  url: string;
  apiKey: string;
  isActive: boolean;
  createdAt?: string;
  updatedAt?: string;
}

/**
 * Arr Service configuration
 *
 * NOTE: The database stores a `name` field for future multi-provider support,
 * but it's not user-facing. Services are identified by their type (radarr/sonarr).
 */
export interface ArrService {
  id: number;
  type: ArrServiceType;
  url: string;
  apiKey: string;
  isActive: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface ConnectionTestResult {
  success: boolean;
  message: string;
  version?: string;
}
