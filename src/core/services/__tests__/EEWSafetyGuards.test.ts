import fs from 'fs';
import path from 'path';

const servicesRoot = path.resolve(__dirname, '..');

describe('EEW safety guards', () => {
  const repoRoot = path.resolve(servicesRoot, '../../..');

  it('caps on-device confidence magnitude boost to +0.3 max', () => {
    const source = fs.readFileSync(
      path.join(servicesRoot, 'seismic/OnDeviceEEWService.ts'),
      'utf8',
    );

    expect(source).toContain('const confMultiplier = normalizedConfidence * 0.3;');
  });

  it('limits PLUM observation query load', () => {
    const source = fs.readFileSync(
      path.join(servicesRoot, 'PLUMEEWService.ts'),
      'utf8',
    );

    expect(source).toContain('const MAX_OBSERVATIONS = 50;');
    expect(source).toContain('limit(MAX_OBSERVATIONS)');
  });

  it('parses backend EEW provider timestamps with correct timezone handling and rejects stale/future events', () => {
    // görev #18: v1.6.3 yeniden çalışması sembolleri yeniden adlandırdı —
    // AFAD apiv2 UTC döndürdüğü için sorgu penceresi artık UTC üretilir
    // (formatTurkeyApiDateTimeFromMs → formatUtcApiDateTimeFromMs) ve AFAD
    // olayları parseAfadUtcDateTime ile UTC ayrıştırılır. parseTurkeyLocalDateTime
    // YALNIZCA Kandilli (yerel saatle yayımlar) için korundu. Test'in amacı
    // (saat dilimi doğruluğu + bayat/gelecek olay reddi) değişmedi.
    const source = fs.readFileSync(
      path.join(repoRoot, 'functions/src/eew.ts'),
      'utf8',
    );

    // AFAD sorgu penceresi UTC üretilir (yerel saat değil)
    expect(source).toContain('formatUtcApiDateTimeFromMs');
    // AFAD olay zaman damgaları UTC ayrıştırılır
    expect(source).toContain('parseAfadUtcDateTime');
    // Kandilli (yerel saat) için ayrı ayrıştırıcı korunur
    expect(source).toContain('parseTurkeyLocalDateTime');
    // Bayat / gelecek tarihli olaylar reddedilir
    expect(source).toContain('isFreshOfficialEvent');
    expect(source).toContain('OFFICIAL_EVENT_MAX_FUTURE_SKEW_MS');
  });

  it('prevents non-critical backend EEW alerts from falling back to country-wide fanout', () => {
    const source = fs.readFileSync(
      path.join(repoRoot, 'functions/src/eew.ts'),
      'utf8',
    );

    expect(source).toContain('Skipping broad EEW topic send for non-critical event; using proximity-scoped fan-out only');
    expect(source).toContain('? await getAllTokensMerged()');
    expect(source).toContain(': await getNearbyTokens(event.latitude, event.longitude, radiusKm, false)');
    expect(source).toContain('allowGlobalFallback && nearbyTokens.length < 10');
  });

  it('requires recent P-wave Firestore timestamps to reduce replay/spoofing risk', () => {
    const rules = fs.readFileSync(
      path.join(repoRoot, 'firestore.rules'),
      'utf8',
    );

    const pWaveRule = rules.slice(
      rules.indexOf('match /eew_pwave_detections'),
      rules.indexOf('match /eew_broadcasts'),
    );

    expect(pWaveRule).toContain('isRecentClientTimestamp(request.resource.data.timestamp)');
    expect(pWaveRule).toContain('request.resource.data.userId == request.auth.uid');
    expect(pWaveRule).toContain('request.resource.data.magnitude is number');
    expect(pWaveRule).toContain('request.resource.data.staltaRatio is number');
  });
});
