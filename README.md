# Eyebleacharr

Track and manage watched media from Jellyfin with Radarr/Sonarr integration.

## Tech Stack

-   **Backend**: Node.js, Express, TypeScript
-   **Database**: SQLite with Drizzle ORM
-   **Frontend**: Vue 3, Vite, Tailwind CSS
-   **DevOps**: Docker, Docker Compose, GitHub Actions (CI/CD)

## Features

-   **Monorepo Structure**: Managed with pnpm workspaces
-   **Type Safety**: Shared types between backend and frontend
-   **Database Migrations**: Automatic migration management with Drizzle
-   **Docker Ready**: Multi-stage builds for optimized images
-   **CI/CD**: Semantic Release and ghcr.io image publishing
-   **Developer Experience**: Concurrent dev servers, hot reload, and debug configurations

## Development

### Prerequisites

-   Node.js 20+
-   pnpm

### Installation

1.  Clone the repository
2.  Install dependencies:
    ```bash
    pnpm install
    ```
3.  Set up environment variables:
    ```bash
    cp .env.example .env
    ```

### Running Locally

Start both backend and frontend in development mode:

```bash
pnpm dev
```

-   Frontend: http://localhost:5173
-   Backend: http://localhost:3000

### Debugging

Use VSCode "Run and Debug" to attach to the backend process.

```bash
pnpm dev:debug
```

### Database Migrations

Uses Drizzle ORM for schema management:

1.  **Edit schema**: Modify `backend/src/db/schema.ts`
2.  **Generate migration**: `pnpm --filter backend run db:generate`
3.  **Apply migration**: `pnpm db:migrate`

Migrations run automatically on app startup. Use `db:studio` to browse the database visually.

> **Note**: For quick prototyping, `db:push` syncs the schema directly (no migration files). Use `db:generate` + `db:migrate` for production-ready, versioned changes.

## Production

### Docker Compose

```yaml
services:
  eyebleacharr:
    image: ghcr.io/pdcmoreira/eyebleacharr:latest
    container_name: eyebleacharr
    restart: unless-stopped
    ports:
      - "3000:3000"
    volumes:
      - ./data:/app/data
    environment:
      - NODE_ENV=production
      - SYNC_INTERVAL_MINUTES=60
    # Optional: Run as specific user to match host file ownership
    # user: "1000:1000"
```

## Directory Structure

-   `backend/`: Express API server
-   `frontend/`: Vue 3 application
-   `shared/`: Shared TypeScript types and utilities
-   `scripts/`: Maintenance scripts