/**
 * HTTP API Endpoint for Events
 * Provides REST API for mobile clients to poll events
 */

import express, { Router, Request, Response } from 'express';
import { logger } from '../utils/logger';
import { NormalizedEarthquake } from '../types/earthquake';

// In-memory store for recent events (in production, use Redis or database)
const recentEvents: NormalizedEarthquake[] = [];
const MAX_EVENTS = 100;

export function createEventsRouter(): Router {
  const router = Router();

  /**
   * GET /api/events/latest
   * Get latest earthquake events
   */
  router.get('/latest', (req: Request, res: Response) => {
    try {
      const limit = parseInt(req.query.limit as string) || 10;
      const since = req.query.since ? parseInt(req.query.since as string) : null;

      let events = recentEvents;

      // Filter by timestamp if provided
      if (since) {
        events = events.filter((e) => e.timestamp > since);
      }

      // Sort by timestamp (newest first) and limit
      events = events
        .sort((a, b) => b.timestamp - a.timestamp)
        .slice(0, limit);

      res.json(events);
    } catch (error: any) {
      logger.error('Failed to get latest events', { error: error.message });
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  /**
   * GET /api/events/:id
   * Get specific event by ID
   */
  router.get('/:id', (req: Request, res: Response) => {
    try {
      const event = recentEvents.find((e) => e.id === req.params.id);
      if (!event) {
        res.status(404).json({ error: 'Event not found' });
        return;
      }
      res.json(event);
    } catch (error: any) {
      logger.error('Failed to get event', { error: error.message });
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  return router;
}

/**
 * Store event for API access
 */
export function storeEvent(event: NormalizedEarthquake): void {
  recentEvents.unshift(event);
  if (recentEvents.length > MAX_EVENTS) {
    recentEvents.pop();
  }
}

