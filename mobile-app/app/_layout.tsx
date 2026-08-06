import {
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
  useFonts,
} from "@expo-google-fonts/inter";
import { Ionicons } from "@expo/vector-icons";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Stack, useRouter, useSegments } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import React, { useEffect } from "react";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { ErrorBoundary } from "@/components/ErrorBoundary";
import { AppReviewPrompt } from "@/components/AppReviewPrompt";
import { AuthProvider, useAuth } from "@/context/AuthContext";
import { LocationProvider } from "@/context/LocationContext";
import { LanguageProvider, useLanguage } from "@/context/LanguageContext";
import { useNotifications } from "@/hooks/useNotifications";

SplashScreen.preventAutoHideAsync();

export const queryClient = new QueryClient();

function NavigationGuard() {
  const { user, loading } = useAuth();
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;
    const inAuthGroup = segments[0] === "(auth)";
    if (!user && !inAuthGroup) {
      router.replace("/(auth)/login");
    } else if (user && inAuthGroup) {
      router.replace("/(tabs)");
    }
  }, [user, loading, segments]);

  return null;
}

// Initialises push notifications once the user is authenticated
function NotificationBootstrap() {
  useNotifications();
  return null;
}

function RootLayoutNav() {
  const { t } = useLanguage();

  return (
    <>
      <NavigationGuard />
      <NotificationBootstrap />
      <AppReviewPrompt />
      <Stack screenOptions={{ headerBackTitle: t.back }}>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="(auth)" options={{ headerShown: false }} />
        <Stack.Screen
          name="provider/[id]"
          options={{ headerShown: true, headerTitle: t.providerDetails, headerTransparent: false }}
        />
        <Stack.Screen name="chat/[id]" options={{ headerShown: false }} />
        <Stack.Screen
          name="edit-profile"
          options={{ headerShown: false }}
        />
        <Stack.Screen
          name="register-provider"
          options={({ route }) => ({
            headerShown: true,
            headerTitle: (route.params as { mode?: string } | undefined)?.mode === "edit"
              ? t.editProviderProfile
              : t.registerAsProvider,
          })}
        />
        <Stack.Screen
          name="earnings"
          options={{ headerShown: false }}
        />
        <Stack.Screen
          name="subscription"
          options={{ headerShown: false }}
        />
        <Stack.Screen
          name="referral"
          options={{ headerShown: false }}
        />
        <Stack.Screen
          name="rate-skillad"
          options={{ headerShown: false }}
        />
      </Stack>
    </>
  );
}

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
    ...Ionicons.font,
  });

  useEffect(() => {
    if (fontsLoaded || fontError) {
      SplashScreen.hideAsync();
    }
  }, [fontsLoaded, fontError]);

  if (!fontsLoaded && !fontError) return null;

  return (
    <SafeAreaProvider>
      <ErrorBoundary>
        <QueryClientProvider client={queryClient}>
          <GestureHandlerRootView style={{ flex: 1 }}>
            <AuthProvider>
              <LanguageProvider>
                <LocationProvider>
                  <RootLayoutNav />
                </LocationProvider>
              </LanguageProvider>
            </AuthProvider>
          </GestureHandlerRootView>
        </QueryClientProvider>
      </ErrorBoundary>
    </SafeAreaProvider>
  );
}
