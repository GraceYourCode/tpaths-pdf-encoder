import { nav } from "@/navigation";
import { StyleSheet, View } from "react-native";
import { Screen } from "@/components/Screen";
import { Brand } from "@/components/Brand";
import { Button } from "@/components/Button";
import { ThemedText } from "@/components/themed-text";
export default function Onboarding() {
  return (
    <Screen style={s.page}>
      <View style={s.c}>
        <Brand />
        <View style={s.hero}>
          <ThemedText type="subtitle">
            Secure study, wherever you are.
          </ThemedText>
          <ThemedText themeColor="textSecondary">
            Access purchased past questions securely, activate your purchase,
            and study from your library.
          </ThemedText>
        </View>
        <View style={s.steps}>
          <ThemedText type="smallBold">01 Welcome to Tpaths</ThemedText>
          <ThemedText type="smallBold">
            02 Access your purchased materials
          </ThemedText>
          <ThemedText type="smallBold">
            03 Activate and start studying
          </ThemedText>
        </View>
      </View>
      <View style={s.c}>
        <Button title="Get Started" onPress={() => nav.push("/login")} />
        <Button
          title="Create an account"
          secondary
          onPress={() => nav.push("/register")}
        />
      </View>
    </Screen>
  );
}
const s = StyleSheet.create({
  page: { paddingTop: 60, gap: 22, flex: 1, justifyContent: "space-between" },
  c: { gap: 22 },
  hero: { gap: 14 },
  steps: { gap: 14 },
});
