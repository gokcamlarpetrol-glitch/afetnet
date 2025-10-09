import { Linking } from 'react-native';
import { saveActivation, Activation } from '../store/activation';

export function parseActivationUrl(url: string): { serverUrl: string; secret?: string } | null {
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== 'afetnet:') {return null;}
    if (parsed.hostname !== 'activate') {return null;}
    
    const serverUrl = parsed.searchParams.get('u');
    const secret = parsed.searchParams.get('s') || undefined;
    
    if (!serverUrl) {return null;}
    
    return { serverUrl: decodeURIComponent(serverUrl), secret };
  } catch (e) {
    console.warn('Failed to parse activation URL:', e);
    return null;
  }
}

export async function handleActivationUrl(url: string): Promise<boolean> {
  const parsed = parseActivationUrl(url);
  if (!parsed) {return false;}
  
  const activation: Activation = {
    serverUrl: parsed.serverUrl,
    secret: parsed.secret,
    createdAt: Date.now(),
  };
  
  await saveActivation(activation);
  return true;
}

export function setupDeepLinkListener(onActivation: () => void) {
  const handleUrl = async (url: string) => {
    if (await handleActivationUrl(url)) {
      onActivation();
    }
  };
  
  // Handle initial URL if app was opened via deep link
  Linking.getInitialURL().then((url) => {
    if (url) {handleUrl(url);}
  }).catch(() => {
    // Ignore errors
  });
  
  // Handle subsequent deep links
  const subscription = Linking.addEventListener('url', ({ url }) => {
    handleUrl(url);
  });
  
  return () => subscription?.remove();
}
