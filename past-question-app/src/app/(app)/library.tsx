import { useFocusEffect } from "expo-router";
import { nav } from "@/navigation";
import { useCallback, useState } from "react";
import { Alert, StyleSheet, View } from "react-native";
import { users } from "@/api";
import { Screen } from "@/components/Screen";
import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { Button } from "@/components/Button";
import type { License } from "@/types";
import { Brand } from "@/components/Brand";
export default function Library() {
  const [ls, setLs] = useState<License[]>([]);
  const load = useCallback(async () => {
    try {
      setLs(await users.licenses());
    } catch (x) {
      Alert.alert(
        "Library unavailable",
        x instanceof Error ? x.message : "Try again.",
      );
    }
  }, []);
  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );
  return (
    <Screen style={{ paddingTop: 60, gap: 20 }}>
      <Brand />
      <ThemedText type="subtitle">My Library</ThemedText>
      <ThemedText themeColor="textSecondary">
        Only backend-authorized licenses appear here.
      </ThemedText>
      {ls.map((x) => (
        <ThemedView key={x.id} type="backgroundElement" style={s.card}>
          <View style={s.row}>
            <View style={s.flex}>
              <ThemedText type="smallBold">{x.product.title}</ThemedText>
              <ThemedText type="small" themeColor="textSecondary">
                {x.status}
              </ThemedText>
            </View>
            <Button
              title="Details"
              secondary
              onPress={() =>
                nav.push({
                  pathname: "/product/[id]",
                  params: { id: x.productId },
                })
              }
            />
          </View>
        </ThemedView>
      ))}
      {!ls.length && (
        <ThemedView type="backgroundElement" style={s.card}>
          <ThemedText>Your library is empty.</ThemedText>
        </ThemedView>
      )}
    </Screen>
  );
}
const s = StyleSheet.create({
  card: { padding: 16, borderRadius: 16 },
  row: { flexDirection: "row", alignItems: "center", gap: 12 },
  flex: { flex: 1, gap: 4 },
});
