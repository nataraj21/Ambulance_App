import React from "react";
import { View, Text, Button, StyleSheet } from "react-native";
import * as Location from "expo-location";
import { db } from "../firebase";
import { doc, setDoc } from "firebase/firestore";

export default function Driver() {

  const startTracking = async () => {
    let { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== "granted") {
      alert("Permission denied");
      return;
    }

    Location.watchPositionAsync(
      {
        accuracy: Location.Accuracy.High,
        timeInterval: 3000,
        distanceInterval: 1,
      },
      async (location) => {
        const { latitude, longitude } = location.coords;

        await setDoc(doc(db, "ambulances", "ambulance1"), {
          latitude,
          longitude,
          active: true,
          timestamp: Date.now(),
        });

        console.log("Live:", latitude, longitude);
      }
    );
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>🚑 Driver Mode</Text>
      <Button title="Start Emergency" onPress={startTracking} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  title: {
    fontSize: 20,
    marginBottom: 20,
  },
});