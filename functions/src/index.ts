import { Expo, ExpoPushMessage } from "expo-server-sdk";
import * as admin from "firebase-admin";
import { onDocumentUpdated } from "firebase-functions/v2/firestore";

admin.initializeApp();

const db = admin.firestore();
const expo = new Expo();

/**
 * Triggered when a Traffic Signal status changes.
 * Sends push notifications to all active police and admin units when a signal turns GREEN.
 */
export const onSignalChange = onDocumentUpdated(
    "TrafficSignals/{signalId}",
    async (event) => {
        const newValue = event.data?.after.data();
        const oldValue = event.data?.before.data();

        // Safety check
        if (!newValue || !oldValue) return null;

        // Avoid duplicate triggers
        if (newValue.status === oldValue.status) return null;

        // Check if status changed to GREEN
        if (newValue.status === "GREEN") {
            const signalId = event.params.signalId;
            const signalName = newValue.name || "Nearby Signal";

            console.log(`Signal ${signalId} turned GREEN. Sending alerts...`);

            try {
                // Fetch active police & admin units
                const policePromise = db
                    .collection("police_units")
                    .where("active", "==", true)
                    .get();

                const adminPromise = db
                    .collection("admin_units")
                    .where("active", "==", true)
                    .get();

                const [policeSnapshot, adminSnapshot] = await Promise.all([
                    policePromise,
                    adminPromise,
                ]);

                if (policeSnapshot.empty && adminSnapshot.empty) {
                    console.log("No active police or admin units found.");
                    return null;
                }

                const messages: ExpoPushMessage[] = [];

                // Helper to collect push messages
                const addMessages = (
                    snapshot: FirebaseFirestore.QuerySnapshot
                ) => {
                    snapshot.forEach((doc) => {
                        const data = doc.data();
                        const token = data.expoPushToken;

                        if (token && Expo.isExpoPushToken(token)) {
                            messages.push({
                                to: token,
                                sound: "default",
                                title: "🚨 Emergency Alert",
                                body: `Ambulance approaching ${signalName}. Prepare traffic clearance.`,
                                data: {
                                    signalId,
                                    signalName,
                                    type: "EMERGENCY_ALERT",
                                },
                            });
                        }
                    });
                };

                addMessages(policeSnapshot);
                addMessages(adminSnapshot);

                if (messages.length === 0) {
                    console.log("No valid Expo push tokens found.");
                    return null;
                }

                // Send notifications in chunks
                const chunks = expo.chunkPushNotifications(messages);
                const tickets: any[] = [];

                for (const chunk of chunks) {
                    try {
                        const ticketChunk =
                            await expo.sendPushNotificationsAsync(chunk);

                        console.log("Tickets:", ticketChunk);
                        tickets.push(...ticketChunk);
                    } catch (error) {
                        console.error("Error sending notifications:", error);
                    }
                }

                return {
                    success: true,
                    alertedCount: messages.length,
                };
            } catch (error) {
                console.error("Error processing alerts:", error);
                return null;
            }
        }

        return null;
    }
);