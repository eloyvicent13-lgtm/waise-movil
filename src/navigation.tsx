import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { Platform, StyleSheet, View } from "react-native";
import { BlurView } from "expo-blur";
import { GlassView, isLiquidGlassAvailable } from "expo-glass-effect";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Ionicons from "@expo/vector-icons/Ionicons";
import ChatScreen from "./screens/ChatScreen";
import ProjectsScreen from "./screens/ProjectsScreen";
import ProjectDetailScreen from "./screens/ProjectDetailScreen";
import SettingsScreen from "./screens/SettingsScreen";
import { usePrefs } from "./lib/prefs";
import { ACCENTS, colors, TAB_BAR_HEIGHT, TAB_BAR_SIDE_MARGIN } from "./lib/theme";
import type { Project } from "./lib/types";

export type RootStackParamList = {
  Tabs: undefined;
  ProjectDetail: { project: Project };
};

export type TabParamList = {
  Chat: undefined;
  Projects: undefined;
  Settings: undefined;
};

const Stack = createNativeStackNavigator<RootStackParamList>();
const Tab = createBottomTabNavigator<TabParamList>();

const BAR_RADIUS = TAB_BAR_HEIGHT / 2;

/** WhatsApp-style pill highlight behind the active tab's icon. */
function TabIcon({ name, focused, color }: { name: keyof typeof Ionicons.glyphMap; focused: boolean; color: string }) {
  return (
    <View style={[iconStyles.pill, focused && iconStyles.pillActive]}>
      <Ionicons name={name} size={21} color={color} />
    </View>
  );
}

const iconStyles = StyleSheet.create({
  pill: {
    width: 58,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 6,
  },
  pillActive: { backgroundColor: "rgba(255,255,255,0.14)" },
});

function GlassTabBackground() {
  if (isLiquidGlassAvailable()) {
    return <GlassView glassEffectStyle="regular" style={[StyleSheet.absoluteFill, { borderRadius: BAR_RADIUS }]} />;
  }
  if (Platform.OS === "ios") {
    return (
      <BlurView
        intensity={70}
        tint="systemUltraThinMaterialDark"
        style={[StyleSheet.absoluteFill, { borderRadius: BAR_RADIUS, overflow: "hidden" }]}
      />
    );
  }
  return <View style={[StyleSheet.absoluteFill, { borderRadius: BAR_RADIUS, backgroundColor: "#161b26" }]} />;
}

function Tabs() {
  const { prefs } = usePrefs();
  const insets = useSafeAreaInsets();
  const accent = ACCENTS[prefs.accent];
  return (
    <Tab.Navigator
      screenOptions={{
        headerStyle: { backgroundColor: colors.bg },
        headerShadowVisible: false,
        headerTintColor: colors.text,
        headerTitleStyle: { color: colors.text, fontWeight: "800" },
        tabBarStyle: {
          position: "absolute",
          left: TAB_BAR_SIDE_MARGIN,
          right: TAB_BAR_SIDE_MARGIN,
          bottom: Math.max(insets.bottom, 12),
          height: TAB_BAR_HEIGHT,
          borderRadius: BAR_RADIUS,
          borderTopWidth: 0,
          backgroundColor: "transparent",
          overflow: "hidden",
          elevation: 0,
        },
        tabBarBackground: GlassTabBackground,
        tabBarActiveTintColor: accent.color,
        tabBarInactiveTintColor: colors.dim,
        tabBarLabelStyle: { fontSize: 11, fontWeight: "700", marginTop: 2 },
        tabBarItemStyle: { paddingBottom: 8 },
      }}
    >
      <Tab.Screen
        name="Chat"
        component={ChatScreen}
        options={{
          title: "Waise",
          headerShown: false,
          tabBarIcon: ({ focused, color }) => (
            <TabIcon name={focused ? "chatbubble-ellipses" : "chatbubble-ellipses-outline"} focused={focused} color={color} />
          ),
        }}
      />
      <Tab.Screen
        name="Projects"
        component={ProjectsScreen}
        options={{
          title: "Proyectos",
          tabBarIcon: ({ focused, color }) => (
            <TabIcon name={focused ? "people" : "people-outline"} focused={focused} color={color} />
          ),
        }}
      />
      <Tab.Screen
        name="Settings"
        component={SettingsScreen}
        options={{
          title: "Ajustes",
          tabBarIcon: ({ focused, color }) => (
            <TabIcon name={focused ? "settings" : "settings-outline"} focused={focused} color={color} />
          ),
        }}
      />
    </Tab.Navigator>
  );
}

export default function RootNavigator() {
  return (
    <Stack.Navigator
      screenOptions={{
        headerStyle: { backgroundColor: colors.surface },
        headerTintColor: colors.text,
        headerTitleStyle: { color: colors.text },
      }}
    >
      <Stack.Screen name="Tabs" component={Tabs} options={{ headerShown: false }} />
      <Stack.Screen
        name="ProjectDetail"
        component={ProjectDetailScreen}
        options={({ route }) => ({ title: route.params.project.name })}
      />
    </Stack.Navigator>
  );
}
