import { nav } from "@/navigation";
import { useState } from "react";
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  View,
} from "react-native";

import { useAuth } from "@/auth/AuthProvider";
import { Screen } from "@/components/Screen";
import { Brand } from "@/components/Brand";
import { Input } from "@/components/Input";
import { Button } from "@/components/Button";
import { ThemedText } from "@/components/themed-text";

const strong = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{12,}$/;

export default function Register() {
  const { register } = useAuth();

  const [f, setF] = useState("");
  const [l, setL] = useState("");
  const [e, setE] = useState("");
  const [w, setW] = useState("");
  const [p, setP] = useState("");
  const [c, setC] = useState("");
  const [busy, setBusy] = useState(false);

  async function go() {
    if (!f || !l || !e || !w) {
      return Alert.alert(
        "Missing details",
        "Complete all fields.",
      );
    }

    if (!strong.test(p)) {
      return Alert.alert(
        "Password too weak",
        "Use 12+ characters with upper, lower, and number.",
      );
    }

    if (p !== c) {
      return Alert.alert(
        "Passwords do not match",
        "Enter the same password twice.",
      );
    }

    setBusy(true);

    try {
      await register({
        firstName: f,
        lastName: l,
        email: e,
        password: p,
        whatsapp: w,
      });

      nav.replace({
        pathname: "/verify",
        params: { email: e },
      });
    } catch (error: Error | unknown) {
        console.log("Registration errorssss:", (error as Error).message);
      Alert.alert(
        "Registration failed",
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <Screen style={styles.screen}>
      <KeyboardAvoidingView
        style={styles.keyboardView}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        keyboardVerticalOffset={Platform.OS === "ios" ? 20 : 0}
      >
        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.form}>
            <Brand />

            <ThemedText type="subtitle">
              Create account
            </ThemedText>

            <Input
              label="First name"
              value={f}
              onChangeText={setF}
              autoCapitalize="words"
            />

            <Input
              label="Last name"
              value={l}
              onChangeText={setL}
              autoCapitalize="words"
            />

            <Input
              label="Email"
              value={e}
              onChangeText={setE}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
            />

            <Input
              label="WhatsApp number"
              value={w}
              onChangeText={setW}
              keyboardType="phone-pad"
            />

            <Input
              label="Password"
              value={p}
              onChangeText={setP}
              secureTextEntry
            />

            <Input
              label="Confirm password"
              value={c}
              onChangeText={setC}
              secureTextEntry
            />

            <Button
              title="Create account"
              onPress={go}
              loading={busy}
            />
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    paddingTop: 60,
  },

  keyboardView: {
    flex: 1,
  },

  content: {
    flexGrow: 1,
    paddingBottom: 30,
  },

  form: {
    gap: 22,
  },
});
