import { z } from 'zod';
import { PRD_ID_PATTERN, UUID_PATTERN } from '../../src/lib/ids';

/** Path id for /api/jobs/:id/*. Jobs are only ever minted by crypto.randomUUID(). */
export const jobIdSchema = z.string().regex(UUID_PATTERN, 'Invalid job id');

/** Path id for /api/prd/:id. */
export const prdIdSchema = z.string().regex(PRD_ID_PATTERN, 'Invalid PRD id');
