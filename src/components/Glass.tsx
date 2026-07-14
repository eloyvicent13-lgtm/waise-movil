import { GlassView, isLiquidGlassAvailable } from "expo-glass-effect";
import { BlurView } from "expo-blur";
import { Platform, StyleSheet, View, type ViewStyle } from "react-native";

interface Props {
  children: React.ReactNode;
  style?: ViewStyle | ViewStyle[];
  intensity?: number;
  radius?: number;
}

const liquid = isLiquidGlassAvailable();

/** Real iOS 26 Liquid Glass (UIGlassEffect) where available; graceful blur/flat fallback otherwise. */
export default function Glass({ children, style, intensity = 40, radius = 20 }: Props) {
  if (liquid) {
    return (
      <GlassView glassEffectStyle="regular" style={[{ borderRadius: radius }, style]}>
        {children}
      </GlassView>
    );
  }
  if (Platform.OS === "ios") {
    return (
      <BlurView intensity={intensity} tint="systemUltraThinMaterialDark" style={[{ borderRadius: radius, overflow: "hidden" }, style]}>
        <View style={[styles.border, { borderRadius: radius }]}>{children}</View>
      </BlurView>
    );
  }
  return <View style={[styles.fallback, { borderRadius: radius }, style]}>{children}</View>;
}

const styles = StyleSheet.create({
  border: { flex: 1, borderWidth: StyleSheet.hairlineWidth, borderColor: "rgba(255,255,255,0.12)", overflow: "hidden" },
  fallback: { backgroundColor: "rgba(255,255,255,0.07)", borderWidth: 1, borderColor: "rgba(255,255,255,0.10)" },
});
