import { useLocalSearchParams } from "expo-router";
import { nav } from "@/navigation";
import { useState } from "react";
import { Alert } from "react-native";
import { Screen } from "@/components/Screen";
import { Brand } from "@/components/Brand";
import { Button } from "@/components/Button";
import { Input } from "@/components/Input";
import { ThemedText } from "@/components/themed-text";
import { auth } from "@/api";

export default function Verify() {
  const params = useLocalSearchParams<{ email?: string; token?: string }>();
  const [email] = useState(String(params.email ?? ""));
  const [token, setToken] = useState(String(params.token ?? ""));
  const [busy, setBusy] = useState(false);
  const [resending, setResending] = useState(false);

  async function verify() {
    if (!token.trim()) {
      Alert.alert("Verification token required", "Enter the token sent to your email.");
      return;
    }
    setBusy(true);
    try {
      const result = await auth.verifyEmail(token.trim());
      if (!result.verified) throw new Error("The backend did not confirm verification.");
      Alert.alert("Email verified", "Your account is verified. You can now sign in.");
      nav.replace("/login");
    } catch (error) {
      Alert.alert("Verification failed", error instanceof Error ? error.message : "Check the token and try again.");
    } finally {
      setBusy(false);
    }
  }

  async function resend() {
    setResending(true);
    try {
      const result = await auth.resend(email) as { sent?: boolean; verificationToken?: string };
      if (result.verificationToken) setToken(result.verificationToken);
      Alert.alert("Verification requested", result.verificationToken
        ? "A development verification token was returned and filled in."
        : "Check your email for the verification token.");
    } catch (error) {
      Alert.alert("Unable to resend", error instanceof Error ? error.message : "Try again later.");
    } finally {
      setResending(false);
    }
  }

  return (
    <Screen style={{ paddingTop: 50, gap: 20 }}>
      <Brand />
      <ThemedText type="subtitle">Verify your email</ThemedText>
      <ThemedText themeColor="textSecondary">
        Enter the verification token sent to your email address.
      </ThemedText>
      <ThemedText>{email}</ThemedText>
      <Input
        label="Verification token"
        value={token}
        onChangeText={setToken}
        autoCapitalize="none"
        autoCorrect={false}
      />
      <Button title="Verify account" onPress={verify} loading={busy} />
      <Button title="Resend verification token" secondary onPress={resend} loading={resending} />
      <Button title="Back to login" secondary onPress={() => nav.replace("/login")} />
    </Screen>
  );
}
