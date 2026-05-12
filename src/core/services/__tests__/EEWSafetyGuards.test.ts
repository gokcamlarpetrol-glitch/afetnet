import fs from 'fs';
import path from 'path';

const servicesRoot = path.resolve(__dirname, '..');

describe('EEW safety guards', () => {
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
});
