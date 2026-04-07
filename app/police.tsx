
// import React, { useEffect, useState } from "react";
// import { View, Text, StyleSheet } from "react-native";
// import MapView, { Marker, Circle } from "react-native-maps";
// import { db } from "../firebase";
// import { doc, onSnapshot } from "firebase/firestore";

// // 📍 Geofence Area
// const GEOFENCE = {
//   latitude: 11.931638,
//   longitude:  79.807718,
//   radius: 500,
// };

// export default function Police() {
//   const [location, setLocation] = useState<any>(null);

//   useEffect(() => {
//     const unsub = onSnapshot(
//       doc(db, "ambulances", "ambulance1"),
//       (docSnap) => {
//         const data = docSnap.data();

//         if (data?.latitude != null && data?.longitude != null) {
//           setLocation({
//             latitude: data.latitude,
//             longitude: data.longitude,
//           });
//         }
//       }
//     );

//     return () => unsub();
//   }, []);

//   return (
//     <View style={{ flex: 1 }}>
//       {location ? (
//         <MapView
//           style={styles.map}
//           region={{
//             latitude: location.latitude,
//             longitude: location.longitude,
//             latitudeDelta: 0.01,
//             longitudeDelta: 0.01,
//           }}
//         >
//           {/* 🚑 Ambulance */}
//           <Marker
//             coordinate={location}
//             title="🚑 Ambulance"
//             description="Live Location"
//           />

//           {/* 🔴 Geofence Circle */}
//           <Circle
//             center={{
//               latitude: GEOFENCE.latitude,
//               longitude: GEOFENCE.longitude,
//             }}
//             radius={GEOFENCE.radius}
//             strokeColor="red"
//             fillColor="rgba(255,0,0,0.2)"
//           />
//         </MapView>
//       ) : (
//         <View style={styles.center}>
//           <Text>Waiting for ambulance...</Text>
//         </View>
//       )}
//     </View>
//   );
// }

// const styles = StyleSheet.create({
//   map: {
//     flex: 1,
//   },
//   center: {
//     flex: 1,
//     justifyContent: "center",
//     alignItems: "center",
//   },
// });
import React, { useEffect, useState } from "react";
import { View, Text } from "react-native";
import { db } from "../firebase";
import { doc, onSnapshot } from "firebase/firestore";
import MapComponent from "../components/MapComponent";

type LocationType = {
  latitude: number;
  longitude: number;
};

export default function Police() {
  const [location, setLocation] = useState<LocationType | null>(null);

  useEffect(() => {
    const unsub = onSnapshot(
      doc(db, "ambulances", "ambulance1"),
      (docSnap) => {
        const data = docSnap.data();

        if (data?.latitude && data?.longitude) {
          setLocation({
            latitude: data.latitude,
            longitude: data.longitude,
          });
        }
      }
    );

    return () => unsub();
  }, []);

  return (
    <View style={{ flex: 1 }}>
      {location ? (
        <MapComponent externalLocation={location} />
      ) : (
        <Text>Waiting for ambulance...</Text>
      )}
    </View>
  );
}