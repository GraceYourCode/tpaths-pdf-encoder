import { StyleSheet, View } from "react-native";
import { ThemedText } from "./themed-text";
import { Image } from "expo-image";
import { Colors } from "@/constants/theme";
export function Brand() {
  return (
    <View style={s.row}>
      <Image
      source={require('../../assets/images/tpaths-logo.svg')}
      style={{
        width: 25,
        height: 25,
      }}
    />
      <ThemedText style={s.word}>TPATHS</ThemedText>
    </View>
  );
}
const s = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", gap: 5 },
  word: { fontSize: 18, letterSpacing: .3, fontFamily: "CarterOne", color: Colors.brand },
});
