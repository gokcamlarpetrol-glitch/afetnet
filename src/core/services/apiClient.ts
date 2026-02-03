export async function callApi<T>(path: string, options: RequestInit = {}): Promise<T> {
  const baseUrl = process.env.EXPO_PUBLIC_API_URL || 'https://api.afetnet.app';
  const response = await fetch(`${baseUrl}${path}`, {
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
    ...options,
  });

  if (!response.ok) {
    throw new Error('Sunucuya bağlanılamadı');
  }

  return (await response.json()) as T;
}
