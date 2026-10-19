import { Router } from 'express';
import { createReferral, createReferralSchema, listActivity, listReferrals, updateReferralStatus, updateStatusSchema, listReferralQuerySchema, activityQuerySchema, idParamSchema } from '../controllers/referralController.js';
import { requireAuth } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import type { Server } from 'socket.io';

export const referralRoutes = (io: Server) => {
  const router = Router();
  router.use(requireAuth);
  router.post('/', validate(createReferralSchema), createReferral(io));
  router.get('/', validate(listReferralQuerySchema, 'query'), listReferrals);
  router.patch('/:id/status', validate(idParamSchema, 'params'), validate(updateStatusSchema), updateReferralStatus(io));
  router.get('/activity', validate(activityQuerySchema, 'query'), listActivity);
  return router;
};
