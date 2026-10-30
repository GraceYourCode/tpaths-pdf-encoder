import { useLocalSearchParams } from "expo-router";
import { nav } from "@/navigation";
import { useState } from "react";
import { Alert } from "react-native";
import { Screen } from "@/components/Screen";
import { Brand } from "@/components/Brand";
import { Button } from "@/components/Button";
import { ThemedText } from "@/components/themed-text";
import { useAuth } from "@/auth/AuthProvider";
import { auth } from "@/api";

export default function Verify() {
  const p = useLocalSearchParams<{ email?: string }>();
  const { user, refresh } = useAuth();
  const [email] = useState(String(p.email ?? user?.email ?? ""));
  const [l, setL] = useState(false);

  async function check() {
    const u = await refresh();
    if (u?.emailVerifiedAt) nav.replace("/");
    else
      Alert.alert(
        "Not verified yet",
        "Open the link in your email, then return here.",
      );
  }

  async function resend() {
    setL(true);
    try {
      await auth.resend(email);
      Alert.alert("Email sent", "Check your inbox and spam folder.");
    } catch (x) {
      Alert.alert(
        "Unable to resend",
        x instanceof Error ? x.message : "Try again later.",
      );
    } finally {
      setL(false);
    }
  }
  return (
    <Screen style={{ paddingTop: 50, gap: 20 }}>
      <Brand />
      <ThemedText type="subtitle">Check your email</ThemedText>
      <ThemedText themeColor="textSecondary">
        Verification happens on the Tpaths website. We only re-check the backend
        state here.
      </ThemedText>
      <ThemedText>{email}</ThemedText>
      <Button title="I have verified my email" onPress={check} />
      <Button
        title="Resend verification email"
        secondary
        onPress={resend}
        loading={l}
      />
      <Button
        title="Back to login"
        secondary
        onPress={() => nav.replace("/login")}
      />
    </Screen>
  );
}
