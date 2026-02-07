import { Router, Request, Response } from 'express';
import {
  getMediaServers,
  getMediaServerById,
  createMediaServer,
  updateMediaServer,
  deleteMediaServer,
  testMediaServerConnection,
  getArrServices,
  getArrServiceById,
  createArrService,
  updateArrService,
  deleteArrService,
  testArrServiceConnection,
  getAppSetting,
  setAppSetting,
  testTmdbConnection,
} from '@/services/settingsService';
import { respondSuccess, respondError } from '@/api/utils/response';

const router: Router = Router();

// Media Servers

// GET /api/settings/media-servers
router.get('/media-servers', async (req: Request, res: Response) => {
  try {
    const servers = await getMediaServers();

    respondSuccess(res, servers);
  } catch (error) {
    respondError(res, (error as Error).message);
  }
});

// GET /api/settings/media-servers/:id
router.get('/media-servers/:id', async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id, 10);

    const server = await getMediaServerById(id);

    if (!server) {
      return respondError(res, 'Media server not found', 404);
    }

    respondSuccess(res, server);
  } catch (error) {
    respondError(res, (error as Error).message);
  }
});

// POST /api/settings/media-servers
// Simplified - only url and apiKey required, name/type set automatically
router.post('/media-servers', async (req: Request, res: Response) => {
  try {
    const { url, apiKey } = req.body;

    if (!url || !apiKey) {
      return respondError(res, 'Missing required fields: url, apiKey', 400);
    }

    const server = await createMediaServer({ url, apiKey });

    respondSuccess(res, server);
  } catch (error) {
    // Return 400 for business logic errors (e.g., server already exists)
    respondError(res, (error as Error).message, 400);
  }
});

// PUT /api/settings/media-servers/:id
router.put('/media-servers/:id', async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id, 10);

    const server = await updateMediaServer(id, req.body);

    if (!server) {
      return respondError(res, 'Media server not found', 404);
    }

    respondSuccess(res, server);
  } catch (error) {
    respondError(res, (error as Error).message);
  }
});

// DELETE /api/settings/media-servers/:id
router.delete('/media-servers/:id', async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id, 10);

    const deleted = await deleteMediaServer(id);

    if (!deleted) {
      return respondError(res, 'Media server not found', 404);
    }

    respondSuccess(res, { deleted: true });
  } catch (error) {
    respondError(res, (error as Error).message);
  }
});

// POST /api/settings/media-servers/:id/test
router.post('/media-servers/:id/test', async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id, 10);

    const result = await testMediaServerConnection(id);

    respondSuccess(res, result);
  } catch (error) {
    respondError(res, (error as Error).message);
  }
});

// Arr Services

// GET /api/settings/arr-services
router.get('/arr-services', async (req: Request, res: Response) => {
  try {
    const services = await getArrServices();

    respondSuccess(res, services);
  } catch (error) {
    respondError(res, (error as Error).message);
  }
});

// GET /api/settings/arr-services/:id
router.get('/arr-services/:id', async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id, 10);

    const service = await getArrServiceById(id);

    if (!service) {
      return respondError(res, 'Arr service not found', 404);
    }

    respondSuccess(res, service);
  } catch (error) {
    respondError(res, (error as Error).message);
  }
});

// POST /api/settings/arr-services
// Type is auto-detected via /system/status - only url and apiKey required
router.post('/arr-services', async (req: Request, res: Response) => {
  try {
    const { url, apiKey, isActive } = req.body;

    if (!url || !apiKey) {
      return respondError(res, 'Missing required fields: url, apiKey', 400);
    }

    const service = await createArrService({ url, apiKey, isActive });

    respondSuccess(res, service);
  } catch (error) {
    // Return 400 for business logic errors (duplicates, connection issues)
    // so frontend can display user-friendly messages
    respondError(res, (error as Error).message, 400);
  }
});

// PUT /api/settings/arr-services/:id
router.put('/arr-services/:id', async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id, 10);

    const service = await updateArrService(id, req.body);

    if (!service) {
      return respondError(res, 'Arr service not found', 404);
    }

    respondSuccess(res, service);
  } catch (error) {
    respondError(res, (error as Error).message);
  }
});

// DELETE /api/settings/arr-services/:id
router.delete('/arr-services/:id', async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id, 10);

    const deleted = await deleteArrService(id);

    if (!deleted) {
      return respondError(res, 'Arr service not found', 404);
    }

    respondSuccess(res, { deleted: true });
  } catch (error) {
    respondError(res, (error as Error).message);
  }
});

// POST /api/settings/arr-services/:id/test
router.post('/arr-services/:id/test', async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id, 10);

    const result = await testArrServiceConnection(id);

    respondSuccess(res, result);
  } catch (error) {
    respondError(res, (error as Error).message);
  }
});

// App Settings (generic key-value store)

// GET /api/settings/app/:key
router.get('/app/:key', async (req: Request, res: Response) => {
  try {
    const { key } = req.params;

    const value = await getAppSetting(key);

    respondSuccess(res, value);
  } catch (error) {
    respondError(res, (error as Error).message);
  }
});

// PUT /api/settings/app/:key
router.put('/app/:key', async (req: Request, res: Response) => {
  try {
    const { key } = req.params;

    const { value } = req.body;

    await setAppSetting(key, value);

    respondSuccess(res, { key, value });
  } catch (error) {
    respondError(res, (error as Error).message);
  }
});

// TMDB API

// POST /api/settings/tmdb/test
router.post('/tmdb/test', async (req: Request, res: Response) => {
  try {
    const { apiKey } = req.body;

    if (!apiKey) {
      return respondError(res, 'API key is required', 400);
    }

    const result = await testTmdbConnection(apiKey);

    respondSuccess(res, result);
  } catch (error) {
    respondError(res, (error as Error).message);
  }
});

export default router;
