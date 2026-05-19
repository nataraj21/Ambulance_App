import React, { useEffect, useState, useRef } from "react";
import { View, Text, StyleSheet, TouchableOpacity, FlatList, ActivityIndicator, ScrollView } from "react-native";
import LeafletMap from "../components/LeafletMap";
import { auth, db } from "../firebase";
import { collection, onSnapshot } from "firebase/firestore";
import { Ionicons } from "@expo/vector-icons";
import { registerForPushNotifications, setupNotificationListeners, sendLocalEmergencyNotification } from "../utils/notificationService";

import { isDeviceOnline } from "../utils/trackingUtils";

type MapMarker = {
  id: string;
  latitude: number;
  longitude: number;
  active: boolean;
  timestamp?: number;
  lastUpdate?: number;
  name?: string;
  destination?: { name: string; latitude: number; longitude: number };
};

type TrafficSignal = {
  id: string;
  latitude: number;
  longitude: number;
  name: string;
  status: string;
};

type Hospital = {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
};

export default function AdminScreen() {
  const [activeTab, setActiveTab] = useState<"Map" | "List">("Map");
  const [ambulances, setAmbulances] = useState<MapMarker[]>([]);
  const [policeUnits, setPoliceUnits] = useState<MapMarker[]>([]);
  const [signals, setSignals] = useState<TrafficSignal[]>([]);
  const [hospitals, setHospitals] = useState<Hospital[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentTime, setCurrentTime] = useState(Date.now());
  
  const alertedSignalsRef = useRef<Set<string>>(new Set());
  const themeColor = '#3b82f6';

  useEffect(() => {
    const adminId = auth.currentUser?.uid || "admin1";
    registerForPushNotifications(adminId, "admin_units");
    const cleanupListeners = setupNotificationListeners();
    return () => cleanupListeners();
  }, []);

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(Date.now()), 15000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    // Listen for Ambulances
    const unsubAmb = onSnapshot(collection(db, "ambulances"), (snapshot) => {
      try {
        setAmbulances(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as MapMarker[]);
      } catch (e) { console.error("Admin: Ambulance sync error", e); }
    }, (err) => console.error("Admin: Ambulance unsub error", err));

    // Listen for Police Units
    const unsubPolice = onSnapshot(collection(db, "police_units"), (snapshot) => {
      try {
        setPoliceUnits(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as MapMarker[]);
      } catch (e) { console.error("Admin: Police sync error", e); }
    }, (err) => console.error("Admin: Police unsub error", err));

    // Listen for Signals
    const unsubSig = onSnapshot(collection(db, "TrafficSignals"), (snapshot) => {
      try {
        setSignals(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as TrafficSignal[]);
        
        snapshot.docChanges().forEach((change) => {
          if (change.type === "modified" || change.type === "added") {
            const data = change.doc.data();
            if (data.status === "GREEN" && !alertedSignalsRef.current.has(change.doc.id)) {
              sendLocalEmergencyNotification(data.name || "Signal Activated");
              alertedSignalsRef.current.add(change.doc.id);
            } else if (data.status !== "GREEN") {
              alertedSignalsRef.current.delete(change.doc.id);
            }
          }
        });
        setLoading(false);
      } catch (e) { console.error("Admin: Signal sync error", e); }
    }, (err) => {
      console.error("Admin: Signal unsub error", err);
      setLoading(false);
    });

    // Listen for Hospitals
    const unsubHosp = onSnapshot(collection(db, "hospitals"), (snapshot) => {
      try {
        setHospitals(snapshot.docs.map(doc => ({
          id: doc.id,
          name: doc.data().name,
          latitude: Number(doc.data().latitude),
          longitude: Number(doc.data().longitude)
        })) as Hospital[]);
      } catch (e) { console.error("Admin: Hospital sync error", e); }
    }, (err) => console.error("Admin: Hospital unsub error", err));

    return () => { unsubAmb(); unsubPolice(); unsubSig(); unsubHosp(); };
  }, []);

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={themeColor} />
      </View>
    );
  }

  const onlineAmbulances = ambulances.filter(amb => isDeviceOnline(amb.active, amb.timestamp, currentTime));
  const onlinePolice = policeUnits.filter(p => isDeviceOnline(p.active, p.lastUpdate, currentTime));

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Admin Command Center</Text>
        <View style={styles.tabContainer}>
          <TouchableOpacity 
            style={[styles.tab, activeTab === "Map" && styles.activeTab]} 
            onPress={() => setActiveTab("Map")}
          >
            <Ionicons name="map" size={18} color={activeTab === "Map" ? "#fff" : "#94a3b8"} />
            <Text style={[styles.tabText, activeTab === "Map" && styles.activeTabText]}>Map</Text>
          </TouchableOpacity>
          <TouchableOpacity 
            style={[styles.tab, activeTab === "List" && styles.activeTab]} 
            onPress={() => setActiveTab("List")}
          >
            <Ionicons name="list" size={18} color={activeTab === "List" ? "#fff" : "#94a3b8"} />
            <Text style={[styles.tabText, activeTab === "List" && styles.activeTabText]}>Fleet</Text>
          </TouchableOpacity>
        </View>
      </View>

      {activeTab === "Map" ? (
        <View style={styles.content}>
          <LeafletMap 
            ambulances={onlineAmbulances}
            policeUnits={onlinePolice}
            destination={null}
            signals={signals}
            hospitals={hospitals}
          />
          <View style={styles.legend}>
            <View style={styles.legendItem}><Text>🚑 {onlineAmbulances.length} Active</Text></View>
            <View style={styles.legendItem}><Text>🚓 {onlinePolice.length} Patrol</Text></View>
            <View style={styles.legendItem}><Text>🚦 {signals.filter(s => s.status === 'GREEN').length} Clear</Text></View>
          </View>
        </View>
      ) : (
        <FlatList
          data={onlineAmbulances}
          keyExtractor={item => item.id}
          contentContainerStyle={{ padding: 20 }}
          renderItem={({ item }) => (
            <View style={styles.listCard}>
              <View style={styles.cardIcon}>
                <Ionicons name="medical" size={24} color={item.active ? "#22c55e" : "#64748b"} />
              </View>
              <View style={styles.cardContent}>
                <Text style={styles.cardId}>{item.id}</Text>
                <Text style={styles.cardStatus}>{item.active ? "En Route" : "Standby"}</Text>
                {item.destination && (
                  <Text style={styles.cardDetail}>To: {item.destination.name}</Text>
                )}
              </View>
              {item.active && <View style={styles.activeIndicator} />}
            </View>
          )}
        />
      )}
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
    backgroundColor: '#f8fafc'
  },
  header: {
    paddingTop: 60,
    paddingHorizontal: 24,
    paddingBottom: 20,
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#1e293b',
    marginBottom: 16,
  },
  tabContainer: {
    flexDirection: 'row',
    backgroundColor: '#e2e8f0',
    borderRadius: 12,
    padding: 4,
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    borderRadius: 8,
  },
  activeTab: {
    backgroundColor: '#3b82f6',
  },
  tabText: {
    color: '#64748b',
    marginLeft: 8,
    fontWeight: '600',
  },
  activeTabText: {
    color: '#fff',
  },
  content: {
    flex: 1,
    marginHorizontal: 16,
    marginBottom: 20,
    borderRadius: 24,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    backgroundColor: '#fff',
  },
  legend: {
    position: 'absolute',
    bottom: 16,
    left: 16,
    right: 16,
    flexDirection: 'row',
    justifyContent: 'space-around',
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    padding: 12,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.05)',
  },
  legendItem: {
    backgroundColor: '#f1f5f9',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  listCard: {
    flexDirection: 'row',
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  cardIcon: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: '#f1f5f9',
    justifyContent: 'center',
    alignItems: 'center',
  },
  cardContent: {
    flex: 1,
    marginLeft: 16,
  },
  cardId: {
    color: '#1e293b',
    fontWeight: 'bold',
    fontSize: 16,
  },
  cardStatus: {
    color: '#64748b',
    fontSize: 12,
    marginTop: 2,
  },
  cardDetail: {
    color: '#3b82f6',
    fontSize: 11,
    marginTop: 4,
  },
  activeIndicator: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#22c55e',
  }
});


