import { api, buildQueryString } from './api'
import { ApiResponse } from '@shared/types/api'
import { LogEntry, LogFilters } from '@shared/types/logs'

export const logsService = {
  async getLogs(filters: LogFilters): Promise<LogEntry[]> {
    // Build query string manually to handle array params correctly
    const queryString = buildQueryString({
      search: filters.search || undefined,
      levels: filters.levels,
      limit: filters.limit,
    })

    const response = await api.get<ApiResponse<LogEntry[]>>(`/api/logs${queryString}`)

    if (!response.success || !response.data) {
      throw new Error(response.error || 'Failed to fetch logs')
    }

    return response.data
  },

  async clearLogs(): Promise<void> {
    const response = await api.post<ApiResponse>('/api/clear-log')

    if (!response.success) {
      throw new Error(response.error || 'Failed to clear logs')
    }
  },
}
