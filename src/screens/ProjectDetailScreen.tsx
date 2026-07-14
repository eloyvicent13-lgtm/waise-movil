import { useEffect, useRef, useState } from "react";
import { FlatList, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { SERVER_URL, getToken } from "../lib/auth";
import {
  inviteToProject,
  listProjectFiles,
  listProjectMessages,
  readProjectFile,
  writeProjectFile,
} from "../lib/api";
import type { ProjectFileEntry, ProjectMessage } from "../lib/types";
import type { RootStackParamList } from "../navigation";
import { usePrefs } from "../lib/prefs";
import { ACCENTS, colors } from "../lib/theme";
import Glass from "../components/Glass";

type Props = NativeStackScreenProps<RootStackParamList, "ProjectDetail">;

export default function ProjectDetailScreen({ route }: Props) {
  const { project } = route.params;
  const { prefs } = usePrefs();
  const accent = ACCENTS[prefs.accent];
  const [tab, setTab] = useState<"files" | "chat">("chat");
  const [entries, setEntries] = useState<ProjectFileEntry[]>([]);
  const [activePath, setActivePath] = useState<string | null>(null);
  const [content, setContent] = useState("");
  const [messages, setMessages] = useState<ProjectMessage[]>([]);
  const [chatText, setChatText] = useState("");
  const [inviteUser, setInviteUser] = useState("");
  const wsRef = useRef<WebSocket | null>(null);

  useEffect(() => {
    listProjectFiles(project.id, "").then(setEntries).catch(() => {});
    listProjectMessages(project.id).then(setMessages).catch(() => {});

    let ws: WebSocket | null = null;
    getToken().then((token) => {
      if (!token) return;
      const url = `${SERVER_URL.replace(/^http/, "ws")}/ws?token=${encodeURIComponent(token)}&project=${project.id}`;
      ws = new WebSocket(url);
      wsRef.current = ws;
      ws.onmessage = (e) => {
        try {
          const msg = JSON.parse(e.data);
          if (msg.type === "chat") setMessages((prev) => [...prev, msg.message]);
        } catch { /* ignore */ }
      };
    });
    return () => ws?.close();
  }, [project.id]);

  function sendChat() {
    const t = chatText.trim();
    if (!t || !wsRef.current) return;
    wsRef.current.send(JSON.stringify({ type: "chat", text: t }));
    setChatText("");
  }

  async function openFile(path: string) {
    setActivePath(path);
    const { content: c } = await readProjectFile(project.id, path);
    setContent(c);
  }
  async function save() {
    if (!activePath) return;
    await writeProjectFile(project.id, activePath, content);
  }
  async function invite() {
    if (!inviteUser.trim()) return;
    await inviteToProject(project.id, inviteUser.trim());
    setInviteUser("");
  }

  return (
    <View style={styles.root}>
      <View style={styles.tabs}>
        <TouchableOpacity onPress={() => setTab("chat")} style={[styles.tab, tab === "chat" && { borderBottomColor: accent.color }]}>
          <Text style={styles.tabText}>Chat equipo</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => setTab("files")} style={[styles.tab, tab === "files" && { borderBottomColor: accent.color }]}>
          <Text style={styles.tabText}>Archivos</Text>
        </TouchableOpacity>
      </View>

      {tab === "chat" ? (
        <>
          <View style={styles.inviteRow}>
            <TextInput
              style={styles.inviteInput}
              placeholder="invitar usuario…"
              placeholderTextColor={colors.faint}
              value={inviteUser}
              onChangeText={setInviteUser}
            />
            <TouchableOpacity onPress={invite} style={styles.inviteBtn}>
              <Text style={styles.inviteBtnText}>Invitar</Text>
            </TouchableOpacity>
          </View>
          <FlatList
            data={messages}
            keyExtractor={(m) => m.id}
            contentContainerStyle={{ padding: 14, gap: 10 }}
            renderItem={({ item }) => (
              <View style={styles.msg}>
                <Text style={[styles.msgFrom, { color: accent.color }]}>{item.from}</Text>
                <Text style={styles.msgText}>{item.text}</Text>
              </View>
            )}
          />
          <Glass style={styles.composerWrap} radius={20} intensity={40}>
            <View style={styles.composer}>
              <TextInput
                style={styles.input}
                placeholder="Escribe…"
                placeholderTextColor={colors.faint}
                value={chatText}
                onChangeText={setChatText}
              />
              <TouchableOpacity style={[styles.sendBtn, { backgroundColor: accent.color }]} onPress={sendChat}>
                <Text style={[styles.sendIcon, { color: accent.ink }]}>↵</Text>
              </TouchableOpacity>
            </View>
          </Glass>
        </>
      ) : activePath ? (
        <View style={{ flex: 1 }}>
          <View style={styles.fileBar}>
            <TouchableOpacity onPress={() => setActivePath(null)}><Text style={styles.back}>‹ Volver</Text></TouchableOpacity>
            <Text style={styles.filePath} numberOfLines={1}>{activePath}</Text>
            <TouchableOpacity onPress={save}><Text style={[styles.save, { color: accent.color }]}>Guardar</Text></TouchableOpacity>
          </View>
          <TextInput
            style={styles.editor}
            value={content}
            onChangeText={setContent}
            multiline
            autoCapitalize="none"
            autoCorrect={false}
          />
        </View>
      ) : (
        <FlatList
          data={entries}
          keyExtractor={(e) => e.path}
          contentContainerStyle={{ padding: 14, gap: 6 }}
          ListEmptyComponent={<Text style={styles.empty}>Sin archivos todavía.</Text>}
          renderItem={({ item }) => (
            <TouchableOpacity style={styles.fileRow} onPress={() => !item.is_dir && openFile(item.path)}>
              <Text style={styles.fileName}>{item.is_dir ? "📁" : "📄"} {item.name}</Text>
            </TouchableOpacity>
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  tabs: { flexDirection: "row", borderBottomWidth: 1, borderBottomColor: colors.strokeSoft },
  tab: { flex: 1, padding: 12, alignItems: "center", borderBottomWidth: 2, borderBottomColor: "transparent" },
  tabText: { color: colors.text, fontSize: 13, fontWeight: "700" },
  inviteRow: { flexDirection: "row", gap: 8, padding: 10, borderBottomWidth: 1, borderBottomColor: colors.strokeSoft },
  inviteInput: { flex: 1, backgroundColor: colors.surface2, borderWidth: 1, borderColor: colors.strokeSoft, borderRadius: 9, padding: 9, color: colors.text, fontSize: 12.5 },
  inviteBtn: { backgroundColor: colors.surface3, borderRadius: 9, paddingHorizontal: 12, justifyContent: "center" },
  inviteBtnText: { color: colors.text, fontSize: 12.5 },
  msg: { backgroundColor: colors.surface2, borderRadius: 12, padding: 11, borderWidth: 1, borderColor: colors.strokeSoft },
  msgFrom: { fontSize: 10.5, fontWeight: "800", marginBottom: 2 },
  msgText: { color: colors.text, fontSize: 13.5 },
  composerWrap: { margin: 10 },
  composer: { flexDirection: "row", gap: 8, padding: 8 },
  input: { flex: 1, color: colors.text, paddingHorizontal: 10, paddingVertical: 10 },
  sendBtn: { width: 40, height: 40, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  sendIcon: { fontWeight: "800" },
  empty: { color: colors.faint, textAlign: "center", marginTop: 30 },
  fileRow: { padding: 11, backgroundColor: colors.surface2, borderRadius: 10, borderWidth: 1, borderColor: colors.strokeSoft },
  fileName: { color: colors.text, fontSize: 13.5 },
  fileBar: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", padding: 10, borderBottomWidth: 1, borderBottomColor: colors.strokeSoft },
  back: { color: colors.dim, fontSize: 13 },
  filePath: { color: colors.dim, fontSize: 11, flex: 1, textAlign: "center" },
  save: { fontSize: 13, fontWeight: "800" },
  editor: { flex: 1, color: colors.text, fontFamily: "monospace", fontSize: 12.5, padding: 12, textAlignVertical: "top" },
});
