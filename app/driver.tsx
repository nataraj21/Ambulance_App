import React, { useEffect, useState, useRef } from "react";
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator, Alert, ScrollView, Modal } from "react-native";
import { useRouter } from "expo-router";
import * as Location from "expo-location";
import DropDownPicker from "react-native-dropdown-picker";
import { getDistance } from "geolib";
import { auth, db } from "../firebase";
import { doc, setDoc, collection, getDocs, addDoc, updateDoc, onSnapshot, arrayUnion, arrayRemove, runTransaction } from "firebase/firestore";
import { signOut } from "firebase/auth";
import LeafletMap from "../components/LeafletMap";
import { Ionicons } from "@expo/vector-icons";

import { isValidLocation, shouldUpdateFirestore, getErrorMessage } from "../utils/trackingUtils";
import { getFreeRoute } from "../utils/osmRouting";

type Hospital = {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
};

type CachedSignal = {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
};

export default function DriverScreen() {
  const [hospitals, setHospitals] = useState<Hospital[]>([]);
  const [isTracking, setIsTracking] = useState(false);
  const [currentLocation, setCurrentLocation] = useState<{ latitude: number; longitude: number } | null>(null);
  const [selectedHospital, setSelectedHospital] = useState<Hospital | null>(null);
  const [profileVisible, setProfileVisible] = useState(false);
  const router = useRouter();
  
  // Dropdown State
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState<string | null>(null);
  const [items, setItems] = useState<{ label: string; value: string }[]>([]);

  // Route State
  const [routeCoords, setRouteCoords] = useState<{ latitude: number; longitude: number }[]>([]);
  const [routeStats, setRouteStats] = useState<{ distance: string; duration: string } | null>(null);
  const lastFetchedDestId = useRef<string | null>(null);

  // Tracking Refs for Throttling & Validation
  const locationSubscription = useRef<Location.LocationSubscription | null>(null);
  const emergencyIdRef = useRef<string | null>(null);
  const activatedSignalsRef = useRef<Set<string>>(new Set());
  const signalsCacheRef = useRef<CachedSignal[]>([]);
  const lastWriteTimeRef = useRef<number>(0);
  const lastWriteLocationRef = useRef<{ latitude: number; longitude: number } | null>(null);
  const lastRouteFetchTimeRef = useRef<number>(0);

  const userId = auth.currentUser?.uid || "anonymous_driver";
  const driverEmail = auth.currentUser?.email || "No Email Provided";
  const driverName = auth.currentUser?.displayName || "Driver";
  const themeColor = '#3b82f6';

  const [isLoading, setIsLoading] = useState(false);

  // Fetch hospitals
  useEffect(() => {
    const fetchHospitals = async () => {
      try {
        const snapshot = await getDocs(collection(db, "hospitals"));
        const data = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        })) as Hospital[];
        setHospitals(data);
        setItems(data.map(h => ({ label: h.name, value: h.id })));
      } catch (err) {
        console.error("Error fetching hospitals:", err);
      }
    };
    fetchHospitals();

    // Get initial location
    (async () => {
      try {
        let { status } = await Location.requestForegroundPermissionsAsync();
        if (status === 'granted') {
          const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
          if (isValidLocation(loc.coords)) {
            setCurrentLocation({ latitude: loc.coords.latitude, longitude: loc.coords.longitude });
          }
        }
      } catch (e) {
        console.warn("Initial location fetch failed:", e);
      }
    })();

    // Reset active status on mount to clear any stale cache/crashed sessions
    const resetStatus = async () => {
      if (userId && userId !== "anonymous_driver") {
        try {
          await updateDoc(doc(db, "ambulances", userId), { active: false, destination: null });
        } catch (e) {
          console.log("No existing document to reset or error:", e);
        }
      }
    };
    resetStatus();

    // Cleanup location listener on unmount
    return () => {
      if (locationSubscription.current) {
        locationSubscription.current.remove();
        locationSubscription.current = null;
      }
    };
  }, []);

  useEffect(() => {
    if (value) {
      const hospital = hospitals.find(h => h.id === value);
      setSelectedHospital(hospital || null);
    }
  }, [value, hospitals]);

  const fetchRoute = async (start: { latitude: number; longitude: number }, end: { latitude: number; longitude: number }) => {
    try {
      const result = await getFreeRoute(start, end);
      setRouteCoords(result.coords);
      setRouteStats({ distance: result.distance, duration: result.eta });
    } catch (err) {
      console.error("Failed to fetch route:", err);
      // Fallback: simple straight line if API fails
      setRouteCoords([{ latitude: start.latitude, longitude: start.longitude }, { latitude: end.latitude, longitude: end.longitude }]);
      setRouteStats(null);
    }
  };

  useEffect(() => {
    if (selectedHospital && currentLocation) {
      const now = Date.now();
      const hospitalChanged = lastFetchedDestId.current !== selectedHospital.id;
      const timeSinceLastUpdate = now - lastRouteFetchTimeRef.current;
      
      // Update route if:
      // 1. Hospital changed (immediate)
      // 2. We are tracking and 15 seconds have passed (dynamic navigation)
      if (hospitalChanged || (isTracking && timeSinceLastUpdate > 15000)) {
        fetchRoute(currentLocation, { latitude: selectedHospital.latitude, longitude: selectedHospital.longitude });
        lastFetchedDestId.current = selectedHospital.id;
        lastRouteFetchTimeRef.current = now;
      }
    } else if (!selectedHospital) {
      setRouteCoords([]);
      setRouteStats(null);
      lastFetchedDestId.current = null;
      lastRouteFetchTimeRef.current = 0;
    }
  }, [selectedHospital, currentLocation, isTracking]);

  const startTracking = async () => {
    if (isTracking) return; // Prevent duplicate sessions

    if (!value) {
      Alert.alert("Required", "Please select a destination hospital.");
      return;
    }

    setIsLoading(true);
    try {
      let { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") {
        Alert.alert("Permission Denied", "Location access is required for emergency tracking.");
        setIsLoading(false);
        return;
      }

      const hospital = hospitals.find(h => h.id === value);
      if (!hospital) {
        setIsLoading(false);
        return;
      }

      // Cache signals once at start
      const signalSnapshot = await getDocs(collection(db, "TrafficSignals"));
      signalsCacheRef.current = signalSnapshot.docs.map(d => ({
        id: d.id,
        name: d.data().name || "Signal",
        latitude: Number(d.data().latitude),
        longitude: Number(d.data().longitude),
      }));

      // Create session
      const emergencyRef = await addDoc(collection(db, "emergencies"), {
        ambulanceId: userId,
        startedAt: Date.now(),
        hospital: hospital.name,
        active: true,
      });
      emergencyIdRef.current = emergencyRef.id;

      setIsTracking(true);

      locationSubscription.current = await Location.watchPositionAsync(
        { accuracy: Location.Accuracy.High, timeInterval: 3000, distanceInterval: 5 },
        async (location) => {
          const { latitude, longitude, accuracy } = location.coords;
          
          // 1. GPS Validation
          if (!isValidLocation({ latitude, longitude, accuracy })) return;

          setCurrentLocation({ latitude, longitude });

          try {
            // 2. Throttled Firestore Write
            if (shouldUpdateFirestore(lastWriteLocationRef.current, { latitude, longitude }, lastWriteTimeRef.current)) {
              await setDoc(doc(db, "ambulances", userId), {
                latitude,
                longitude,
                active: true,
                timestamp: Date.now(), // Heartbeat
                destination: {
                  name: hospital.name,
                  latitude: hospital.latitude,
                  longitude: hospital.longitude,
                },
              }, { merge: true });

              lastWriteTimeRef.current = Date.now();
              lastWriteLocationRef.current = { latitude, longitude };
            }

            // 3. Proximity detection for signals (Concurrent-Safe)
            for (const signal of signalsCacheRef.current) {
              const distance = getDistance({ latitude, longitude }, { latitude: signal.latitude, longitude: signal.longitude });
              const signalRef = doc(db, "TrafficSignals", signal.id);

              if (distance <= 300 && !activatedSignalsRef.current.has(signal.id)) {
                // Atomic update: add this ambulance to the signal's active list
                await runTransaction(db, async (transaction) => {
                  const sigDoc = await transaction.get(signalRef);
                  if (!sigDoc.exists()) return;
                  
                  transaction.update(signalRef, {
                    status: "GREEN",
                    activeAmbulances: arrayUnion(userId),
                    lastTriggeredBy: userId,
                    triggeredAt: Date.now()
                  });
                });
                activatedSignalsRef.current.add(signal.id);
              } else if (distance > 350 && activatedSignalsRef.current.has(signal.id)) {
                // Atomic update: remove this ambulance and check if others remain
                await runTransaction(db, async (transaction) => {
                  const sigDoc = await transaction.get(signalRef);
                  if (!sigDoc.exists()) return;
                  
                  const data = sigDoc.data();
                  const currentAmbs = (data.activeAmbulances || []) as string[];
                  const remainingAmbs = currentAmbs.filter(id => id !== userId);
                  
                  transaction.update(signalRef, {
                    activeAmbulances: arrayRemove(userId),
                    status: remainingAmbs.length > 0 ? "GREEN" : "NORMAL"
                  });
                });
                activatedSignalsRef.current.delete(signal.id);
              }
            }
          } catch (fireErr) {
            console.error("Background Tracking Error:", fireErr);
          }
        }
      );
    } catch (err) {
      console.error(err);
      Alert.alert("Error", getErrorMessage(err));
    } finally {
      setIsLoading(false);
    }
  };

  const stopTracking = async () => {
    setIsLoading(true);
    
    // Stop watcher immediately
    if (locationSubscription.current) {
      locationSubscription.current.remove();
      locationSubscription.current = null;
    }

    try {
      // Reset signals (Concurrent-Safe)
      const signalPromises = Array.from(activatedSignalsRef.current).map(async (signalId) => {
        const signalRef = doc(db, "TrafficSignals", signalId);
        await runTransaction(db, async (transaction) => {
          const sigDoc = await transaction.get(signalRef);
          if (!sigDoc.exists()) return;
          
          const data = sigDoc.data();
          const currentAmbs = (data.activeAmbulances || []) as string[];
          const remainingAmbs = currentAmbs.filter(id => id !== userId);
          
          transaction.update(signalRef, {
            activeAmbulances: arrayRemove(userId),
            status: remainingAmbs.length > 0 ? "GREEN" : "NORMAL"
          });
        });
      });
      await Promise.all(signalPromises);
      activatedSignalsRef.current.clear();

      // Close session
      if (emergencyIdRef.current) {
        await updateDoc(doc(db, "emergencies", emergencyIdRef.current), {
          endedAt: Date.now(),
          active: false,
        });
        emergencyIdRef.current = null;
      }

    } catch (err) {
      console.error("Cleanup Error:", err);
      Alert.alert("Notice", "Some signals might not have reset correctly, but the session is closing.");
    } finally {
      // Always reset local state and primary Firestore status
      try {
        await updateDoc(doc(db, "ambulances", userId), { 
          active: false, 
          destination: null,
          timestamp: Date.now() 
        });
      } catch (e) {
        console.error("Final status update failed:", e);
      }

      // FULL STATE RESET
      setIsTracking(false);
      setValue(null);
      setSelectedHospital(null);
      setRouteCoords([]);
      setRouteStats(null);
      lastFetchedDestId.current = null;
      setIsLoading(false);
    }
  };

  const handleLogout = async () => {
    try {
      if (isTracking) {
        await stopTracking();
      }
      await signOut(auth);
      setProfileVisible(false);
      router.replace("/login");
    } catch (error) {
      console.error("Logout Error:", error);
      Alert.alert("Error", "Failed to log out.");
    }
  };

  return (
    <ScrollView 
      style={styles.container} 
      contentContainerStyle={{ paddingBottom: 40 }}
      nestedScrollEnabled={true}
      keyboardShouldPersistTaps="handled"
    >
      <View style={styles.header}>
        <View>
          <Text style={styles.greeting}>Hello, {driverName}</Text>
          <Text style={styles.subtitle}>Manage your emergency route</Text>
        </View>
        <TouchableOpacity style={styles.profileBtn} onPress={() => setProfileVisible(true)}>
          <Ionicons name="person-circle" size={40} color={themeColor} />
        </TouchableOpacity>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Emergency Destination</Text>
        <View style={styles.dropdownWrapper}>
          <DropDownPicker
            open={open}
            value={value}
            items={items}
            setOpen={setOpen}
            setValue={setValue}
            setItems={setItems}
            placeholder="Select Destination Hospital"
            searchable={true}
            searchPlaceholder="Search hospital..."
            disabled={isTracking}
            listMode="SCROLLVIEW"
            scrollViewProps={{
              nestedScrollEnabled: true,
            }}
            style={styles.dropdown}
            dropDownContainerStyle={[styles.dropdownList, { maxHeight: 250 }]}
            searchContainerStyle={{
              borderBottomColor: "#e2e8f0"
            }}
            searchTextInputStyle={{
              borderColor: "#e2e8f0"
            }}
            placeholderStyle={{ color: '#94a3b8' }}
            zIndex={3000}
            zIndexInverse={1000}
          />
        </View>

        {!isTracking ? (
          <TouchableOpacity 
            style={[styles.actionBtn, { backgroundColor: '#22c55e' }, isLoading && { opacity: 0.7 }]} 
            onPress={startTracking}
            disabled={isLoading}
          >
            {isLoading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <>
                <Ionicons name="flash" size={20} color="#fff" style={{ marginRight: 8 }} />
                <Text style={styles.actionBtnText}>Start Emergency</Text>
              </>
            )}
          </TouchableOpacity>
        ) : (
          <TouchableOpacity 
            style={[styles.actionBtn, { backgroundColor: '#ef4444' }, isLoading && { opacity: 0.7 }]} 
            onPress={stopTracking}
            disabled={isLoading}
          >
            {isLoading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <>
                <Ionicons name="stop-circle" size={20} color="#fff" style={{ marginRight: 8 }} />
                <Text style={styles.actionBtnText}>Stop Emergency</Text>
              </>
            )}
          </TouchableOpacity>
        )}
      </View>

      <View style={styles.mapContainer}>
        <View style={styles.mapHeader}>
          <Text style={styles.mapTitle}>Live Navigation</Text>
          {isTracking && (
            <View style={styles.liveBadge}>
              <View style={styles.pulseDot} />
              <Text style={styles.liveText}>LIVE</Text>
            </View>
          )}
        </View>
        <View style={styles.mapView}>
          <LeafletMap 
            ambulanceLocation={currentLocation || { latitude: 11.94, longitude: 79.81 }}
            destination={selectedHospital}
            routeCoords={routeCoords}
          />
        </View>
      </View>

      <View style={styles.statsContainer}>
        <View style={[styles.statBox, { width: routeStats ? '31%' : '48%' }]}>
          <Ionicons name="navigate" size={24} color={themeColor} />
          <Text style={styles.statValue}>{isTracking ? "Active" : (isLoading ? "Syncing" : "Idle")}</Text>
          <Text style={styles.statLabel}>Status</Text>
        </View>
        <View style={[styles.statBox, { width: routeStats ? '31%' : '48%' }]}>
          <Ionicons name="shield-checkmark" size={24} color="#22c55e" />
          <Text style={styles.statValue}>{activatedSignalsRef.current.size}</Text>
          <Text style={styles.statLabel}>Signals</Text>
        </View>
        {routeStats && (
          <View style={[styles.statBox, { width: '31%' }]}>
            <Ionicons name="time" size={24} color="#f59e0b" />
            <Text style={styles.statValue}>{routeStats.duration}</Text>
            <Text style={styles.statLabel}>{routeStats.distance}</Text>
          </View>
        )}
      </View>

      <Modal
        visible={profileVisible}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setProfileVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Driver Profile</Text>
              <TouchableOpacity onPress={() => setProfileVisible(false)}>
                <Ionicons name="close" size={24} color="#1e293b" />
              </TouchableOpacity>
            </View>
            
            <View style={styles.profileDetails}>
              <Ionicons name="person-circle" size={80} color={themeColor} />
              <Text style={styles.profileName}>{driverName}</Text>
              <Text style={styles.profileEmail}>{driverEmail}</Text>
            </View>

            <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout}>
              <Ionicons name="log-out-outline" size={20} color="#fff" style={{ marginRight: 8 }} />
              <Text style={styles.logoutBtnText}>Log Out</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingTop: 60,
    paddingBottom: 24,
  },
  greeting: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1e293b',
  },
  subtitle: {
    fontSize: 14,
    color: '#64748b',
    marginTop: 4,
  },
  profileBtn: {
    padding: 4,
  },
  card: {
    backgroundColor: '#ffffff',
    marginHorizontal: 24,
    borderRadius: 24,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 5,
    zIndex: 2000,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#1e293b',
    marginBottom: 16,
  },
  dropdownWrapper: {
    marginBottom: 20,
  },
  dropdown: {
    backgroundColor: '#f1f5f9',
    borderColor: '#e2e8f0',
    borderRadius: 12,
  },
  dropdownList: {
    backgroundColor: '#ffffff',
    borderColor: '#e2e8f0',
  },
  actionBtn: {
    flexDirection: 'row',
    height: 56,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  actionBtnText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  mapContainer: {
    marginTop: 24,
    marginHorizontal: 24,
  },
  mapHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  mapTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1e293b',
  },
  liveBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.3)',
  },
  pulseDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#ef4444',
    marginRight: 6,
  },
  liveText: {
    color: '#ef4444',
    fontSize: 10,
    fontWeight: 'bold',
  },
  mapView: {
    height: 300,
    borderRadius: 24,
    overflow: 'hidden',
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  statsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 24,
    marginTop: 24,
  },
  statBox: {
    backgroundColor: '#ffffff',
    padding: 12,
    borderRadius: 20,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  statValue: {
    color: '#1e293b',
    fontSize: 18,
    fontWeight: 'bold',
    marginTop: 8,
  },
  statLabel: {
    color: '#64748b',
    fontSize: 12,
    marginTop: 2,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    minHeight: 300,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1e293b',
  },
  profileDetails: {
    alignItems: 'center',
    marginBottom: 30,
  },
  profileName: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#1e293b',
    marginTop: 12,
  },
  profileEmail: {
    fontSize: 16,
    color: '#64748b',
    marginTop: 4,
  },
  logoutBtn: {
    flexDirection: 'row',
    backgroundColor: '#ef4444',
    height: 50,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  logoutBtnText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  }
});