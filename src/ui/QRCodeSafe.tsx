import React from 'react';
import { View } from 'react-native';

let QR: any;
try {
  QR = (globalThis as any).require('react-native-qrcode-svg').default || require('react-native-qrcode-svg');
} catch {
  QR = null;
}

type Props = {
  value: string;
  size?: number;
  color?: string;
  backgroundColor?: string;
};

export default function QRCodeSafe({
  value,
  size = 160,
  color = '#000',
  backgroundColor = '#fff',
}: Props) {
  if (!QR) {
    return <View style={{ width: size, height: size, backgroundColor }} />;
  }
  return <QR value={value} size={size} color={color} backgroundColor={backgroundColor} />;
}



