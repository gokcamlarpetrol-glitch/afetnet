import { notificationFormatterService } from '../NotificationFormatterService';

describe('NotificationFormatterService', () => {
  it('masks message content when preview is disabled', () => {
    const formatted = notificationFormatterService.formatMessageNotification(
      'Ali',
      'Gizli içerik burada',
      false,
      false,
      false,
    );

    expect(formatted.body).toBe('Yeni mesajı açmak için dokunun.');
    expect(formatted.ttsText).toBe('Ali kişisinden yeni mesaj var.');
  });

  it('truncates long news title and summary', () => {
    const longTitle = `A`.repeat(120);
    const longSummary = `B`.repeat(300);

    const formatted = notificationFormatterService.formatNewsNotification(
      longTitle,
      longSummary,
      'AFAD',
      undefined,
      true,
    );

    expect(formatted.title.length).toBeLessThanOrEqual(93); // emoji + space + truncated title
    expect(formatted.body.length).toBeLessThanOrEqual(120);
    expect(formatted.body.endsWith('...')).toBe(true);
  });

  it('normalizes negative EEW time advance to zero', () => {
    const formatted = notificationFormatterService.formatEEWNotification(5.2, 'İstanbul', -4);

    expect(formatted.priority).toBe('critical');
    expect(formatted.body).toContain('~0sn');
  });
});
