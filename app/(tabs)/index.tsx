import React, { useEffect, useState } from "react";
import { Text, View, TouchableOpacity, StyleSheet, ImageBackground, ActivityIndicator, Alert } from "react-native";
import { useRouter } from "expo-router";
import { onAuthStateChanged, signOut } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { auth, db } from "../../firebase";

export default function HomeScreen() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        try {
          const docRef = doc(db, "users", user.uid);
          const docSnap = await getDoc(docRef);
          if (docSnap.exists()) {
            const role = docSnap.data().role;
            if (role) {
               router.replace(`/${role}` as any);
               return; // Exit here so loading doesn't finish on this screen
            }
          }
        } catch (e) {
          console.error("Error fetching user role", e);
        }
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  return (
    <ImageBackground
      source={require("../../assets/images/Hospital.png")}
      style={styles.background}
      resizeMode="cover"
    >
      <View style={styles.overlay}>

        <Text style={styles.title}>🚑 LifeRoute</Text>
        <Text style={styles.subtitle}>
          Smart Ambulance Priority System
        </Text>

        {loading ? (
          <ActivityIndicator size="large" color="#22c55e" style={{ marginVertical: 40 }} />
        ) : (
          <View style={styles.actionContainer}>
            <TouchableOpacity
              style={styles.loginBtn}
              onPress={() => router.push("/login" as any)}
            >
              <Text style={styles.btnText}>Log In</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.registerBtn}
              onPress={() => router.push("/register" as any)}
            >
              <Text style={styles.btnText}>Create Account</Text>
            </TouchableOpacity>
          </View>
        )}

        <Text style={styles.footer}>
          Saving Lives with Smart Technology ❤️
        </Text>

      </View>
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  background: {
    flex: 1,
  },
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.7)", 
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  title: {
    fontSize: 42,
    fontWeight: "bold",
    color: "#22c55e",
    marginBottom: 10,
    textShadowColor: 'rgba(0, 0, 0, 0.75)',
    textShadowOffset: { width: -1, height: 1 },
    textShadowRadius: 10
  },
  subtitle: {
    fontSize: 18,
    color: "#e2e8f0",
    marginBottom: 60,
    textAlign: "center",
    fontWeight: "500",
  },
  actionContainer: {
    width: "100%",
    alignItems: "center",
  },
  loginBtn: {
    backgroundColor: "#3b82f6",
    paddingVertical: 16,
    borderRadius: 14,
    marginBottom: 20,
    width: "85%",
    alignItems: "center",
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 5,
    elevation: 8,
  },
  registerBtn: {
    backgroundColor: "transparent",
    borderWidth: 2,
    borderColor: "#3b82f6",
    paddingVertical: 16,
    borderRadius: 14,
    width: "85%",
    alignItems: "center",
  },
  btnText: {
    color: "#fff",
    fontSize: 18,
    fontWeight: "bold",
  },
  footer: {
    position: 'absolute',
    bottom: 40,
    fontSize: 14,
    color: "#cbd5f5",
  },
});