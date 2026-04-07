import { Text, View, TouchableOpacity, StyleSheet, ImageBackground } from "react-native";
import { useRouter } from "expo-router";

export default function HomeScreen() {
  const router = useRouter();

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

        <TouchableOpacity
          style={styles.driverBtn}
          onPress={() => router.push("/driver")}
        >
          <Text style={styles.btnText}>🚑 Driver Mode</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.policeBtn}
          onPress={() => router.push("/police")}
        >
          <Text style={styles.btnText}>🚓 Police Mode</Text>
        </TouchableOpacity>

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
    backgroundColor: "rgba(0,0,0,0.6)", // dark overlay for readability
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },

  title: {
    fontSize: 32,
    fontWeight: "bold",
    color: "#22c55e",
    marginBottom: 10,
  },

  subtitle: {
    fontSize: 16,
    color: "#e2e8f0",
    marginBottom: 40,
    textAlign: "center",
  },

  driverBtn: {
    backgroundColor: "#22c55e",
    paddingVertical: 15,
    borderRadius: 12,
    marginBottom: 20,
    width: "80%",
    alignItems: "center",
  },

  policeBtn: {
    backgroundColor: "#3b82f6",
    paddingVertical: 15,
    borderRadius: 12,
    width: "80%",
    alignItems: "center",
  },

  btnText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },

  footer: {
    marginTop: 50,
    fontSize: 14,
    color: "#cbd5f5",
  },
});