import { Stack, useSegments } from "expo-router";
import { nav } from "@/navigation";
import { AppState, StyleSheet, Text, View, useColorScheme } from "react-native";
import { useEffect, useState } from "react";
import { AuthProvider, useAuth } from "@/auth/AuthProvider";
import { CarterOne_400Regular, useFonts } from "@expo-google-fonts/carter-one";
import { Rubik_400Regular } from "@expo-google-fonts/rubik";

const p = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFill,
    backgroundColor: "#fff",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 99999,
  },
  logo: {
    fontSize: 30,
    fontWeight: "900",
    color: "#b4232f",
    letterSpacing: 3,
    marginBottom: 8,
  },
});
function PrivacyOverlay() {
  const [hidden, setHidden] = useState(AppState.currentState !== "active");
  useEffect(() => {
    const sub = AppState.addEventListener("change", (v) =>
      setHidden(v !== "active"),
    );
    return () => sub.remove();
  }, []);
  return hidden ? (
    <View style={p.overlay}>
      <Text style={p.logo}>TPATHS</Text>
      <Text>Protected content</Text>
    </View>
  ) : null;
}
function Gate() {
  const { user, loading } = useAuth();
  const segments = useSegments();
  useEffect(() => {
    if (loading) return;
    const first = segments[0] as string | undefined;
    if (!user && first !== "onboarding" && first !== "(auth)")
      nav.replace("/onboarding");
    if (user && (first === "onboarding" || first === "(auth)"))
      nav.replace("/(app)");
  }, [loading, user, segments]);
  if (loading) return null;
  return (
    <>
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="onboarding" />
        <Stack.Screen name="(auth)" />
        <Stack.Screen name="(app)" />
        <Stack.Screen
          name="reader"
          options={{ presentation: "fullScreenModal" }}
        />
      </Stack>
      <PrivacyOverlay />
    </>
  );
}
export default function Root() {
  const [fontsLoaded] = useFonts({
    CarterOne: CarterOne_400Regular,
    Rubik: Rubik_400Regular,
  });

  if (!fontsLoaded) {
    return null;
  }

  return (
    <AuthProvider>
      <Gate />
    </AuthProvider>
  );
}
