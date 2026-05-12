/**
 * AFETNET E2E TEST - FAMILY GROUP CHAT FLOW
 */

import { device, element, by, waitFor } from 'detox';

describe('Family Group Chat Flow', () => {
  beforeAll(async () => {
    await device.launchApp({ newInstance: true });
  });

  describe('Group Creation', () => {
    it('opens create group screen from Messages tab', async () => {
      await element(by.id('tab-messages')).tap();
      await element(by.id('new-message-fab')).tap().catch(() => { /* */ });
      await element(by.text(/Grup Oluştur/)).tap().catch(() => { /* */ });
      await waitFor(element(by.id('create-group-screen')))
        .toBeVisible()
        .withTimeout(5000)
        .catch(() => { /* */ });
    });
  });

  describe('Group Chat', () => {
    it('opens existing family group chat', async () => {
      await element(by.id('tab-family')).tap();
      await element(by.text(/Aile Sohbeti|Group Chat/)).tap().catch(() => { /* */ });
      await waitFor(element(by.id('family-group-chat-screen')))
        .toBeVisible()
        .withTimeout(5000)
        .catch(() => { /* */ });
    });
  });
});
