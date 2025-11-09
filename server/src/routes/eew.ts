import { Router } from 'express';
import { EEWEvent } from '../eew/EEWProvider';
import { healthEEW } from '../eew';

const r = Router();

r.get('/health', async (_req, res) => {
  try { res.json({ ok: await healthEEW() }); } catch { res.json({ ok: false }); }
});

r.post('/eew/test', async (req, res) => {
  const body = req.body || {};
  const evt: EEWEvent = {
    eventId: String(body.eventId || 'TEST'),
    lat: Number(body.lat || 0),
    lon: Number(body.lon || 0),
    magnitude: body.magnitude != null ? Number(body.magnitude) : 5.2,
    depthKm: body.depthKm != null ? Number(body.depthKm) : 10,
    region: body.region || 'TEST',
    source: body.source || 'manual',
    issuedAt: Date.now(),
    etaSec: body.etaSec != null ? Number(body.etaSec) : 10,
    certainty: (body.certainty as any) || 'high',
  };
  // In this codebase, EEW push transport is wired in the service layer; here we simply echo for dry-run
  res.json({ ok: true, evt });
});

export default r;


