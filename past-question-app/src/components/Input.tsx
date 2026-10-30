import { StyleSheet, TextInput, type TextInputProps } from "react-native";
import { ThemedText } from "./themed-text";
export function Input({ label, ...p }: TextInputProps & { label: string }) {
  return (
    <ThemedText>
      {label}
      {"\n"}
      <TextInput
        {...p}
        accessibilityLabel={label}
        placeholderTextColor="#888"
        style={s.i}
      />
    </ThemedText>
  );
}
const s = StyleSheet.create({
  i: {
    borderWidth: 1,
    borderColor: "#d0d4da",
    borderRadius: 13,
    padding: 12,
    color: "#111",
    marginTop: 7,
    width: "100%",
  },
});
