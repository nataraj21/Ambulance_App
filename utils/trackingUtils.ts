import { getDistance } from "geolib";

/**
 * Validates GPS coordinates for accuracy and sanity.
 */
export const isValidLocation = (
  location: { latitude: number; longitude: number; accuracy?: number | null } | null
): boolean => {
  if (!location) return false;
  const { latitude, longitude, accuracy } = location;
  
  // Basic sanity check
  if (latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) return false;
  
  // Accuracy check: Ignore points with accuracy > 100 meters (too noisy)
  if (accuracy != null && accuracy > 100) return false;
  
  return true;
};

/**
 * Determines if a new Firestore write is necessary based on movement or time.
 * Helps reduce unnecessary writes and quota usage.
 */
export const shouldUpdateFirestore = (
  lastLocation: { latitude: number; longitude: number } | null,
  currentLocation: { latitude: number; longitude: number },
  lastWriteTime: number,
  thresholdMeters: number = 5,
  maxIntervalMs: number = 10000 // Force update every 10 seconds regardless of movement
): boolean => {
  const now = Date.now();
  
  // If never written, write now
  if (!lastLocation) return true;
  
  // If moved enough, write now
  const distance = getDistance(lastLocation, currentLocation);
  if (distance >= thresholdMeters) return true;
  
  // If enough time passed, write now (heartbeat)
  if (now - lastWriteTime >= maxIntervalMs) return true;
  
  return false;
};

/**
 * Standardizes the "online" check for real-time devices.
 */
export const isDeviceOnline = (
  active: boolean,
  timestamp: number | undefined,
  currentTime: number,
  timeoutMs: number = 60000 // 1 minute
): boolean => {
  if (!active || !timestamp) return false;
  return (currentTime - timestamp) < timeoutMs;
};

/**
 * Formats error messages for consistent UI feedback.
 */
export const getErrorMessage = (error: any): string => {
  if (typeof error === 'string') return error;
  if (error.message) return error.message;
  return "An unexpected error occurred. Please check your connection.";
};
