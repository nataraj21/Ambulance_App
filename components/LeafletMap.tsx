import React, { useRef, useEffect, memo } from 'react';
import { StyleSheet, View, Text } from 'react-native';

interface MapMarker {
  id: string;
  latitude: number;
  longitude: number;
  name?: string;
  status?: string;
  active?: boolean;
  destination?: { latitude: number; longitude: number; name?: string } | null;
  timestamp?: number;
}

interface LeafletMapProps {
  ambulances?: MapMarker[];
  policeUnits?: MapMarker[];
  ambulanceLocation?: { latitude: number; longitude: number };
  policeLocation?: { latitude: number; longitude: number } | null;
  destination: { latitude: number; longitude: number; name?: string } | null;
  routeCoords?: { latitude: number; longitude: number }[];
  signals?: { id: string; latitude: number; longitude: number; name: string; status: string }[];
  hospitals?: { id: string; name: string; latitude: number; longitude: number }[];
  geofence?: { latitude: number; longitude: number; radius: number; color?: string };
}

const STATIC_MAP_HTML = `
<!DOCTYPE html>
<html>
<head>
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
  <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
  <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
  <style>
    html, body { height: 100%; margin: 0; padding: 0; }
    #map { height: 100%; width: 100%; background: #f0f0f0; }
    .emoji { font-size: 24px; text-align: center; line-height: 30px; }
    .leaflet-popup-content { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; font-size: 14px; }
    .pulse {
      border-radius: 50%;
      height: 20px;
      width: 20px;
      position: absolute;
      left: 5px;
      top: 5px;
      animation: pulsate 2s ease-out infinite;
      opacity: 0;
      box-shadow: 0 0 1px 2px #3b82f6;
    }
    @keyframes pulsate {
      0% { transform: scale(0.1, 0.1); opacity: 0; }
      50% { opacity: 1; }
      100% { transform: scale(1.2, 1.2); opacity: 0; }
    }
  </style>
</head>
<body>
  <div id="map"></div>
  <script>
    var map;
    var ambulanceLayer = L.layerGroup();
    var policeLayer = L.layerGroup();
    var destLayer = L.layerGroup();
    var signalLayer = L.layerGroup();
    var routeLayer = L.layerGroup();
    var hospitalLayer = L.layerGroup();
    var geofenceLayer = L.layerGroup();

    var isMapInitialized = false;
    var shouldFollowAmbulance = true;
    var lastRouteStr = "";

    function initMap(lat, lng) {
      if (isMapInitialized) return;
      map = L.map('map', { zoomControl: false }).setView([lat, lng], 14);
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
          attribution: '© OpenStreetMap contributors'
      }).addTo(map);

      ambulanceLayer.addTo(map);
      policeLayer.addTo(map);
      destLayer.addTo(map);
      signalLayer.addTo(map);
      routeLayer.addTo(map);
      hospitalLayer.addTo(map);
      geofenceLayer.addTo(map);

      isMapInitialized = true;

      map.on('dragstart', function() {
        shouldFollowAmbulance = false;
      });
    }

    function smoothFollow(lat, lng) {
      if (shouldFollowAmbulance && isMapInitialized) {
        map.panTo([lat, lng], { animate: true, duration: 1 });
      }
    }

    function updateData(data) {
      try {
        if(!isMapInitialized) {
           var centerLat = data.displayAmbulances[0] ? data.displayAmbulances[0].latitude : 11.94;
           var centerLng = data.displayAmbulances[0] ? data.displayAmbulances[0].longitude : 79.81;
           initMap(centerLat, centerLng);
        }

        // 1. Ambulances
        ambulanceLayer.clearLayers();
        data.displayAmbulances.forEach(function(a) {
           if(a.active) {
              L.marker([a.latitude, a.longitude], {
                icon: L.divIcon({ html: '<div class="pulse"></div><div class="emoji">🚑</div>', className: 'marker-container', iconSize: [30, 30] })
              }).addTo(ambulanceLayer).bindPopup("<b>Ambulance</b><br>" + (a.id === 'current' ? 'You' : a.id));
              
              if(a.id === 'current') {
                 smoothFollow(a.latitude, a.longitude);
              }
           }
        });

        // 2. Police
        policeLayer.clearLayers();
        data.displayPolice.forEach(function(p) {
           L.marker([p.latitude, p.longitude], {
             icon: L.divIcon({ html: '<div class="emoji">🚓</div>', className: 'emoji', iconSize: [30, 30] })
           }).addTo(policeLayer).bindPopup("<b>Police Unit</b><br>" + p.id);
        });

        // 3. Destinations
        destLayer.clearLayers();
        data.displayDestinations.forEach(function(dest) {
           L.marker([dest.latitude, dest.longitude], {
             icon: L.divIcon({ html: '<div class="emoji">🏁</div>', className: 'emoji', iconSize: [30, 30] })
           }).addTo(destLayer).bindPopup("<b>Destination</b><br>" + (dest.name || 'Hospital'));
           
           L.circle([dest.latitude, dest.longitude], {
             color: '#ef4444',
             fillColor: '#ef4444',
             fillOpacity: 0.2,
             radius: 100
           }).addTo(destLayer);
        });

        // 4. Geofence
        geofenceLayer.clearLayers();
        if(data.geofence && data.geofence.latitude) {
           L.circle([data.geofence.latitude, data.geofence.longitude], {
             color: data.geofence.color || '#3b82f6',
             fillColor: data.geofence.color || '#3b82f6',
             fillOpacity: 0.05,
             weight: 2,
             dashArray: '5, 5',
             radius: data.geofence.radius
           }).addTo(geofenceLayer);
        }

        // 5. Signals
        signalLayer.clearLayers();
        data.signals.forEach(function(sig) {
          var color = sig.status === 'GREEN' ? '#22c55e' : '#3b82f6';
          var opacity = sig.status === 'GREEN' ? '0.4' : '0.15';
          L.marker([sig.latitude, sig.longitude], {
            icon: L.divIcon({ html: sig.status === 'GREEN' ? '🟢' : '🚦', className: 'emoji', iconSize: [24, 24] })
          }).addTo(signalLayer).bindPopup("<b>" + sig.name + "</b><br>Status: " + sig.status);

          L.circle([sig.latitude, sig.longitude], {
            color: color,
            fillColor: color,
            fillOpacity: opacity,
            weight: 2,
            radius: 300
          }).addTo(signalLayer);
        });

        // 6. Hospitals
        hospitalLayer.clearLayers();
        data.hospitals.forEach(function(h) {
          L.marker([h.latitude, h.longitude], {
            icon: L.divIcon({ html: '🏥', className: 'emoji', iconSize: [28, 28] })
          }).addTo(hospitalLayer).bindPopup("<b>" + h.name + "</b><br>Hospital");
        });

        // 7. Route Polyline
        var currentRouteStr = JSON.stringify(data.routeCoords);
        if (currentRouteStr !== lastRouteStr) {
          routeLayer.clearLayers();
          if(data.routeCoords && data.routeCoords.length > 1) {
             var routeLatlngs = data.routeCoords.filter(function(c) { return c.latitude && c.longitude; }).map(function(c) { return [c.latitude, c.longitude]; });
             if (routeLatlngs.length > 1) {
               var polyline = L.polyline(routeLatlngs, {
                 color: '#3b82f6',
                 weight: 5,
                 opacity: 0.8,
                 dashArray: '10, 10',
                 lineJoin: 'round'
               }).addTo(routeLayer);
               
               if (lastRouteStr === "" || lastRouteStr === "[]") {
                  map.fitBounds(polyline.getBounds(), { padding: [30, 30] });
                  shouldFollowAmbulance = true;
               }
             }
          }
          lastRouteStr = currentRouteStr;
        }
      } catch (e) {
        console.error("Leaflet data update error", e);
      }
    }
  </script>
</body>
</html>
`;

const LeafletMap: React.FC<LeafletMapProps> = ({
  ambulances = [],
  policeUnits = [],
  ambulanceLocation,
  policeLocation,
  destination,
  routeCoords = [],
  signals = [],
  hospitals = [],
  geofence,
}) => {
  const webViewRef = useRef<any>(null);

  const displayAmbulances: MapMarker[] = ambulances.length > 0 
    ? ambulances.filter(a => a.latitude && a.longitude)
    : (ambulanceLocation?.latitude && ambulanceLocation?.longitude ? [{ id: 'current', ...ambulanceLocation, active: true }] : []);

  const displayPolice = policeUnits.length > 0
    ? policeUnits.filter(p => p.latitude && p.longitude)
    : (policeLocation?.latitude && policeLocation?.longitude ? [{ id: 'current-police', ...policeLocation, active: true }] : []);

  const displayDestinations = [
    ...(destination?.latitude && destination?.longitude ? [destination] : []),
    ...displayAmbulances
      .filter((a): a is MapMarker & { destination: NonNullable<MapMarker['destination']> } => !!(a.active && a.destination))
      .map(a => a.destination)
  ];

  // Send updates to the map without full reload
  useEffect(() => {
    if (webViewRef.current) {
      const data = {
        displayAmbulances,
        displayPolice,
        displayDestinations,
        routeCoords,
        signals,
        hospitals,
        geofence,
      };
      
      const script = `updateData(${JSON.stringify(data)}); true;`;
      webViewRef.current.injectJavaScript(script);
    }
  }, [
    ambulances, policeUnits, ambulanceLocation, policeLocation, 
    destination, routeCoords, signals, hospitals, geofence
  ]);

  let WebView: any = null;
  try {
    WebView = require('react-native-webview').WebView;
  } catch (e) {
    console.log("WebView module not found natively");
  }

  if (!WebView) {
    return (
      <View style={styles.errorContainer}>
        <Text style={styles.errorText}>📍 Map Engine Pending...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <WebView
        ref={webViewRef}
        originWhitelist={['*']}
        source={{ html: STATIC_MAP_HTML }}
        style={styles.map}
        javaScriptEnabled={true}
        domStorageEnabled={true}
        scrollEnabled={false}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, borderRadius: 16, overflow: 'hidden' },
  map: { flex: 1 },
  errorContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#1e293b', padding: 20 },
  errorText: { textAlign: 'center', color: '#94a3b8', fontSize: 16 }
});

// We can still export as memo, but the deep comparisons are less critical now since the WebView handles the DOM effectively.
export default memo(LeafletMap, (prevProps, nextProps) => {
  return (
    JSON.stringify(prevProps.ambulances) === JSON.stringify(nextProps.ambulances) &&
    JSON.stringify(prevProps.policeUnits) === JSON.stringify(nextProps.policeUnits) &&
    JSON.stringify(prevProps.routeCoords) === JSON.stringify(nextProps.routeCoords) &&
    JSON.stringify(prevProps.signals) === JSON.stringify(nextProps.signals) &&
    prevProps.destination?.latitude === nextProps.destination?.latitude &&
    prevProps.destination?.longitude === nextProps.destination?.longitude &&
    prevProps.ambulanceLocation?.latitude === nextProps.ambulanceLocation?.latitude &&
    prevProps.ambulanceLocation?.longitude === nextProps.ambulanceLocation?.longitude &&
    prevProps.policeLocation?.latitude === nextProps.policeLocation?.latitude &&
    prevProps.policeLocation?.longitude === nextProps.policeLocation?.longitude
  );
});
