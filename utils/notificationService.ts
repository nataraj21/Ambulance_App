import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import { Platform, Alert } from 'react-native';
import { db } from '../firebase';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';
import Constants from 'expo-constants';

// Configure notification behavior
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

/**
 * Register for Push Notifications and get Expo Push Token
 */
export const registerForPushNotifications = async (userId: string = 'police1', collectionName: string = 'police_units') => {
  let token;

  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('emergency-alerts', {
      name: 'Emergency Alerts',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#FF231F7C',
    });
  }

  if (Device.isDevice) {
    // ⚠️ SDK 53+ Note: Remote notifications do not work in Expo Go.
    // We check if we are running in Expo Go or a Development Build.
    if (Constants.appOwnership === 'expo') {
      console.warn(
        'Push notifications are not supported in Expo Go (SDK 53+). ' +
        'Please use a Development Build to test remote notifications.'
      );
      return null;
    }

    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;
    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }
    if (finalStatus !== 'granted') {
      Alert.alert('Error', 'Failed to get push token for push notification!');
      return;
    }
    
    // Get Expo Push Token
    try {
      // Get the EAS project ID from app.json / Constants
      const projectId = Constants?.expoConfig?.extra?.eas?.projectId || Constants?.easConfig?.projectId;
      
      if (!projectId) {
        console.warn('EAS Project ID not found. Ensure app.json has extra.eas.projectId');
      }

      token = (await Notifications.getExpoPushTokenAsync({
        projectId: projectId,
      })).data;
      console.log('Expo Push Token:', token);

      // Save to Firestore
      if (token) {
        await setDoc(doc(db, collectionName, userId), {
          expoPushToken: token,
          updatedAt: serverTimestamp(),
          active: true
        }, { merge: true });
      }
    } catch (error) {
      console.error('Error getting push token:', error);
    }
  } else {
    console.log('Must use physical device for Push Notifications');
  }

  return token;
};

/**
 * Handle foreground notifications
 */
export const setupNotificationListeners = () => {
  // Foreground listener
  const notificationListener = Notifications.addNotificationReceivedListener(notification => {
    console.log('Notification Received in Foreground:', notification);
    const { title, body } = notification.request.content;
    Alert.alert(title || '🚨 Alert', body || 'Ambulance approaching!');
  });

  // Background/Tap listener
  const responseListener = Notifications.addNotificationResponseReceivedListener(response => {
    console.log('Notification Tapped:', response.notification.request.content.data);
  });

  return () => {
    notificationListener.remove();
    responseListener.remove();
  };
};

/**
 * Triggers a local push notification immediately.
 * Very useful for Expo Go testing where remote push pushes are blocked.
 */
export const sendLocalEmergencyNotification = async (signalName: string) => {
  await Notifications.scheduleNotificationAsync({
    content: {
      title: "🚨 Emergency Alert",
      body: `Ambulance approaching ${signalName}. Prepare traffic clearance.`,
      sound: 'default',
      data: {
        signalName,
        type: "EMERGENCY_ALERT",
      },
    },
    trigger: null, // Send immediately
  });
};
