import React, { useEffect, useState, useRef } from "react";
import { View, Text, StyleSheet, ActivityIndicator, TouchableOpacity, ScrollView } from "react-native";
import { auth, db } from "../firebase";
import { doc, onSnapshot, collection, query, where, setDoc } from "firebase/firestore";
import LeafletMap from "../components/LeafletMap";
import * as Location from "expo-location";
import { getDistance } from "geolib";
import { Ionicons } from "@expo/vector-icons";
import { registerForPushNotifications, setupNotificationListeners, sendLocalEmergencyNotification } from "../utils/notificationService";

import { isDeviceOnline, isValidLocation } from "../utils/trackingUtils";

// Geofence Constants (Pondicherry Center)
const FENCE_CENTER = { latitude: 11.9416, longitude: 79.8083 };
const FENCE_RADIUS = 5000; // 5km

type LocationType = {
  latitude: number;
  longitude: number;
};

export default function PoliceScreen() {
  const [activeAmbulances, setActiveAmbulances] = useState<any[]>([]);
  const [policeLocation, setPoliceLocation] = useState<LocationType | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [inFence, setInFence] = useState(true);
  const [signals, setSignals] = useState<any[]>([]);
  const [currentTime, setCurrentTime] = useState(Date.now());
  
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(Date.now()), 15000); // More frequent update for smoothness
    return () => clearInterval(timer);
  }, []);
  
  const alertedSignalsRef = useRef<Set<string>>(new Set());
  const userId = auth.currentUser?.uid || "anonymous_police";
  const themeColor = '#3b82f6';

  useEffect(() => {
    registerForPushNotifications(userId);
    const cleanupListeners = setupNotificationListeners();
    return () => cleanupListeners();
  }, []);

  // Listen for signals to trigger notifications
  useEffect(() => {
    const unsubSig = onSnapshot(collection(db, "TrafficSignals"), (snapshot) => {
      try {
        const allSignals: any[] = [];
        snapshot.docChanges().forEach((change) => {
          if (change.type === "modified" || change.type === "added") {
            const data = change.doc.data();
            const signalId = change.doc.id;
            if (data.status === "GREEN" && !alertedSignalsRef.current.has(signalId)) {
              sendLocalEmergencyNotification(data.name || "Nearby Signal");
              alertedSignalsRef.current.add(signalId);
            } else if (data.status !== "GREEN") {
              alertedSignalsRef.current.delete(signalId);
            }
          }
        });
        snapshot.docs.forEach((doc) => {
          allSignals.push({ id: doc.id, ...doc.data() });
        });
        setSignals(allSignals);
      } catch (err) {
        console.error("Signal listener error:", err);
      }
    }, (err) => {
      console.error("Firestore Signal unsub error:", err);
      setError("Failed to sync traffic signals.");
    });
    return () => unsubSig();
  }, []);

  // Listen for active ambulances
  useEffect(() => {
    const q = query(collection(db, "ambulances"), where("active", "==", true));
    const unsub = onSnapshot(q, (snapshot) => {
      try {
        const ambulances: any[] = [];
        snapshot.forEach((doc) => {
          const data = doc.data();
          if (data?.latitude && data?.longitude) {
            ambulances.push({
              id: doc.id,
              latitude: data.latitude,
              longitude: data.longitude,
              destination: data.destination || null,
              active: data.active,
              timestamp: data.timestamp,
              ...data
            });
          }
        });
        setActiveAmbulances(ambulances);
        setLoading(false);
      } catch (err) {
        console.error("Ambulance listener error:", err);
      }
    }, (err) => {
      console.error("Firestore Ambulance unsub error:", err);
      setError("Failed to sync ambulance data.");
      setLoading(false);
    });
    return () => unsub();
  }, []);

  // Track police location with geofencing
  useEffect(() => {
    let locationSubscription: any;
    const startTracking = async () => {
      try {
        let { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== "granted") {
          setError("Location permission denied. Map features limited.");
          setLoading(false);
          return;
        }

        locationSubscription = await Location.watchPositionAsync(
          { accuracy: Location.Accuracy.High, distanceInterval: 10 },
          async (loc) => {
            // Validate accuracy
            if (!isValidLocation({ ...loc.coords })) return;

            const pLoc = { latitude: loc.coords.latitude, longitude: loc.coords.longitude };
            setPoliceLocation(pLoc);
            
            // Geofence check
            const distFromCenter = getDistance(pLoc, FENCE_CENTER);
            const isInside = distFromCenter <= FENCE_RADIUS;
            setInFence(isInside);

            if (isInside) {
              try {
                await setDoc(doc(db, "police_units", userId), { 
                  ...pLoc, 
                  lastUpdate: Date.now(), 
                  active: true,
                  id: userId
                }, { merge: true });
              } catch (e) { console.error("Police location sync error:", e); }
            }
          }
        );
      } catch (e) {
        console.error("Tracking startup error:", e);
        setError("Could not initialize GPS tracking.");
        setLoading(false);
      }
    };
    startTracking();
    return () => { if (locationSubscription) locationSubscription.remove(); };
  }, []);

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={themeColor} />
        <Text style={styles.loadingText}>Initializing Dashboard...</Text>
      </View>
    );
  }

  const onlineAmbulances = activeAmbulances.filter(amb => 
    isDeviceOnline(amb.active, amb.timestamp, currentTime)
  );

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>Police Dashboard</Text>
          <Text style={styles.subtitle}>
            {onlineAmbulances.length > 0 ? `🚑 Tracking ${onlineAmbulances.length} Active Emergencies` : "🛡️ Patrol Mode"}
          </Text>
        </View>
        <View style={[styles.statusBadge, { backgroundColor: inFence ? 'rgba(34, 197, 94, 0.1)' : 'rgba(239, 68, 68, 0.1)' }]}>
          <View style={[styles.dot, { backgroundColor: inFence ? '#22c55e' : '#ef4444' }]} />
          <Text style={[styles.statusText, { color: inFence ? '#22c55e' : '#ef4444' }]}>
            {inFence ? "IN FENCE" : "OUTSIDE"}
          </Text>
        </View>
      </View>

      <View style={styles.mapContainer}>
        <LeafletMap 
          ambulances={onlineAmbulances}
          policeLocation={policeLocation}
          destination={null}
          signals={policeLocation ? signals.filter(sig => getDistance(policeLocation, { latitude: Number(sig.latitude), longitude: Number(sig.longitude) }) <= 300) : []}
        />
      </View>

      <View style={styles.infoCard}>
        <View style={styles.infoRow}>
          <Ionicons name="information-circle" size={20} color={themeColor} />
          <Text style={styles.infoTitle}>Operational Status</Text>
        </View>
        <Text style={styles.infoDesc}>
          {inFence 
            ? "Your location is being shared with central dispatch. Geofencing active."
            : "Tracking suspended. You are outside the authorized fencing area."}
        </Text>
        
        {onlineAmbulances.length > 0 && (
          <ScrollView style={{ maxHeight: 150, marginTop: 10 }}>
            {onlineAmbulances.map((amb) => (
              <View key={amb.id} style={[styles.emergencyAlert, { marginTop: 6 }]}>
                <Ionicons name="warning" size={24} color="#ef4444" />
                <View style={{ marginLeft: 12 }}>
                  <Text style={styles.alertTitle}>Emergency: {amb.id.substring(0, 6)}...</Text>
                  <Text style={styles.alertDesc}>Destination: {amb.destination?.name || "Hospital"}</Text>
                  {amb.timestamp && <Text style={styles.timestampText}>Updated: {new Date(amb.timestamp).toLocaleTimeString()}</Text>}
                </View>
              </View>
            ))}
          </ScrollView>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  center: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#f8fafc"
  },
  loadingText: {
    color: '#64748b',
    marginTop: 12,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingTop: 60,
    paddingBottom: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1e293b',
  },
  subtitle: {
    fontSize: 14,
    color: '#64748b',
    marginTop: 4,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.05)',
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 6,
  },
  statusText: {
    fontSize: 10,
    fontWeight: 'bold',
  },
  mapContainer: {
    flex: 1,
    marginHorizontal: 16,
    borderRadius: 32,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    backgroundColor: '#fff',
  },
  infoCard: {
    backgroundColor: '#ffffff',
    margin: 24,
    padding: 20,
    borderRadius: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 5,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  infoTitle: {
    color: '#1e293b',
    fontWeight: 'bold',
    marginLeft: 8,
  },
  infoDesc: {
    color: '#64748b',
    fontSize: 13,
    lineHeight: 18,
  },
  emergencyAlert: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(239, 68, 68, 0.05)',
    marginTop: 16,
    padding: 12,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.1)',
  },
  alertTitle: {
    color: '#ef4444',
    fontWeight: 'bold',
    fontSize: 14,
  },
  alertDesc: {
    color: 'rgba(239, 68, 68, 0.6)',
    fontSize: 12,
  },
  timestampText: {
    color: '#94a3b8',
    fontSize: 10,
    marginTop: 2,
  }
});