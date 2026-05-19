/**
 * 🛣️ Optimized OSM Routing Utility
 * Free Routing Stack:
 * 1. OpenRouteService
 * 2. OSRM
 * 3. Straight-line fallback
 */

export type LatLng = {
  latitude: number;
  longitude: number;
};

export type RouteResponse = {
  coords: LatLng[];
  distance: string;
  eta: string;
  status: string;
};

const ORS_API_KEY =
  process.env.EXPO_PUBLIC_ORS_API_KEY ||
  "YOUR_ORS_KEY";

/**
 * ⏱️ Safe fetch with timeout
 */
const fetchWithTimeout = async (
  url: string,
  options: RequestInit = {},
  timeout = 8000
) => {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeout);

  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
    });
    clearTimeout(id);
    return response;
  } catch (err) {
    clearTimeout(id);
    throw err;
  }
};

/**
 * 🚀 OpenRouteService Route
 */
export const fetchORSRoute = async (
  start: LatLng,
  end: LatLng
): Promise<RouteResponse> => {
  const url =
    "https://api.openrouteservice.org/v2/directions/driving-car/geojson";

  const response = await fetchWithTimeout(
    url,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: ORS_API_KEY,
      },
      body: JSON.stringify({
        coordinates: [
          [start.longitude, start.latitude],
          [end.longitude, end.latitude],
        ],
      }),
    },
    8000
  );

  const json = await response.json();

  if (json.features?.length > 0) {
    const feature = json.features[0];

    const coords = feature.geometry.coordinates.map((c: any) => ({
      latitude: c[1],
      longitude: c[0],
    }));

    const dist = feature.properties.summary.distance;
    const dur = feature.properties.summary.duration;

    return {
      coords,
      distance: (dist / 1000).toFixed(1) + " km",
      eta: Math.ceil(dur / 60) + " mins",
      status: "ORS Route Active",
    };
  }

  throw new Error("No ORS route");
};

/**
 * 🆓 OSRM Route (Improved URL)
 */
export const fetchOSRMRoute = async (
  start: LatLng,
  end: LatLng
): Promise<RouteResponse> => {
  const url =
    "https://router.project-osrm.org/route/v1/driving/" +
    `${start.longitude},${start.latitude};` +
    `${end.longitude},${end.latitude}` +
    "?overview=full&geometries=geojson";

  const response = await fetchWithTimeout(url, {}, 8000);

  const data = await response.json();

  if (data.routes?.length > 0) {
    const route = data.routes[0];

    const coords = route.geometry.coordinates.map((c: any) => ({
      latitude: c[1],
      longitude: c[0],
    }));

    return {
      coords,
      distance: (route.distance / 1000).toFixed(1) + " km",
      eta: Math.ceil(route.duration / 60) + " mins",
      status: "OSRM Route Active",
    };
  }

  throw new Error("No OSRM route");
};

/**
 * 📍 Straight Line Fallback
 */
export const straightLineRoute = (
  start: LatLng,
  end: LatLng
): RouteResponse => {
  return {
    coords: [start, end],
    distance: "Approx",
    eta: "--",
    status: "Offline Fallback",
  };
};

/**
 * 🔥 Main Routing Engine
 */
export const getFreeRoute = async (
  start: LatLng,
  end: LatLng
): Promise<RouteResponse> => {
  try {
    return await fetchORSRoute(start, end);
  } catch (err) {
    console.warn("ORS failed → trying OSRM");

    try {
      return await fetchOSRMRoute(start, end);
    } catch (err2) {
      console.warn("OSRM failed → using fallback");
      return straightLineRoute(start, end);
    }
  }
};