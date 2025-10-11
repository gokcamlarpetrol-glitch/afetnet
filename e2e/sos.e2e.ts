/**
 * E2E Tests for SOS Feature
 * CRITICAL: End-to-end user flow testing
 */

describe('SOS Feature E2E', () => {
  beforeAll(async () => {
    await device.launchApp({
      permissions: {
        location: 'always',
        notifications: 'YES'
      }
    });
  });

  beforeEach(async () => {
    await device.reloadReactNative();
  });

  it('should show SOS button on home screen', async () => {
    await expect(element(by.label('Acil durum SOS sinyali gönder'))).toBeVisible();
  });

  it('should open SOS modal when button pressed', async () => {
    await element(by.label('Acil durum SOS sinyali gönder')).tap();
    await expect(element(by.text('Acil Durum SOS'))).toBeVisible();
  });

  it('should request location permission', async () => {
    await element(by.label('Acil durum SOS sinyali gönder')).tap();
    // Wait for location permission dialog
    await waitFor(element(by.text('Konum İzni'))).toBeVisible().withTimeout(5000);
  });

  it('should validate people count input', async () => {
    await element(by.label('Acil durum SOS sinyali gönder')).tap();
    
    // Try invalid input
    await element(by.id('people-input')).typeText('0');
    await element(by.id('send-sos-button')).tap();
    
    // Should show error or prevent submission
    await expect(element(by.text('Kişi sayısı en az 1 olmalıdır'))).toBeVisible();
  });

  it('should send SOS with valid data', async () => {
    await element(by.label('Acil durum SOS sinyali gönder')).tap();
    
    await element(by.id('people-input')).typeText('2');
    await element(by.id('note-input')).typeText('Enkaz altındayım');
    await element(by.id('priority-high')).tap();
    await element(by.id('send-sos-button')).tap();
    
    // Should show success message
    await waitFor(element(by.text('SOS Gönderildi'))).toBeVisible().withTimeout(10000);
  });

  it('should show countdown for emergency auto-submit', async () => {
    await element(by.label('Acil durum SOS sinyali gönder')).tap();
    
    // Wait for countdown to start
    await waitFor(element(by.id('emergency-countdown'))).toBeVisible().withTimeout(2000);
    
    // Countdown should be visible
    await expect(element(by.id('emergency-countdown'))).toBeVisible();
  });

  it('should auto-submit SOS after countdown', async () => {
    await element(by.label('Acil durum SOS sinyali gönder')).tap();
    
    // Wait for auto-submit (10 seconds)
    await waitFor(element(by.text('SOS Gönderildi')))
      .toBeVisible()
      .withTimeout(15000);
  });

  it('should cancel SOS countdown when user responds', async () => {
    await element(by.label('Acil durum SOS sinyali gönder')).tap();
    
    // Respond to modal (cancel countdown)
    await element(by.id('people-input')).typeText('1');
    
    // Countdown should stop
    await expect(element(by.id('emergency-countdown'))).not.toBeVisible();
  });
});

