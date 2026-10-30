import { nav } from "@/navigation";
import { useState } from "react";
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  View,
} from "react-native";

import { useAuth } from "@/auth/AuthProvider";
import { Screen } from "@/components/Screen";
import { Brand } from "@/components/Brand";
import { Input } from "@/components/Input";
import { Button } from "@/components/Button";
import { ThemedText } from "@/components/themed-text";

export default function Login() {
  const { login } = useAuth();

  const [e, setE] = useState("");
  const [p, setP] = useState("");
  const [l, setL] = useState(false);

  async function go() {
    setL(true);

    try {
      const u = await login(e, p);

      nav.replace(u.emailVerifiedAt ? "/" : "/verify");
    } catch (x) {
      Alert.alert(
        "Sign in failed",
        x instanceof Error ? x.message : "Unable to sign in.",
      );
    }
  }

  return (
    <Screen style={styles.page}>
      <KeyboardAvoidingView
        style={styles.keyboardView}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        keyboardVerticalOffset={Platform.OS === "ios" ? 20 : 10}
      >
        <View style={styles.content}>
          <View style={styles.c}>
            <Brand />

            <View style={styles.textContainer}>
              <ThemedText type="subtitle">
                Welcome back
              </ThemedText>

              <ThemedText themeColor="textSecondary">
                Use the same account as the Tpaths website.
              </ThemedText>
            </View>

            <Input
              label="Email"
              value={e}
              onChangeText={setE}
              keyboardType="email-address"
              autoCapitalize="none"
              placeholder="you@example.com"
            />

            <Input
              label="Password"
              value={p}
              onChangeText={setP}
              secureTextEntry
              placeholder="••••••••"
            />
          </View>

          <View style={styles.c}>
            <Button
              title="Log in"
              onPress={go}
              loading={l}
            />

            <Button
              title="Create an account"
              secondary
              onPress={() => nav.push("/register")}
            />
          </View>
        </View>
      </KeyboardAvoidingView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  page: {
    flex: 1,
    paddingTop: 60,
  },

  keyboardView: {
    flex: 1,
  },

  content: {
    flex: 1,
    justifyContent: "space-between",
    gap: 22,
  },

  c: {
    gap: 22,
  },

  textContainer: {
    gap: 7,
  },
});
