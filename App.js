import React from "react";
import { NavigationContainer } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";

import DriverScreen from "./screens/DriverScreen";
import PoliceScreen from "./screens/PoliceScreen.js";

const Stack = createNativeStackNavigator();

export default function App() {
  return (
    <NavigationContainer>
      <Stack.Navigator>
        <Stack.Screen name="Driver" component={DriverScreen} />
       <Stack.Screen name="Police" component={PoliceScreen} />
      </Stack.Navigator>
    </NavigationContainer>
  );
} 