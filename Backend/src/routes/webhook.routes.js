import { Router } from 'express';
import express from 'express';
import { handleClerkWebhook } from '../controllers/webhook.controller.js';

const router = Router();

// Clerk webhooks require the raw request body to verify Svix signatures
router.post(
  '/clerk',
  express.raw({ type: 'application/json' }),
  (req, res, next) => {
    // If express.raw gave us a buffer, store it on req.rawBody
    if (Buffer.isBuffer(req.body)) {
      req.rawBody = req.body;
    }
    next();
  },
  handleClerkWebhook
);

export default router;
