// This file previously used react-native-maps. 
// It is now intended to be a data fetcher for the Leaflet WebView implementation.

import React, { useEffect, useState, useMemo } from "react";
import { collection, onSnapshot } from "firebase/firestore";
import { db } from "../firebase";

type SignalType = {
  id: string;
  latitude: number;
  longitude: number;
  name: string;
  status: string;
};

// Data-only version of the signal listener
export function useTrafficSignals() {
  const [signals, setSignals] = useState<SignalType[]>([]);

  useEffect(() => {
    const unsub = onSnapshot(collection(db, "TrafficSignals"), (snapshot) => {
      const list: SignalType[] = snapshot.docs.map(doc => ({
        id: doc.id,
        latitude: Number(doc.data().latitude),
        longitude: Number(doc.data().longitude),
        name: doc.data().name || "Unnamed Signal",
        status: doc.data().status || "NORMAL",
      })).filter(s => !isNaN(s.latitude) && !isNaN(s.longitude));
      setSignals(list);
    });
    return () => unsub();
  }, []);

  return signals;
}

export default function TrafficSignals() {
  return null; // No longer renders native components
}
