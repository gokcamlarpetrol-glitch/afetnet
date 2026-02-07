import fs from 'fs';
import path from 'path';

const repoRoot = path.resolve(__dirname, '..');
const readServiceFile = (name: string) =>
  fs.readFileSync(path.join(repoRoot, `${name}.ts`), 'utf8');

describe('Notification startup prompt safety', () => {
  it('FirebaseService initialize defers prompt to explicit user action', () => {
    const source = readServiceFile('FirebaseService');
    const initializeBlock = source.match(/async initialize\(\)[\s\S]*?setupForegroundMessageHandler/s)?.[0] || '';

    expect(initializeBlock).toContain('getPermissionsAsync');
    expect(initializeBlock).not.toContain('requestPermissionsAsync');
    expect(initializeBlock).toContain('deferred');
  });

  it('ComprehensiveNotificationService initialize never prompts on app start', () => {
    const source = readServiceFile('ComprehensiveNotificationService');
    const initializeBlock = source.match(/async initialize\(\): Promise<void> \{[\s\S]*?this\.isInitialized = true/s)?.[0] || '';

    expect(initializeBlock).toContain('getPermissionsAsync');
    expect(initializeBlock).not.toContain('requestPermissionsAsync');
    expect(initializeBlock).toContain('deferred');
  });

  it('UltraFastEEWNotification warmup checks status but does not open prompt', () => {
    const source = readServiceFile('UltraFastEEWNotification');
    const warmupBlock = source.match(/async warmup\(\): Promise<void> \{[\s\S]*?prewarmTTS\(\);/s)?.[0] || '';

    expect(warmupBlock).toContain('getPermissionsAsync');
    expect(warmupBlock).not.toContain('requestPermissionsAsync');
  });
});
