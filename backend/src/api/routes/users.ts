import { Router, Request, Response } from 'express';
import { notInArray } from 'drizzle-orm';
import { db } from '@/db';
import { jellyfinUsers } from '@/db/schema';
import { respondSuccess, respondError } from '@/api/utils/response';
import { getHiddenUserIds } from '@/services/settingsService';
import { JellyfinUser } from '@shared/types/media';

const router: Router = Router();

// GET /api/users
// Returns all users, excluding hidden users by default
// Use ?includeHidden=true to include hidden users (for settings page)
router.get('/', async (req: Request, res: Response) => {
  try {
    const { includeHidden } = req.query;
    const hiddenIds = includeHidden === 'true' ? [] : await getHiddenUserIds();

    // Filter at database level with NOT IN
    const dbUsers = hiddenIds.length
      ? db.select().from(jellyfinUsers).where(notInArray(jellyfinUsers.id, hiddenIds)).all()
      : db.select().from(jellyfinUsers).all();

    // Map DB records to shared JellyfinUser type
    const users: JellyfinUser[] = dbUsers.map((user) => ({
      id: user.id,
      name: user.name,
    }));

    respondSuccess(res, users);
  } catch (error) {
    respondError(res, (error as Error).message);
  }
});

export default router;
