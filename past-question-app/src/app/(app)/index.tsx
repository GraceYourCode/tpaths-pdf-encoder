import { useFocusEffect } from "expo-router";
import { nav } from "@/navigation";
import { useCallback, useState } from "react";
import {
  Alert,
  Linking,
  RefreshControl,
  ScrollView,
  StyleSheet,
} from "react-native";
import { users } from "@/api";
import { useAuth } from "@/auth/AuthProvider";
import { Screen } from "@/components/Screen";
import { Brand } from "@/components/Brand";
import { Button } from "@/components/Button";
import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { WEBSITE_URL } from "@/config";
import type { License } from "@/types";

export default function Home() {
  const { user, logout } = useAuth();
  const [licenses, setLicenses] = useState<License[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const load = useCallback(async () => {
    try {
      setLicenses(await users.licenses());
    } catch (e) {
      Alert.alert(
        "Unable to load library",
        e instanceof Error ? e.message : "Try again.",
      );
    }
  }, []);
  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );
  return (
    <Screen scroll={false}>
      <ScrollView
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={async () => {
              setRefreshing(true);
              await load();
              setRefreshing(false);
            }}
          />
        }
        contentContainerStyle={s.c}
      >
        <Brand />
        <ThemedText type="subtitle">Good morning, {user?.firstName}</ThemedText>
        <ThemedText themeColor="textSecondary">
          Your securely connected study library.
        </ThemedText>
        <ThemedView type="backgroundElement" style={s.card}>
          <ThemedText themeColor="textSecondary">Your Library</ThemedText>
          <ThemedText style={s.n}>{licenses.length}</ThemedText>
          <ThemedText>Purchased products</ThemedText>
        </ThemedView>
        {licenses.length ? (
          licenses.slice(0, 3).map((x) => (
            <ThemedView key={x.id} type="backgroundElement" style={s.card}>
              <ThemedText type="smallBold">{x.product.title}</ThemedText>
              <ThemedText themeColor="textSecondary">{x.status}</ThemedText>
              <Button
                title="Open"
                onPress={() =>
                  nav.push({
                    pathname: "/product/[id]",
                    params: { id: x.productId },
                  })
                }
              />
            </ThemedView>
          ))
        ) : (
          <ThemedView type="backgroundElement" style={s.card}>
            <ThemedText>Your library is empty.</ThemedText>
            <ThemedText themeColor="textSecondary">
              Purchase on the Tpaths website, then activate your token here.
            </ThemedText>
          </ThemedView>
        )}
        <Button
          title="Activate a purchase"
          onPress={() => nav.push("/activate")}
        />
        <Button
          title="Browse Tpaths website"
          secondary
          onPress={() => Linking.openURL(WEBSITE_URL)}
        />
        <Button title="Log out" secondary onPress={logout} />
      </ScrollView>
    </Screen>
  );
}

const s = StyleSheet.create({
  c: { padding: 24, paddingTop: 50, paddingBottom: 60, gap: 16 },
  card: { padding: 18, borderRadius: 16, gap: 7 },
  n: { fontSize: 42, fontWeight: "800" },
});
