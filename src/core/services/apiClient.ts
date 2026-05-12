export async function callApi<T>(path: string, options: RequestInit = {}): Promise<T> {
  const baseUrl = process.env.EXPO_PUBLIC_API_URL || 'https://api.afetnet.app';

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 15000);

  try {
    const response = await fetch(`${baseUrl}${path}`, {
      headers: {
        'Content-Type': 'application/json',
        ...(options.headers || {}),
      },
      ...options,
      signal: controller.signal,
    });

    if (!response.ok) {
      throw new Error('Sunucuya bağlanılamadı');
    }

    return (await response.json()) as T;
  } finally {
    clearTimeout(timeoutId);
  }
}
