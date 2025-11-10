import { Router, Request, Response } from 'express';
import { pool } from '../database';
import { sensorDataRateLimiter } from '../middleware/rateLimiter';

interface SensorDataPayload {
  sensorId?: string;
  recordedAt?: string | number;
  latitude?: number;
  longitude?: number;
  readings?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
}

const router = Router();

/**
 * Normalize timestamp value (ms or ISO string) to Date.
 */
const parseRecordedAt = (value: SensorDataPayload['recordedAt']): Date => {
  if (value === undefined || value === null) {
    return new Date();
  }

  if (typeof value === 'number') {
    // Value might be seconds (10 digits) or milliseconds (13 digits)
    const ms = value > 1e12 ? value : value * 1000;
    const date = new Date(ms);
    if (!Number.isNaN(date.getTime())) {
      return date;
    }
  }

  if (typeof value === 'string') {
    const numeric = Number(value);
    if (!Number.isNaN(numeric)) {
      return parseRecordedAt(numeric);
    }
    const date = new Date(value);
    if (!Number.isNaN(date.getTime())) {
      return date;
    }
  }

  return new Date();
};

router.post('/sensor-data', sensorDataRateLimiter, async (req: Request, res: Response) => {
  const payload: SensorDataPayload = req.body ?? {};
  const sensorId = typeof payload.sensorId === 'string' ? payload.sensorId.trim() : '';

  if (!sensorId) {
    return res.status(400).json({
      success: false,
      error: 'sensorId alanı zorunludur.',
    });
  }

  const recordedAt = parseRecordedAt(payload.recordedAt);
  const latitude = typeof payload.latitude === 'number' ? payload.latitude : null;
  const longitude = typeof payload.longitude === 'number' ? payload.longitude : null;
  const readings = payload.readings ?? null;
  const metadata = payload.metadata ?? null;

  try {
    await pool.query(
      `
        INSERT INTO sensor_data_events (sensor_id, recorded_at, latitude, longitude, readings, metadata)
        VALUES ($1, $2, $3, $4, $5, $6)
      `,
      [sensorId, recordedAt, latitude, longitude, readings, metadata]
    );

    return res.json({
      success: true,
      receivedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error('[SensorData] Failed to persist sensor payload:', error);
    return res.status(500).json({
      success: false,
      error: 'Sensör verisi kaydedilemedi.',
    });
  }
});

router.get('/sensor-data/health', async (_req: Request, res: Response) => {
  try {
    const { rows } = await pool.query<{ count: string; last_recorded_at: string }>(
      `
        SELECT 
          COUNT(*)::text AS count, 
          COALESCE(MAX(recorded_at)::text, '') AS last_recorded_at
        FROM sensor_data_events
      `
    );

    return res.json({
      success: true,
      totalRecords: Number(rows[0]?.count ?? 0),
      lastRecordedAt: rows[0]?.last_recorded_at ?? null,
    });
  } catch (error) {
    console.error('[SensorData] Health check failed:', error);
    return res.status(500).json({
      success: false,
      error: 'Sensör veri tabanı durumuna ulaşılamadı.',
    });
  }
});

export default router;

