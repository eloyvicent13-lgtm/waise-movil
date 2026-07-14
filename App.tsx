import { DarkTheme, NavigationContainer } from "@react-navigation/native";
import { StatusBar } from "expo-status-bar";
import { ActivityIndicator, View } from "react-native";
import { AuthProvider, useAuth } from "./src/lib/AuthContext";
import { PrefsProvider } from "./src/lib/prefs";
import LoginScreen from "./src/screens/LoginScreen";
import RootNavigator from "./src/navigation";

function Root() {
  const { loading, username } = useAuth();
  if (loading) {
    return (
      <View style={{ flex: 1, backgroundColor: "#0b0e14", alignItems: "center", justifyContent: "center" }}>
        <ActivityIndicator color="#ffc55c" />
      </View>
    );
  }
  if (!username) return <LoginScreen />;
  return (
    <PrefsProvider>
      <RootNavigator />
    </PrefsProvider>
  );
}

const theme = {
  ...DarkTheme,
  colors: { ...DarkTheme.colors, background: "#0b0e14", card: "#11151f", border: "#232c3d" },
};

export default function App() {
  return (
    <AuthProvider>
      <NavigationContainer theme={theme}>
        <Root />
        <StatusBar style="light" />
      </NavigationContainer>
    </AuthProvider>
  );
}
