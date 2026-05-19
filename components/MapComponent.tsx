import React, { useEffect, useState, useRef, useCallback } from "react";
import { View, Text, StyleSheet } from "react-native";
import LeafletMap from "./LeafletMap";
import TrafficSignals, { useTrafficSignals } from "./TrafficSignals";
import { db } from "../firebase";
import { collection, getDocs } from "firebase/firestore";
import * as Location from "expo-location";
import { getFreeRoute, LatLng } from "../utils/osmRouting";

// 📍 Types
type LocationType = {
  latitude: number;
  longitude: number;
};

type Hospital = {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
}; `   `

type Props = {
  ambulanceLocation: LocationType;
  policeLocation: LocationType | null;
  destination?: (LocationType & { name?: string; id?: string }) | null;
  restrictToSignal?: { id: string; latitude: number; longitude: number; name: string } | null;
};

// 🗺️ Stadia Maps Tile Template (Production Grade)
const STADIA_API_KEY = process.env.EXPO_PUBLIC_STADIA_API_KEY || "YOUR_KEY"; // Get yours at https://stadiamaps.com/
const STADIA_TILE_URL = `https://tiles.stadiamaps.com/tiles/alidade_smooth/{z}/{x}/{y}.png?api_key=${STADIA_API_KEY}`;

// 🔑 OpenRouteService API Key (Sign up at https://openrouteservice.org/ for free key)
// Using a placeholder or public OSRM mirror is also possible for "completely free"
const ORS_API_KEY = process.env.EXPO_PUBLIC_ORS_API_KEY || "5b3ce3597851110001cf62486716a1b2184f4e7087644265f2425000";

export default function MapComponent({ ambulanceLocation, policeLocation, destination, restrictToSignal }: Props) {
  const mapRef = useRef<any>(null);
  const [hospitals, setHospitals] = useState<Hospital[]>([]);
  const [routeCoords, setRouteCoords] = useState<LocationType[]>([]);
  const [routeStatus, setRouteStatus] = useState<string>("Initializing...");
  const [eta, setEta] = useState<string | null>(null);
  const [distance, setDistance] = useState<string | null>(null);
  
  const signals = useTrafficSignals(); // 🚦 Fetch traffic signals dynamically

  // ✅ Fetch hospitals from Firestore
  useEffect(() => {
    const fetchHospitals = async () => {
      try {
        const snapshot = await getDocs(collection(db, "hospitals"));
        const data: Hospital[] = snapshot.docs.map(doc => {
          const d = doc.data();
          return {
            id: doc.id,
            name: d.name,
            latitude: Number(d.latitude),
            longitude: Number(d.longitude),
          };
        });
        setHospitals(data);
      } catch (e) {
        console.log("Hospital fetch error:", e);
      }
    };
    fetchHospitals();
  }, []);

  // 🛣️ Fetch route using Free Alternatives (OpenRouteService -> OSRM -> Straight Line)
  const fetchRoute = useCallback(async () => {
    if (!ambulanceLocation || !destination) {
      setRouteCoords([]);
      setEta(null);
      setDistance(null);
      setRouteStatus(destination ? "Waiting for location..." : "⚠️ No destination set");
      return;
    }

    try {
      const result = await getFreeRoute(ambulanceLocation, destination);
      setRouteCoords(result.coords);
      setDistance(result.distance);
      setEta(result.eta);
      setRouteStatus(`🛣️ Route: ${result.status}`);
    } catch (err) {
      console.log("Routing Error:", err);
      setRouteStatus("⚠️ Routing Error");
    }
  }, [ambulanceLocation?.latitude, ambulanceLocation?.longitude, destination?.latitude, destination?.longitude]);

  // 🔄 Auto-refresh route every 20 seconds
  useEffect(() => {
    fetchRoute();
    const interval = setInterval(fetchRoute, 20000);
    return () => clearInterval(interval);
  }, [fetchRoute]);

  // ✨ Auto-fit map when destination is first set
  useEffect(() => {
    if (!restrictToSignal && mapRef.current && ambulanceLocation && destination) {
      mapRef.current.fitToCoordinates([ambulanceLocation, destination], {
        edgePadding: { top: 100, right: 60, bottom: 250, left: 60 }, // Extra bottom padding for banner
        animated: true,
      });
    }
  }, [destination?.latitude, destination?.longitude]); // Only fit when target destination coordinates change


  return (
    <View style={styles.container}>
      <LeafletMap
        ambulanceLocation={ambulanceLocation}
        policeLocation={policeLocation}
        destination={destination ?? null}
        routeCoords={routeCoords}
        signals={signals}
        hospitals={hospitals}
      />

      {/* ⚖️ Attribution (Required by OSM Policy) */}
      <View style={styles.attribution}>
        <Text style={styles.attributionText}>© OpenStreetMap contributors</Text>
      </View>

      {/* 📡 Professional Status Dashboard */}
      <View style={styles.statusBanner}>
        <View style={styles.statusHeader}>
          <View style={styles.onlineDot} />
          <Text style={styles.statusTitle}>LIFELINE SYSTEM</Text>
        </View>

        <Text style={styles.statusMainText}>{routeStatus}</Text>

        {destination && distance && (
          <View style={styles.statsRow}>
            <View style={styles.statBox}>
              <Text style={styles.statLabel}>DISTANCE</Text>
              <Text style={styles.statValue}>{distance}</Text>
            </View>
            <View style={[styles.statBox, styles.statDivider]}>
              <Text style={styles.statLabel}>ETA</Text>
              <Text style={styles.statValue}>{eta}</Text>
            </View>
          </View>
        )}

        {destination && (
          <Text style={styles.targetName}>📍 {destination.name || "Target Hospital"}</Text>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#EBEBEB" },
  map: { flex: 1 },
  markerContainer: {
    alignItems: "center",
    justifyContent: "center",
  },
  markerPulse: {
    position: "absolute",
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(255, 0, 0, 0.2)",
    zIndex: -1,
  },
  emoji: { fontSize: 32 },
  emojiSmall: { fontSize: 22 },
  attribution: {
    position: "absolute",
    bottom: 5,
    right: 5,
    backgroundColor: "rgba(255,255,255,0.7)",
    paddingHorizontal: 5,
    borderRadius: 3,
  },
  attributionText: {
    fontSize: 8,
    color: "#444",
  },
  statusBanner: {
    position: "absolute",
    bottom: 30,
    alignSelf: "center",
    width: "92%",
    backgroundColor: "rgba(26, 26, 26, 0.95)", // Glassmorphism-ish
    borderRadius: 24,
    padding: 20,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.5,
    shadowRadius: 15,
    elevation: 8,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.1)",
  },
  statusHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 8,
  },
  onlineDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#4CAF50",
    marginRight: 8,
  },
  statusTitle: {
    color: "#888",
    fontSize: 10,
    fontWeight: "900",
    letterSpacing: 2,
  },
  statusMainText: {
    color: "#FFF",
    fontSize: 14,
    fontWeight: "600",
    marginBottom: 12
  },
  statsRow: {
    flexDirection: "row",
    backgroundColor: "#262626",
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
  },
  statBox: {
    flex: 1,
    alignItems: "center",
  },
  statDivider: {
    borderLeftWidth: 1,
    borderLeftColor: "#444",
  },
  statLabel: {
    color: "#AAA",
    fontSize: 10,
    fontWeight: "bold",
    marginBottom: 4,
  },
  statValue: {
    color: "#4A90E2",
    fontSize: 20,
    fontWeight: "800",
  },
  targetName: {
    color: "#AAA",
    fontSize: 12,
    fontStyle: "italic",
    textAlign: "center"
  }
});