// import React, { useEffect, useState } from "react";
// import { View, Text, Alert } from "react-native";
// import MapView, { Marker, Circle } from "react-native-maps";
// import * as Location from "expo-location";
// import { getDistance } from "geolib";
// import TrafficSignals from "./TrafficSignals";

// // 📍 Type for location
// type LocationType = {
//   latitude: number;
//   longitude: number;
// };

// type Props = {
//   externalLocation: LocationType; // 👈 REQUIRED
// };

// //📍 Geofence
// const GEOFENCE: LocationType & { radius: number } = {
//   latitude: 11.931638,
//   longitude: 79.807718,
//   radius: 500,
// };



//  export default function MapComponent({ externalLocation }: Props) {
//   const [location, setLocation] = useState<LocationType | null>(null);
//   const [isInside, setIsInside] = useState<boolean>(true);

//   useEffect(() => {
//     if (externalLocation) {
//       setLocation(externalLocation);
//       checkFence(externalLocation);
//     }
//   }, [externalLocation]);

//   const checkFence = (coords: LocationType) => {
//     const distance = getDistance(coords, {
//       latitude: GEOFENCE.latitude,
//       longitude: GEOFENCE.longitude,
//     });

//    const inside = distance <= GEOFENCE.radius;
//    setIsInside(inside);

//     // if (!inside) {
//     //   Alert.alert("🚨 Alert", "Outside geofence!");
//     // }
//   };

//   return (
//     <View style={{ flex: 1 }}>
//       {location && (
//         <MapView
//           style={{ flex: 1 }}
//           region={{
//             latitude: location.latitude,
//             longitude: location.longitude,
//             latitudeDelta: 0.01,
//             longitudeDelta: 0.01,
//           }}
//         >
//           <Marker coordinate={location} title="Police" />
          
//           <Circle
//             center={{
//               latitude: GEOFENCE.latitude,
//               longitude: GEOFENCE.longitude,
//             }}
//             radius={GEOFENCE.radius}
//             strokeColor="red"
//             fillColor="rgba(255,0,0,0.2)"
//           />
//           <TrafficSignals />
//         </MapView>
//       )}

//       <Text style={{ position: "absolute", top: 50, left: 20 }}>
//         {isInside ? "✅ Inside Area" : "❌ Outside Area"}
//       </Text>
//     </View>
//   );
// }


import React, { useEffect, useState } from "react";
import { View, Text } from "react-native";
import MapView, { Marker } from "react-native-maps";
import TrafficSignals from "./TrafficSignals";

// 📍 Type
type LocationType = {
  latitude: number;
  longitude: number;
};

type Props = {
  externalLocation: LocationType;
};

export default function MapComponent({ externalLocation }: Props) {
  const [location, setLocation] = useState<LocationType | null>(null);

  useEffect(() => {
    if (externalLocation) {
      setLocation(externalLocation);
    }
  }, [externalLocation]);

  return (
    <View style={{ flex: 1 }}>
      {location && (
        <MapView
          style={{ flex: 1 }}
          region={{
            latitude: location.latitude,
            longitude: location.longitude,
            latitudeDelta: 0.05,
            longitudeDelta: 0.05,
          }}
        >
          {/* 👮 Police / Vehicle */}
          <Marker coordinate={location} title="Vehicle" />

          {/* 🚦 Dynamic Traffic Signals */}
          <TrafficSignals currentLocation={location} />
        </MapView>
      )}

      {/* Status */}
      <Text style={{ position: "absolute", top: 50, left: 20 }}>
        Live Tracking...
      </Text>
    </View>
  );
}