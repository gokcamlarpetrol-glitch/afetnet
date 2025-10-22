import { StyleSheet, Text, View } from 'react-native';
import { palette, radius, spacing } from './theme';

type Props = { label: string; value: string | number };

export default function StatPill({ label, value }: Props) {
  return (
    <View style={styles.wrap} accessibilityLabel={`${label}: ${value} öğe`}>
      <Text style={styles.label}>{label}</Text>
      <View style={styles.valueBox}>
        <Text style={styles.value}>{value}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flexDirection: 'row', alignItems: 'center', gap: spacing(1) },
  label: { color: palette.textDim, fontSize: 13 },
  valueBox: {
    backgroundColor: palette.surface,
    borderRadius: radius.sm,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: palette.border,
  },
  value: { color: palette.text.primary, fontWeight: '700' },
});
