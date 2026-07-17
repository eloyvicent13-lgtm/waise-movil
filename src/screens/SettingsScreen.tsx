import { useEffect, useState } from "react";
import { Linking, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import { serverFetch } from "../lib/auth";
import { loginCode, planInfo } from "../lib/api";
import { useAuth } from "../lib/AuthContext";
import { usePrefs } from "../lib/prefs";
import { ACCENTS, type Accent, colors } from "../lib/theme";
import type { PlanInfo } from "../lib/types";
import Glass from "../components/Glass";

const WEB_URL = "http://149.202.84.78:8126";

function fmtDuration(seconds: number | null): string {
  if (seconds == null || seconds <= 0) return "";
  const d = Math.floor(seconds / 86400);
  const h = Math.floor((seconds % 86400) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (d > 0) return `${d}d ${h}h`;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

const BUCKET_LABEL: Record<string, string> = {
  lumin: "Lumin Vera 3",
  geminiEcon: "Gemini económicos",
  geminiPremium: "Gemini 3.5 Flash / 3.1 Pro",
  nanoBanana: "Nano Banana",
  nanoBananaPro: "Nano Banana Pro",
  video: "Vídeo",
};

async function openBilling(plan?: string) {
  try {
    const { code } = await loginCode();
    const url = `${WEB_URL}/auth/consume?code=${encodeURIComponent(code)}${plan ? `&plan=${plan}` : ""}`;
    Linking.openURL(url);
  } catch {
    Linking.openURL(`${WEB_URL}/precios`);
  }
}

const ACCENT_LIST: { id: Accent; label: string }[] = [
  { id: "gold", label: "Dorado" },
  { id: "violet", label: "Violeta" },
  { id: "emerald", label: "Esmeralda" },
];

const INSTRUCTIONS_PIN = "8768";

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <Glass radius={18} intensity={35}>
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>{title}</Text>
        {children}
      </View>
    </Glass>
  );
}

export default function SettingsScreen() {
  const { logout } = useAuth();
  const { prefs, setPrefs } = usePrefs();
  const accent = ACCENTS[prefs.accent];

  const [username, setUsername] = useState("…");
  const [unlocked, setUnlocked] = useState(false);
  const [pin, setPin] = useState("");
  const [pinError, setPinError] = useState(false);
  const [plan, setPlan] = useState<PlanInfo | null>(null);

  useEffect(() => {
    serverFetch("/me").then((r) => r.json()).then((d) => setUsername(d.username || "")).catch(() => {});
    planInfo().then(setPlan).catch(() => {});
  }, []);

  function tryUnlock() {
    if (pin === INSTRUCTIONS_PIN) {
      setUnlocked(true);
      setPinError(false);
      setPin("");
    } else setPinError(true);
  }

  return (
    <ScrollView style={styles.root} contentContainerStyle={{ padding: 16, gap: 14, paddingBottom: 150 }}>
      <Section title="Perfil">
        <Text style={styles.label}>¿Cómo quieres que Waise te llame?</Text>
        <TextInput
          style={styles.input}
          placeholder="Tu nombre"
          placeholderTextColor={colors.faint}
          value={prefs.display_name}
          onChangeText={(v) => setPrefs({ display_name: v })}
        />
        <View style={styles.labelRow}>
          <Text style={styles.label}>Instrucciones para Waise</Text>
          {!unlocked && <Text style={[styles.badge, { color: colors.amber }]}>🔒 protegido</Text>}
        </View>
        <TextInput
          style={[styles.input, styles.textarea, !unlocked && styles.disabled]}
          placeholder="p. ej. responde breve y con ejemplos…"
          placeholderTextColor={colors.faint}
          value={prefs.custom_instructions}
          onChangeText={(v) => setPrefs({ custom_instructions: v })}
          editable={unlocked}
          multiline
        />
        {!unlocked && (
          <View style={styles.pinRow}>
            <TextInput
              style={[styles.input, { flex: 1 }]}
              placeholder="Código para editar"
              placeholderTextColor={colors.faint}
              value={pin}
              onChangeText={(v) => { setPin(v); setPinError(false); }}
              secureTextEntry
              keyboardType="number-pad"
            />
            <TouchableOpacity style={[styles.smallBtn, { backgroundColor: accent.color }]} onPress={tryUnlock}>
              <Text style={[styles.smallBtnText, { color: accent.ink }]}>Desbloquear</Text>
            </TouchableOpacity>
          </View>
        )}
        {pinError && <Text style={styles.pinError}>Código incorrecto</Text>}
      </Section>

      <Section title="Rendimiento">
        <Text style={styles.label}>Nivel de esfuerzo</Text>
        <View style={styles.seg}>
          {(["low", "medium", "high"] as const).map((e) => (
            <TouchableOpacity key={e} onPress={() => setPrefs({ effort: e })} style={[styles.segItem, prefs.effort === e && { backgroundColor: colors.surface3 }]}>
              <Text style={styles.segText}>{e === "low" ? "Bajo" : e === "medium" ? "Medio" : "Alto"}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </Section>

      <Section title="Apariencia">
        <Text style={styles.label}>Color de acento</Text>
        <View style={styles.row}>
          {ACCENT_LIST.map((a) => (
            <TouchableOpacity
              key={a.id}
              onPress={() => setPrefs({ accent: a.id })}
              style={[styles.dot, { backgroundColor: ACCENTS[a.id].color }, prefs.accent === a.id && styles.dotActive]}
            />
          ))}
        </View>
        <Text style={[styles.label, { marginTop: 14 }]}>Tamaño del texto</Text>
        <View style={styles.seg}>
          {(["sm", "md", "lg"] as const).map((s) => (
            <TouchableOpacity key={s} onPress={() => setPrefs({ font_size: s })} style={[styles.segItem, prefs.font_size === s && { backgroundColor: colors.surface3 }]}>
              <Text style={styles.segText}>{s === "sm" ? "Pequeño" : s === "md" ? "Normal" : "Grande"}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </Section>

      <Section title="Plan">
        {!plan ? (
          <Text style={styles.label}>Cargando…</Text>
        ) : (
          <>
            <View style={styles.planHeadRow}>
              <Text style={[styles.planName, { color: accent.color }]}>{plan.label}</Text>
              <TouchableOpacity style={[styles.smallBtn, { backgroundColor: accent.color }]} onPress={() => openBilling()}>
                <Text style={[styles.smallBtnText, { color: accent.ink }]}>{plan.plan === "free" ? "Suscribirme" : "Cambiar plan"}</Text>
              </TouchableOpacity>
            </View>

            <Text style={[styles.label, { marginTop: 14 }]}>Uso — 5h / semana</Text>
            {(["lumin", "geminiEcon", "geminiPremium"] as const).map((b) => {
              const d = plan.buckets[b];
              const pct = d.limit5h > 0 ? Math.min(100, Math.round((d.used5h / d.limit5h) * 100)) : 0;
              return (
                <View key={b} style={styles.usageRow}>
                  <View style={styles.usageHead}>
                    <Text style={styles.usageName}>{BUCKET_LABEL[b]}</Text>
                    <Text style={styles.usageNums}>
                      {d.limit5h > 0
                        ? `${d.used5h}/${d.limit5h} · 5h${fmtDuration(d.resets5hInSeconds) ? ` (${fmtDuration(d.resets5hInSeconds)})` : ""} — ${d.usedWeek}/${d.limitWeek} · sem${fmtDuration(d.resetsWeekInSeconds) ? ` (${fmtDuration(d.resetsWeekInSeconds)})` : ""}`
                        : "no incluido"}
                    </Text>
                  </View>
                  <View style={styles.barTrack}><View style={[styles.barFill, pct >= 85 && styles.barFillWarn, { width: `${pct}%` }]} /></View>
                </View>
              );
            })}

            <Text style={[styles.label, { marginTop: 14 }]}>Uso — cuota mensual</Text>
            {(["nanoBanana", "nanoBananaPro", "video"] as const).map((b) => {
              const d = plan.buckets[b];
              const pct = d.limit > 0 ? Math.min(100, Math.round((d.used / d.limit) * 100)) : 0;
              return (
                <View key={b} style={styles.usageRow}>
                  <View style={styles.usageHead}>
                    <Text style={styles.usageName}>{BUCKET_LABEL[b]}</Text>
                    <Text style={styles.usageNums}>{d.limit > 0 ? `${d.used}/${d.limit}` : "no incluido"}</Text>
                  </View>
                  <View style={styles.barTrack}><View style={[styles.barFill, pct >= 85 && styles.barFillWarn, { width: `${pct}%` }]} /></View>
                </View>
              );
            })}
          </>
        )}
      </Section>

      <Section title="Cuenta">
        <View style={styles.account}>
          <View style={[styles.avatar, { backgroundColor: accent.color }]}>
            <Text style={[styles.avatarText, { color: accent.ink }]}>{(username[0] || "?").toUpperCase()}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.accountUser}>{username}</Text>
            <Text style={styles.accountNote}>Historial y ajustes sincronizados</Text>
          </View>
        </View>
        <TouchableOpacity style={styles.logout} onPress={logout}>
          <Text style={styles.logoutText}>Cerrar sesión</Text>
        </TouchableOpacity>
      </Section>

      <Section title="Acerca de">
        <View style={styles.aboutRow}><Text style={styles.label}>Versión</Text><Text style={styles.aboutVal}>1.0.0</Text></View>
        <View style={styles.aboutRow}><Text style={styles.label}>Servidor</Text><Text style={styles.aboutValMono}>149.202.84.78:8103</Text></View>
      </Section>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  section: { padding: 16 },
  sectionTitle: { color: colors.faint, fontSize: 11, fontWeight: "800", textTransform: "uppercase", letterSpacing: 0.6, marginBottom: 12 },
  labelRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 12 },
  label: { color: colors.text, fontSize: 13.5, fontWeight: "600", marginBottom: 6 },
  badge: { fontSize: 11, fontWeight: "600" },
  input: { backgroundColor: "rgba(0,0,0,0.3)", borderWidth: 1, borderColor: colors.strokeSoft, borderRadius: 10, padding: 11, color: colors.text, fontSize: 14 },
  textarea: { minHeight: 90, textAlignVertical: "top" },
  disabled: { opacity: 0.5 },
  pinRow: { flexDirection: "row", gap: 8, marginTop: 8, alignItems: "center" },
  smallBtn: { borderRadius: 10, paddingHorizontal: 14, paddingVertical: 11, justifyContent: "center" },
  smallBtnText: { fontWeight: "700", fontSize: 13 },
  pinError: { color: "#ff98a1", fontSize: 12, marginTop: 6 },
  row: { flexDirection: "row", gap: 12 },
  dot: { width: 32, height: 32, borderRadius: 16, borderWidth: 2, borderColor: "transparent" },
  dotActive: { borderColor: "#fff" },
  seg: { flexDirection: "row", backgroundColor: colors.surface2, borderRadius: 10, padding: 3, gap: 2 },
  segItem: { flex: 1, paddingVertical: 8, borderRadius: 8, alignItems: "center" },
  segText: { color: colors.text, fontSize: 12.5, fontWeight: "600" },
  account: { flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 14 },
  avatar: { width: 42, height: 42, borderRadius: 13, alignItems: "center", justifyContent: "center" },
  avatarText: { fontWeight: "800", fontSize: 18 },
  accountUser: { color: colors.text, fontWeight: "700", fontSize: 15 },
  accountNote: { color: colors.faint, fontSize: 12 },
  logout: { backgroundColor: "rgba(240,97,109,0.12)", borderWidth: 1, borderColor: colors.red, borderRadius: 12, padding: 14, alignItems: "center" },
  logoutText: { color: "#ff98a1", fontWeight: "800" },
  aboutRow: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 6 },
  aboutVal: { color: colors.dim, fontSize: 13 },
  aboutValMono: { color: colors.dim, fontSize: 12, fontFamily: "monospace" },
  planHeadRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  planName: { fontSize: 16, fontWeight: "800" },
  usageRow: { marginTop: 10 },
  usageHead: { flexDirection: "row", justifyContent: "space-between", marginBottom: 6 },
  usageName: { color: colors.text, fontSize: 12.5, fontWeight: "700" },
  usageNums: { color: colors.faint, fontSize: 11.5 },
  barTrack: { height: 6, borderRadius: 3, backgroundColor: colors.surface2, overflow: "hidden" },
  barFill: { height: "100%", borderRadius: 3, backgroundColor: colors.green },
  barFillWarn: { backgroundColor: colors.amber },
});
