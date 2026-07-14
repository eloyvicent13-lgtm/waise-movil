import { useState } from "react";
import { ActivityIndicator, KeyboardAvoidingView, Platform, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import Glass from "../components/Glass";
import { useAuth } from "../lib/AuthContext";
import { colors } from "../lib/theme";

export default function LoginScreen() {
  const { login, register } = useAuth();
  const [mode, setMode] = useState<"login" | "register">("login");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit() {
    if (!username.trim() || !password || busy) return;
    setBusy(true);
    setError(null);
    try {
      if (mode === "login") await login(username.trim(), password);
      else await register(username.trim(), password);
    } catch (e) {
      setError(String(e).replace(/^Error:\s*/, ""));
    } finally {
      setBusy(false);
    }
  }

  return (
    <View style={styles.root}>
      <LinearGradient colors={["#1a1030", "#0b0e14", "#0b0e14"]} style={StyleSheet.absoluteFill} />
      <KeyboardAvoidingView style={styles.center} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <Glass style={styles.card} radius={26} intensity={55}>
          <View style={styles.inner}>
            <Text style={styles.brand}>⬡ Waise Code</Text>
            <Text style={styles.sub}>{mode === "login" ? "Inicia sesión para continuar" : "Crea tu cuenta"}</Text>

            <TextInput
              style={styles.input}
              placeholder="Usuario"
              placeholderTextColor={colors.faint}
              autoCapitalize="none"
              value={username}
              onChangeText={setUsername}
            />
            <TextInput
              style={styles.input}
              placeholder="Contraseña"
              placeholderTextColor={colors.faint}
              secureTextEntry
              value={password}
              onChangeText={setPassword}
            />

            {error && <Text style={styles.error}>{error}</Text>}

            <TouchableOpacity style={styles.button} onPress={submit} disabled={busy} activeOpacity={0.85}>
              {busy ? <ActivityIndicator color="#241a05" /> : <Text style={styles.buttonText}>{mode === "login" ? "Entrar" : "Crear cuenta"}</Text>}
            </TouchableOpacity>

            <TouchableOpacity onPress={() => { setMode(mode === "login" ? "register" : "login"); setError(null); }}>
              <Text style={styles.switch}>
                {mode === "login" ? "¿No tienes cuenta? Regístrate" : "¿Ya tienes cuenta? Inicia sesión"}
              </Text>
            </TouchableOpacity>
          </View>
        </Glass>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  center: { flex: 1, alignItems: "center", justifyContent: "center", padding: 20 },
  card: { width: "100%", maxWidth: 380 },
  inner: { padding: 26 },
  brand: { fontSize: 28, fontWeight: "800", color: "#ffc55c", textAlign: "center", marginBottom: 4, letterSpacing: -0.5 },
  sub: { color: colors.dim, textAlign: "center", marginBottom: 22, fontSize: 13.5 },
  input: { backgroundColor: "rgba(0,0,0,0.35)", borderWidth: 1, borderColor: colors.strokeSoft, borderRadius: 14, padding: 14, color: colors.text, marginBottom: 10, fontSize: 15.5 },
  error: { color: "#ff98a1", fontSize: 12.5, marginBottom: 8, textAlign: "center" },
  button: { backgroundColor: "#ffc55c", borderRadius: 14, padding: 15, alignItems: "center", marginTop: 8, shadowColor: "#ffc55c", shadowOpacity: 0.3, shadowRadius: 12, shadowOffset: { width: 0, height: 4 } },
  buttonText: { color: "#241a05", fontWeight: "800", fontSize: 15.5 },
  switch: { color: colors.dim, textAlign: "center", marginTop: 18, fontSize: 12.5 },
});
