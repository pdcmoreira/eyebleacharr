import express, { Express, Request, Response } from 'express';
import fs from 'fs-extra';
import path from 'path';
import { logger } from '@/services/logger';
import { isProduction } from '@/config';

// Frontend dist path
const frontendDistPath: string = path.join(process.cwd(), './frontend/dist');

/**
 * Setup static file serving for the frontend
 */
export const setupStaticFiles = (app: Express): void => {
  if (fs.existsSync(frontendDistPath)) {
    app.use(express.static(frontendDistPath));

    logger.debug(`Serving frontend from: ${frontendDistPath}`);
  } else if (isProduction) {
    logger.warn(`Frontend dist directory not found at: ${frontendDistPath}`);
  } else {
    logger.debug(`Development mode: Frontend running on separate dev server`);
  }
};

/**
 * Setup SPA catch-all handler for client-side routing
 * Must be called after all API routes are registered
 */
export const setupSpaCatchAll = (app: Express): void => {
  app.get('*', (req: Request, res: Response) => {
    const indexPath = path.join(frontendDistPath, 'index.html');

    if (fs.existsSync(indexPath)) {
      return res.sendFile(indexPath);
    }

    if (isProduction) {
      return res.status(404).json({ error: 'Frontend not built or not found' });
    }

    return res.status(404).json({
      error: 'Development mode: Frontend running on separate dev server',
      message: 'Please access the frontend at the dev server URL (typically http://localhost:5173)',
    });
  });
};
