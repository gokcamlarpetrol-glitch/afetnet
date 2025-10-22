import { PropsWithChildren } from 'react';
import { StyleSheet, Text, View, ViewStyle } from 'react-native';
import { palette, spacing } from './theme';

export default function Card({ title, children, style }: PropsWithChildren<{ title?: string; style?: ViewStyle }>) {
  return (
    <View style={[s.card, style]}>
      {title ? <Text style={s.title}>{title}</Text> : null}
      {children}
    </View>
  );
}

const s = StyleSheet.create({
  card: {
    backgroundColor: palette.card,
    borderRadius: 12,
    padding: spacing(2),
    borderWidth: 1,
    borderColor: palette.border,
  },
  title: {
    color: palette.text.primary,
    fontWeight: '600',
    marginBottom: spacing(1),
    fontSize: 16,
  },
});