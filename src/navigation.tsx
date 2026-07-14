import { useEffect, useRef, useState } from "react";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { createBottomTabNavigator, type BottomTabBarProps } from "@react-navigation/bottom-tabs";
import { Animated, Platform, Pressable, StyleSheet, Text, View } from "react-native";
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

const TABS: Record<string, { label: string; on: keyof typeof Ionicons.glyphMap; off: keyof typeof Ionicons.glyphMap }> = {
  Chat: { label: "Waise", on: "chatbubble-ellipses", off: "chatbubble-ellipses-outline" },
  Projects: { label: "Proyectos", on: "people", off: "people-outline" },
  Settings: { label: "Ajustes", on: "settings", off: "settings-outline" },
};

function GlassTabBackground() {
  if (isLiquidGlassAvailable()) {
    return <GlassView glassEffectStyle="regular" style={StyleSheet.absoluteFill} />;
  }
  if (Platform.OS === "ios") {
    return <BlurView intensity={70} tint="systemUltraThinMaterialDark" style={StyleSheet.absoluteFill} />;
  }
  return <View style={[StyleSheet.absoluteFill, { backgroundColor: "#161b26" }]} />;
}

/** Floating WhatsApp-style bar: big glass pill slides to the active tab. */
function LiquidTabBar({ state, navigation }: BottomTabBarProps) {
  const insets = useSafeAreaInsets();
  const { prefs } = usePrefs();
  const accent = ACCENTS[prefs.accent];
  const [barW, setBarW] = useState(0);
  const anim = useRef(new Animated.Value(state.index)).current;

  useEffect(() => {
    Animated.spring(anim, { toValue: state.index, useNativeDriver: true, tension: 140, friction: 16 }).start();
  }, [state.index, anim]);

  const segW = barW / state.routes.length;

  return (
    <View
      onLayout={(e) => setBarW(e.nativeEvent.layout.width)}
      style={[
        styles.bar,
        { bottom: Math.max(insets.bottom, 12), height: TAB_BAR_HEIGHT, borderRadius: BAR_RADIUS },
      ]}
    >
      <GlassTabBackground />
      {segW > 0 && (
        <Animated.View
          style={[
            styles.slider,
            {
              width: segW - 12,
              height: TAB_BAR_HEIGHT - 12,
              borderRadius: (TAB_BAR_HEIGHT - 12) / 2,
              transform: [
                {
                  translateX: anim.interpolate({
                    inputRange: state.routes.map((_, idx) => idx),
                    outputRange: state.routes.map((_, idx) => idx * segW + 6),
                  }),
                },
              ],
            },
          ]}
        />
      )}
      <View style={styles.row}>
        {state.routes.map((route, i) => {
          const focused = state.index === i;
          const t = TABS[route.name] || { label: route.name, on: "ellipse" as const, off: "ellipse-outline" as const };
          return (
            <Pressable
              key={route.key}
              style={styles.item}
              onPress={() => {
                const ev = navigation.emit({ type: "tabPress", target: route.key, canPreventDefault: true });
                if (!focused && !ev.defaultPrevented) navigation.navigate(route.name as never);
              }}
            >
              <Ionicons name={focused ? t.on : t.off} size={22} color={focused ? accent.color : colors.dim} />
              <Text style={[styles.label, { color: focused ? accent.color : colors.dim }]}>{t.label}</Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    position: "absolute",
    left: TAB_BAR_SIDE_MARGIN,
    right: TAB_BAR_SIDE_MARGIN,
    overflow: "hidden",
  },
  slider: {
    position: "absolute",
    top: 6,
    left: 0,
    backgroundColor: "rgba(255,255,255,0.13)",
  },
  row: { flexDirection: "row", flex: 1 },
  item: { flex: 1, alignItems: "center", justifyContent: "center", gap: 3 },
  label: { fontSize: 11, fontWeight: "700" },
});

function Tabs() {
  return (
    <Tab.Navigator
      tabBar={(props) => <LiquidTabBar {...props} />}
      screenOptions={{
        headerStyle: { backgroundColor: colors.bg },
        headerShadowVisible: false,
        headerTintColor: colors.text,
        headerTitleStyle: { color: colors.text, fontWeight: "800" },
      }}
    >
      <Tab.Screen name="Chat" component={ChatScreen} options={{ title: "Waise", headerShown: false }} />
      <Tab.Screen name="Projects" component={ProjectsScreen} options={{ title: "Proyectos" }} />
      <Tab.Screen name="Settings" component={SettingsScreen} options={{ title: "Ajustes" }} />
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
