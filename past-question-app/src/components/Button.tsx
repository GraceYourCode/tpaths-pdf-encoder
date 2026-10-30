import { ActivityIndicator, Pressable, StyleSheet } from "react-native";
import { ThemedText } from "./themed-text";
import { Colors } from "@/constants/theme";
export function Button({
  title,
  onPress,
  loading,
  disabled,
  secondary,
}: {
  title: string;
  onPress: () => void;
  loading?: boolean;
  disabled?: boolean;
  secondary?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      disabled={disabled || loading}
      style={({ pressed }) => [
        s.base,
        secondary ? s.sec : s.primary,
        pressed && s.pressed,
        (disabled || loading) && s.disabled,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={secondary ? "#111" : "#fff"} />
      ) : (
        <ThemedText style={[s.text, secondary && s.st]}>{title}</ThemedText>
      )}
    </Pressable>
  );
}
const s = StyleSheet.create({
  base: {
    // minHeight: 52,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    padding: 12,
  },
  primary: { backgroundColor: Colors.primary },
  sec: { borderWidth: 1, borderColor: "#ccc" },
  pressed: { opacity: 0.8 },
  disabled: { opacity: 0.5 },
  text: { color: "#fff", fontWeight: "800" },
  st: { color: "#111" },
});
