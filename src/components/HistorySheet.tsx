import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import { deleteSession, listSessions } from "../lib/api";
import type { Session } from "../lib/types";
import { colors } from "../lib/theme";
import Glass from "./Glass";

interface Props {
  open: boolean;
  accentColor: string;
  currentId: string | null;
  onClose: () => void;
  onSelect: (s: Session) => void;
  onNew: () => void;
}

function timeAgo(iso: string): string {
  const d = new Date(iso).getTime();
  if (!d) return "";
  const mins = Math.max(0, Math.round((Date.now() - d) / 60000));
  if (mins < 1) return "ahora";
  if (mins < 60) return `hace ${mins} min`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `hace ${hours} h`;
  const days = Math.round(hours / 24);
  if (days < 7) return `hace ${days} d`;
  return new Date(iso).toLocaleDateString();
}

export default function HistorySheet({ open, accentColor, currentId, onClose, onSelect, onNew }: Props) {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    listSessions()
      .then((list) =>
        setSessions(
          [...list].sort((a, b) => (b.updated_at || "").localeCompare(a.updated_at || "")),
        ),
      )
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [open]);

  function remove(id: string) {
    setSessions((prev) => prev.filter((s) => s.id !== id));
    deleteSession(id).catch(() => {});
  }

  return (
    <Modal visible={open} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose} />
      <View style={styles.sheetWrap}>
        <Glass radius={26} intensity={60} style={styles.sheet}>
          <View style={styles.inner}>
            <View style={styles.handle} />
            <View style={styles.headRow}>
              <Text style={styles.title}>Historial</Text>
              <TouchableOpacity style={[styles.newBtn, { backgroundColor: accentColor }]} onPress={onNew}>
                <Ionicons name="add" size={16} color="#10131a" />
                <Text style={styles.newBtnText}>Nuevo chat</Text>
              </TouchableOpacity>
            </View>
            {loading ? (
              <ActivityIndicator color={accentColor} style={{ marginTop: 40 }} />
            ) : (
              <FlatList
                data={sessions}
                keyExtractor={(s) => s.id}
                contentContainerStyle={{ paddingBottom: 30, gap: 8 }}
                ListEmptyComponent={<Text style={styles.empty}>Sin conversaciones guardadas.</Text>}
                renderItem={({ item }) => (
                  <TouchableOpacity
                    activeOpacity={0.75}
                    onPress={() => onSelect(item)}
                    style={[styles.row, item.id === currentId && { borderColor: accentColor }]}
                  >
                    <View style={{ flex: 1 }}>
                      <Text style={styles.rowTitle} numberOfLines={1}>
                        {item.title || "Sin título"}
                      </Text>
                      <Text style={styles.rowMeta}>
                        {timeAgo(item.updated_at)} · {item.messages?.length ?? 0} mensajes
                      </Text>
                    </View>
                    <TouchableOpacity hitSlop={10} onPress={() => remove(item.id)}>
                      <Ionicons name="trash-outline" size={17} color={colors.faint} />
                    </TouchableOpacity>
                  </TouchableOpacity>
                )}
              />
            )}
          </View>
        </Glass>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { position: "absolute", top: 0, left: 0, right: 0, bottom: 0, backgroundColor: "rgba(0,0,0,0.55)" },
  sheetWrap: { position: "absolute", left: 10, right: 10, bottom: 10, height: "72%" },
  sheet: { flex: 1 },
  inner: { flex: 1, padding: 18, paddingTop: 10 },
  handle: { alignSelf: "center", width: 42, height: 5, borderRadius: 3, backgroundColor: "rgba(255,255,255,0.25)", marginBottom: 12 },
  headRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 14 },
  title: { color: colors.text, fontSize: 20, fontWeight: "800", letterSpacing: -0.4 },
  newBtn: { flexDirection: "row", alignItems: "center", gap: 4, borderRadius: 20, paddingHorizontal: 13, paddingVertical: 8 },
  newBtnText: { color: "#10131a", fontWeight: "800", fontSize: 13 },
  empty: { color: colors.faint, textAlign: "center", marginTop: 40, fontSize: 13 },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: colors.surface2,
    borderWidth: 1,
    borderColor: colors.strokeSoft,
    borderRadius: 14,
    padding: 13,
  },
  rowTitle: { color: colors.text, fontWeight: "700", fontSize: 14 },
  rowMeta: { color: colors.faint, fontSize: 11.5, marginTop: 3 },
});
