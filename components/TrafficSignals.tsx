

import React, { useEffect, useState } from "react";
import { Marker, Circle } from "react-native-maps";
import { collection, onSnapshot } from "firebase/firestore";
import { db } from "../firebase";
import { Text } from "react-native";
import { getDistance } from "geolib";

type SignalType = {
  id: string;
  latitude: number;
  longitude: number;
  name: string;
};

type Props = {
  currentLocation: {
    latitude: number;
    longitude: number;
  };
};

export default function TrafficSignals({ currentLocation }: Props) {
  const [signals, setSignals] = useState<SignalType[]>([]);

  useEffect(() => {
    const unsub = onSnapshot(
      collection(db, "TrafficSignals"),
      (snapshot) => {
        const list: SignalType[] = [];

        snapshot.forEach((doc) => {
          const data = doc.data();

          list.push({
            id: doc.id,
            latitude: data.latitude,
            longitude: data.longitude,
            name: data.name,
          });
        });

        setSignals(list);
      }
    );

    return () => unsub();
  }, []);
  useEffect(() => {
  fetch("http://192.168.1.125:5000/api/signals")
    .then((res) => res.json())
    .then((data) => {
      console.log("API DATA:", data);

      setSignals(data); // directly set API data
    })
    .catch((err) => console.log("ERROR:", err));
}, []);

  return (
    <>
      {signals.map((signal) => {
        const distance = getDistance(currentLocation, {
          latitude: signal.latitude,
          longitude: signal.longitude,
        });

        const isInside = distance <= 200; // 👈 geofence radius

        return (
          <React.Fragment key={signal.id}>
            {/* 🚦 Marker */}
            <Marker
              coordinate={{
                latitude: signal.latitude,
                longitude: signal.longitude,
              }}
              title={signal.name}
            >
             <Text style={{ fontSize: 30 }}>🚦</Text>
            </Marker>

            {/* 🔵 Circle */}
           <Circle
            center={{
              latitude: signal.latitude,
              longitude: signal.longitude,
            }}
            radius={300}
            strokeColor={isInside ? "green" : "red"}
            fillColor={
              isInside
                ? "rgba(0,255,0,0.3)"
                : "rgba(255,0,0,0.3)"
            }
          />
          </React.Fragment>
        );
      })}
    </>
  );
}