import { aiAssistantCoordinator } from '../AIAssistantCoordinator';

jest.mock('@react-native-community/netinfo', () => ({
  __esModule: true,
  default: {
    fetch: jest.fn().mockResolvedValue({
      isConnected: false,
      isInternetReachable: false,
    }),
  },
  fetch: jest.fn().mockResolvedValue({
    isConnected: false,
    isInternetReachable: false,
  }),
}));

describe('AIAssistantCoordinator', () => {
  it('adds medical disclaimer to offline first-aid responses', async () => {
    const response = await aiAssistantCoordinator.chat('Kanama nasıl durdurulur?');

    expect(response.source).toBe('offline');
    expect(['FIRST_AID', 'INJURY']).toContain(response.intent);
    expect(response.answer).toContain('Bu bilgi tıbbi tavsiye değildir');
    expect(response.answer).toContain('112');
  });
});
