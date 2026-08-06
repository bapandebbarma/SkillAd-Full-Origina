import React, { createContext, useContext, useState, useEffect, useRef, ReactNode } from "react";
import { AppState, Platform } from "react-native";
import * as Location from "expo-location";
import { supabase } from "@/lib/supabase";

interface LocationData {
  latitude: number;
  longitude: number;
  address: string;
}

interface LocationContextValue {
  location: LocationData | null;
  permissionGranted: boolean;
  loading: boolean;
  requestPermission: () => Promise<void>;
  refreshLocation: () => Promise<void>;
}

const AGARTALA_FALLBACK: LocationData = {
  latitude: 23.8315,
  longitude: 91.2868,
  address: "Agartala, Tripura",
};

// Minimum age before a foreground-resume triggers a GPS re-read.
// Keeps battery usage low for short background trips (e.g. checking a notification).
const STALE_THRESHOLD_MS = 5 * 60 * 1000; // 5 minutes

const LocationContext = createContext<LocationContextValue>({
  location: null,
  permissionGranted: false,
  loading: false,
  requestPermission: async () => {},
  refreshLocation: async () => {},
});

async function saveLocationToSupabase(lat: number, lon: number, city: string) {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user?.id) return;
    await supabase
      .from("profiles")
      .update({ last_latitude: lat, last_longitude: lon, last_city: city })
      .eq("id", session.user.id);
  } catch {
    // Non-fatal — column may not exist yet in Supabase schema
  }
}

export function LocationProvider({ children }: { children: ReactNode }) {
  const [location, setLocation] = useState<LocationData | null>(null);
  const [permissionGranted, setPermissionGranted] = useState(false);
  const [loading, setLoading] = useState(false);

  // Refs used inside the AppState listener (avoids stale closure captures).
  const permGrantedRef = useRef(false);
  const locationTimestampRef = useRef<number>(0); // epoch ms of last successful GPS read

  // Keep the permission ref in sync with state on every render.
  permGrantedRef.current = permissionGranted;

  // ── Initial GPS fetch on mount ──────────────────────────────────────────
  useEffect(() => {
    if (Platform.OS === "web") {
      setLocation(AGARTALA_FALLBACK);
      setPermissionGranted(true);
      return;
    }
    initLocation();
  }, []);

  // ── Foreground-resume listener ──────────────────────────────────────────
  // When the app returns to the foreground:
  //   • Permission denied  → skip entirely (location stays null → all providers shown)
  //   • Location is fresh  → skip (< STALE_THRESHOLD_MS since last GPS read)
  //   • Location is stale  → re-read GPS, update state → React Query key changes → providers refetched
  useEffect(() => {
    if (Platform.OS === "web") return;

    const sub = AppState.addEventListener("change", (nextState) => {
      if (nextState !== "active") return;          // only fire on foreground
      if (!permGrantedRef.current) return;         // no permission → no crash, do nothing
      const ageMs = Date.now() - locationTimestampRef.current;
      if (ageMs < STALE_THRESHOLD_MS) return;      // fresh — skip refresh, no extra API call
      setLoading(true);
      fetchLocation().finally(() => setLoading(false));
    });

    return () => sub.remove();
  }, []); // stable — intentionally empty: uses refs, not captured state

  async function initLocation() {
    setLoading(true);
    try {
      const { status: existing } = await Location.getForegroundPermissionsAsync();
      if (existing === "granted") {
        setPermissionGranted(true);
        await fetchLocation();
        return;
      }
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status === "granted") {
        setPermissionGranted(true);
        await fetchLocation();
      } else {
        // Permission denied: do NOT use Agartala fallback as filter coords.
        // null location → API called without lat/lng → no radius filter → all providers shown.
        setPermissionGranted(false);
        setLocation(null);
      }
    } finally {
      setLoading(false);
    }
  }

  async function fetchLocation() {
    try {
      const pos = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });
      const reverseGeocode = await Location.reverseGeocodeAsync({
        latitude: pos.coords.latitude,
        longitude: pos.coords.longitude,
      });
      const geo = reverseGeocode[0];
      const area = geo?.district ?? geo?.subregion ?? geo?.city ?? "Your Area";
      const city = geo?.city ?? geo?.region ?? "";
      const address = city && city !== area ? `${area}, ${city}` : area;
      const locationData: LocationData = {
        latitude: pos.coords.latitude,
        longitude: pos.coords.longitude,
        address,
      };
      setLocation(locationData);
      locationTimestampRef.current = Date.now(); // record timestamp of this GPS read
      saveLocationToSupabase(locationData.latitude, locationData.longitude, locationData.address);
    } catch {
      setLocation(AGARTALA_FALLBACK);
      locationTimestampRef.current = Date.now();
      saveLocationToSupabase(AGARTALA_FALLBACK.latitude, AGARTALA_FALLBACK.longitude, AGARTALA_FALLBACK.address);
    }
  }

  async function requestPermission() {
    if (Platform.OS === "web") {
      setPermissionGranted(true);
      setLocation(AGARTALA_FALLBACK);
      saveLocationToSupabase(AGARTALA_FALLBACK.latitude, AGARTALA_FALLBACK.longitude, AGARTALA_FALLBACK.address);
      return;
    }
    setLoading(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status === "granted") {
        setPermissionGranted(true);
        await fetchLocation();
      }
    } finally {
      setLoading(false);
    }
  }

  async function refreshLocation() {
    if (!permissionGranted) {
      await requestPermission();
      return;
    }
    setLoading(true);
    try {
      await fetchLocation();
    } finally {
      setLoading(false);
    }
  }

  return (
    <LocationContext.Provider value={{ location, permissionGranted, loading, requestPermission, refreshLocation }}>
      {children}
    </LocationContext.Provider>
  );
}

export function useLocation() {
  return useContext(LocationContext);
}
