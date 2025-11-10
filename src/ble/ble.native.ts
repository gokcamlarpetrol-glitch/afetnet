import { Platform } from 'react-native';

// @ts-ignore
import * as IOS from './ble.ios';
// @ts-ignore
import * as Android from './ble.android';

// @ts-ignore
export const startScan = Platform.OS === 'ios' ? IOS.startScan : Android.startScan;
// @ts-ignore
export const stopScan = Platform.OS === 'ios' ? IOS.stopScan : Android.stopScan;
// @ts-ignore
export const advertise = Platform.OS === 'ios' ? IOS.advertise : Android.advertise;
// @ts-ignore
export const stopAdvertise = Platform.OS === 'ios' ? IOS.stopAdvertise : Android.stopAdvertise;
// @ts-ignore
export const encodeLocation = Platform.OS === 'ios' ? IOS.encodeLocation : Android.encodeLocation;
// @ts-ignore
export const encodeText = Platform.OS === 'ios' ? IOS.encodeText : Android.encodeText;
// @ts-ignore
export const encodeTextV2 = Platform.OS === 'ios' ? IOS.encodeTextV2 : Android.encodeTextV2;
// @ts-ignore
export const packLoc2 = Platform.OS === 'ios' ? IOS.packLoc2 : Android.packLoc2;
// @ts-ignore
export const encodeSOSWithStatus = Platform.OS === 'ios' ? IOS.encodeSOSWithStatus : Android.encodeSOSWithStatus;
