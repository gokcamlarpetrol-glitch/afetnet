import { Platform } from 'react-native';
import PushNotification from 'react-native-push-notification';
export const createNotifChannelIfNeeded = () => {
  if (Platform.OS !== 'android') return;
  PushNotification.createChannel({ channelId:'afetnet', channelName:'Afetnet', importance:4 }, ()=>{});
};
