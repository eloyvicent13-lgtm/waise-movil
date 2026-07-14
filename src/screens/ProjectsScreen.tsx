import { useCallback, useState } from "react";
import { useFocusEffect, useNavigation } from "@react-navigation/native";
import { FlatList, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { createProject, listProjects } from "../lib/api";
import type { Project } from "../lib/types";
import type { RootStackParamList } from "../navigation";
import { usePrefs } from "../lib/prefs";
import { ACCENTS, colors } from "../lib/theme";
import Glass from "../components/Glass";

export default function ProjectsScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { prefs } = usePrefs();
  const accent = ACCENTS[prefs.accent];
  const [projects, setProjects] = useState<Project[]>([]);
  const [name, setName] = useState("");

  const refresh = useCallback(() => {
    listProjects().then(setProjects).catch(() => {});
  }, []);
  useFocusEffect(refresh);

  async function create() {
    if (!name.trim()) return;
    const p = await createProject(name.trim());
    setName("");
    setProjects((prev) => [p, ...prev]);
  }

  return (
    <View style={styles.root}>
      <Glass style={styles.newCard} radius={16} intensity={35}>
        <View style={styles.newRow}>
          <TextInput
            style={styles.input}
            placeholder="Nombre del proyecto"
            placeholderTextColor={colors.faint}
            value={name}
            onChangeText={setName}
          />
          <TouchableOpacity style={[styles.newBtn, { backgroundColor: accent.color }]} onPress={create}>
            <Text style={[styles.newBtnText, { color: accent.ink }]}>Crear</Text>
          </TouchableOpacity>
        </View>
      </Glass>

      <FlatList
        data={projects}
        keyExtractor={(p) => p.id}
        contentContainerStyle={{ padding: 16, paddingTop: 4, gap: 10, paddingBottom: 150 }}
        ListEmptyComponent={<Text style={styles.empty}>Sin proyectos todavía.</Text>}
        renderItem={({ item }) => (
          <TouchableOpacity activeOpacity={0.8} onPress={() => navigation.navigate("ProjectDetail", { project: item })}>
            <Glass radius={14} intensity={30}>
              <View style={styles.card}>
                <Text style={styles.cardTitle}>{item.name}</Text>
                <Text style={styles.cardMeta}>{item.members.length} miembros · {item.members.join(", ")}</Text>
              </View>
            </Glass>
          </TouchableOpacity>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  newCard: { margin: 16, marginBottom: 8 },
  newRow: { flexDirection: "row", gap: 8, padding: 10 },
  input: { flex: 1, backgroundColor: "rgba(0,0,0,0.3)", borderWidth: 1, borderColor: colors.strokeSoft, borderRadius: 10, padding: 11, color: colors.text },
  newBtn: { borderRadius: 10, paddingHorizontal: 16, justifyContent: "center" },
  newBtnText: { fontWeight: "800" },
  empty: { color: colors.faint, textAlign: "center", marginTop: 30 },
  card: { padding: 15 },
  cardTitle: { color: colors.text, fontSize: 15.5, fontWeight: "700" },
  cardMeta: { color: colors.dim, fontSize: 12, marginTop: 4 },
});
