import React, { useState, useEffect, useRef } from "react";
import { View, StyleSheet, SafeAreaView, ActivityIndicator, Text } from "react-native";
import { WebView } from "react-native-webview";

/**
 * 🌍 OSMMapScreen.tsx
 * A fully free, Google-free mapping solution using Leaflet.js
 */
export default function OSMMapScreen() {
  const webViewRef = useRef<WebView>(null);
  const [loading, setLoading] = useState(true);

  // Default Coordinates (Puducherry/Pondicherry as requested)
  const defaultCoords = { lat: 11.931649, lng: 79.807657 };

  // 📄 HTML & Leaflet Engine
  const leafletHTML = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
      <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
      <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
      <style>
        body { margin: 0; padding: 0; background-color: #f0f0f0; }
        #map { height: 100vh; width: 100vw; }
        .custom-label { background: white; border: 1px solid #333; padding: 2px 5px; border-radius: 4px; font-weight: bold; }
        .leaflet-control-attribution { font-size: 8px !important; }
      </style>
    </head>
    <body>
      <div id="map"></div>
      <script>
        // 1. Initialize Map
        var map = L.map('map', { zoomControl: false }).setView([${defaultCoords.lat}, ${defaultCoords.lng}], 15);

        // 2. Add OpenStreetMap Tiles
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
          maxZoom: 19,
          attribution: '© OpenStreetMap contributors'
        }).addTo(map);

        // 3. Markers Storage
        var markers = {};
        var routePath = null;

        // 4. Custom Icon Function
        function getEmojiIcon(emoji) {
          return L.divIcon({
            html: '<div style="font-size: 24px; text-shadow: 0 0 5px white;">' + emoji + '</div>',
            className: 'dummy',
            iconSize: [30, 30],
            iconAnchor: [15, 15]
          });
        }

        // 5. Default Ambulance Marker
        markers['ambulance'] = L.marker([${defaultCoords.lat}, ${defaultCoords.lng}], {
          icon: getEmojiIcon('🚑')
        }).addTo(map).bindPopup("<b>Ambulance Location</b><br>Emergency Status: Active").openPopup();

        // 6. Communication Function (From React Native)
        function updateState(data) {
          if (data.ambulance) {
            markers['ambulance'].setLatLng([data.ambulance.lat, data.ambulance.lng]);
          }
          
          if (data.signals) {
            data.signals.forEach(sig => {
              var id = 'sig_' + sig.id;
              if (!markers[id]) {
                markers[id] = L.marker([sig.lat, sig.lng], {
                  icon: getEmojiIcon('🚦')
                }).addTo(map).bindPopup("Signal: " + sig.name);
              } else {
                markers[id].setLatLng([sig.lat, sig.lng]);
              }
            });
          }

          if (data.route) {
            if (routePath) map.removeLayer(routePath);
            routePath = L.polyline(data.route, { color: '#4A90E2', weight: 5, opacity: 0.8 }).addTo(map);
          }
        }

        window.addEventListener('message', function(e) {
          var data = JSON.parse(e.data);
          updateState(data);
        });
      </script>
    </body>
    </html>
  `;

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerText}>AMBULANCE TRACKER (OSM)</Text>
      </View>
      
      <WebView
        ref={webViewRef}
        originWhitelist={['*']}
        source={{ html: leafletHTML }}
        style={styles.map}
        onLoadEnd={() => setLoading(false)}
      />

      {loading && (
        <View style={styles.loader}>
          <ActivityIndicator size="large" color="#4A90E2" />
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#fff",
  },
  header: {
    padding: 15,
    backgroundColor: "#1A1A1A",
    alignItems: "center",
  },
  headerText: {
    color: "#FFF",
    fontWeight: "bold",
    letterSpacing: 1,
  },
  map: {
    flex: 1,
  },
  loader: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "white",
    justifyContent: "center",
    alignItems: "center",
  }
});
