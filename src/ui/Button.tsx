import { Pressable, StyleSheet, Text, ViewStyle } from "react-native";
import { palette, spacing } from "./theme";

export default function Button({ 
  label, 
  onPress, 
  variant = "primary", 
  style, 
  disabled = false 
}: { 
  label: string; 
  onPress: () => void; 
  variant?: "primary" | "danger" | "ghost"; 
  style?: ViewStyle; 
  disabled?: boolean 
}) {
  const base = [
    s.btn,
    variant === "danger" ? s.danger : variant === "ghost" ? s.ghost : s.primary,
    disabled && { opacity: 0.5 }
  ];
  
  return (
    <Pressable onPress={onPress} disabled={disabled} style={[...base, style]}>
      <Text style={variant === "ghost" ? s.ghostText : s.text}>{label}</Text>
    </Pressable>
  );
}

const s = StyleSheet.create({
  btn: {
    paddingVertical: spacing(1.5),
    borderRadius: 10,
    alignItems: "center",
    borderWidth: 1
  },
  primary: {
    backgroundColor: palette.primary,
    borderColor: "#1ea952"
  },
  danger: {
    backgroundColor: palette.danger,
    borderColor: "#d73a3a"
  },
  ghost: {
    backgroundColor: "transparent",
    borderColor: palette.border
  },
  text: {
    color: "#05140b",
    fontWeight: "700"
  },
  ghostText: {
    color: palette.text
  }
});