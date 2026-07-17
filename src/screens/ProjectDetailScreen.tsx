import { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import * as DocumentPicker from "expo-document-picker";
import { SERVER_URL, getToken } from "../lib/auth";
import {
  chat,
  exportProjectZip,
  getProjectAiChat,
  inviteToProject,
  listProjectAiChats,
  listProjectFiles,
  listProjectMessages,
  readProjectFile,
  saveProjectAiChat,
  uploadProjectFile,
  writeProjectFile,
} from "../lib/api";
import { describeProjectAction, executeProjectAction, isTruncatedAction, parseProjectAction, projectNeedsApproval, projectSystemPrompt, visibleText } from "../lib/projectAgent";
import type { ChatMessage, ProjectFileEntry, ProjectMessage, UiMessage } from "../lib/types";
import type { RootStackParamList } from "../navigation";
import { usePrefs } from "../lib/prefs";
import { ACCENTS, colors } from "../lib/theme";
import Glass from "../components/Glass";

type Props = NativeStackScreenProps<RootStackParamList, "ProjectDetail">;
const uid = () => Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2, 6);
const MAX_STEPS = 25;

function toChatMessages(msgs: UiMessage[]): ChatMessage[] {
  return msgs
    .filter((m) => !m.streaming)
    .map((m) => ({
      role: m.role === "tool" ? "user" : (m.role as "user" | "assistant"),
      content: m.role === "assistant" ? m.raw ?? m.content : m.content,
    }));
}

export default function ProjectDetailScreen({ route }: Props) {
  const { project } = route.params;
  const { prefs } = usePrefs();
  const accent = ACCENTS[prefs.accent];
  const [tab, setTab] = useState<"waise" | "chat" | "files">("waise");

  // ---- files ----
  const [entries, setEntries] = useState<ProjectFileEntry[]>([]);
  const [currentDir, setCurrentDir] = useState("");
  const [activePath, setActivePath] = useState<string | null>(null);
  const [content, setContent] = useState("");
  const [uploading, setUploading] = useState(false);

  // ---- team chat ----
  const [messages, setMessages] = useState<ProjectMessage[]>([]);
  const [chatText, setChatText] = useState("");
  const [inviteUser, setInviteUser] = useState("");
  const wsRef = useRef<WebSocket | null>(null);

  // ---- waise (AI) chat ----
  const [waiseMessages, setWaiseMessages] = useState<UiMessage[]>([]);
  const [waiseBusy, setWaiseBusy] = useState(false);
  const [waiseInput, setWaiseInput] = useState("");
  const [autoApprove, setAutoApprove] = useState(false);
  const waiseMsgsRef = useRef<UiMessage[]>([]);
  const chatIdRef = useRef(uid());
  const chatTitleRef = useRef("Nuevo chat");
  const approvals = useRef<Map<string, (b: boolean) => void>>(new Map());

  useEffect(() => { waiseMsgsRef.current = waiseMessages; }, [waiseMessages]);

  useEffect(() => {
    listProjectFiles(project.id, currentDir).then(setEntries).catch(() => {});
  }, [project.id, currentDir]);

  useEffect(() => {
    listProjectMessages(project.id).then(setMessages).catch(() => {});
    listProjectAiChats(project.id)
      .then((chats) => {
        if (chats.length) return getProjectAiChat(project.id, chats[0].id);
        return null;
      })
      .then((c) => {
        if (!c) return;
        chatIdRef.current = c.id;
        chatTitleRef.current = c.title;
        setWaiseMessages(
          c.messages
            .filter((m) => m.role !== "system")
            .map((m) => ({ id: uid(), role: m.role as "user" | "assistant", content: typeof m.content === "string" ? m.content : "" })),
        );
      })
      .catch(() => {});

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
          else if (msg.type === "file_changed") listProjectFiles(project.id, currentDir).then(setEntries).catch(() => {});
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

  async function pickAndUpload() {
    const res = await DocumentPicker.getDocumentAsync({ multiple: true, copyToCacheDirectory: true });
    if (res.canceled || !res.assets?.length) return;
    setUploading(true);
    try {
      for (const asset of res.assets) {
        await uploadProjectFile(project.id, currentDir, asset.uri, asset.name, asset.mimeType || "application/octet-stream");
      }
      listProjectFiles(project.id, currentDir).then(setEntries).catch(() => {});
    } catch (e) {
      alert(String(e));
    } finally {
      setUploading(false);
    }
  }

  async function downloadZip() {
    try {
      await exportProjectZip(project.id, project.name);
      alert("Proyecto exportado. Búscalo en Archivos del sistema, carpeta de la app.");
    } catch (e) {
      alert(String(e));
    }
  }

  function addWaise(m: UiMessage) {
    setWaiseMessages((p) => [...p, m]);
  }
  function patchWaise(id: string, patch: Partial<UiMessage>) {
    setWaiseMessages((p) => p.map((m) => (m.id === id ? { ...m, ...patch } : m)));
  }
  function persistWaise(msgs: UiMessage[]) {
    const firstUser = msgs.find((m) => m.role === "user");
    const title = firstUser ? firstUser.content.slice(0, 48) || "Nuevo chat" : "Nuevo chat";
    chatTitleRef.current = title;
    saveProjectAiChat(project.id, chatIdRef.current, title, toChatMessages(msgs)).catch(() => {});
  }
  function waitApproval(id: string): Promise<boolean> {
    return new Promise((resolve) => approvals.current.set(id, resolve));
  }

  async function askWaise(text: string) {
    if (waiseBusy) return;
    setWaiseBusy(true);
    const history = toChatMessages(waiseMsgsRef.current);
    addWaise({ id: uid(), role: "user", content: text });
    history.push({ role: "user", content: text });
    const sys = projectSystemPrompt(project.name, prefs.display_name);

    try {
      for (let step = 0; step < MAX_STEPS; step++) {
        let full = "";
        try {
          const r = await chat("lumin-vera-3", [{ role: "system", content: sys }, ...history]);
          full = r.choices?.[0]?.message?.content ?? "";
        } catch (e) {
          addWaise({ id: uid(), role: "assistant", content: `⚠ Error: ${String(e)}` });
          break;
        }
        history.push({ role: "assistant", content: full });
        const action = parseProjectAction(full);
        const truncated = !action && isTruncatedAction(full);
        const asstId = uid();
        addWaise({
          id: asstId,
          role: "assistant",
          content: truncated
            ? `${visibleText(full)}\n\n⚠ Respuesta cortada (demasiado contenido de una vez). Pidiéndole que la complete…`
            : visibleText(full),
          raw: full,
          action: action ?? undefined,
          actionStatus: action ? (projectNeedsApproval(action.tool) && !autoApprove ? "pending" : "auto") : undefined,
        });
        if (truncated) {
          history.push({
            role: "user",
            content:
              "[sistema] Tu respuesta anterior se cortó a mitad de un bloque waise-action (probablemente por generar demasiado contenido de una vez). Repite la MISMA acción completa desde el principio; si es un archivo largo, divídelo en varias acciones write_file/edit_file más pequeñas en vez de un único bloque enorme.",
          });
          continue;
        }
        if (!action) {
          const next = [...waiseMsgsRef.current, { id: asstId, role: "assistant" as const, content: visibleText(full), raw: full }];
          persistWaise(next);
          break;
        }

        let approved = true;
        if (projectNeedsApproval(action.tool) && !autoApprove) approved = await waitApproval(asstId);
        if (!approved) {
          patchWaise(asstId, { actionStatus: "denied" });
          const c = `[tool_result:${action.tool}] Usuario rechazó la acción.`;
          addWaise({ id: uid(), role: "tool", content: c });
          history.push({ role: "user", content: c });
          continue;
        }

        patchWaise(asstId, { actionStatus: "approved" });
        let result = "";
        try {
          result = await executeProjectAction(project.id, action);
          patchWaise(asstId, { actionStatus: "done", actionResult: result });
          listProjectFiles(project.id, currentDir).then(setEntries).catch(() => {});
        } catch (e) {
          result = `ERROR: ${String(e)}`;
          patchWaise(asstId, { actionStatus: "error", actionResult: result });
        }
        const c = `[tool_result:${action.tool}] ${result}`;
        addWaise({ id: uid(), role: "tool", content: c });
        history.push({ role: "user", content: c });
        persistWaise(waiseMsgsRef.current);
      }
    } finally {
      setWaiseBusy(false);
    }
  }

  const fs = 14.5;

  return (
    <View style={styles.root}>
      <View style={styles.tabs}>
        <TouchableOpacity onPress={() => setTab("waise")} style={[styles.tab, tab === "waise" && { borderBottomColor: accent.color }]}>
          <Text style={styles.tabText}>Waise</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => setTab("chat")} style={[styles.tab, tab === "chat" && { borderBottomColor: accent.color }]}>
          <Text style={styles.tabText}>Chat equipo</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => setTab("files")} style={[styles.tab, tab === "files" && { borderBottomColor: accent.color }]}>
          <Text style={styles.tabText}>Archivos</Text>
        </TouchableOpacity>
      </View>

      {tab === "waise" ? (
        <>
          <View style={styles.waiseToolbar}>
            <Text style={styles.toolbarLabel}>Auto-aprobar</Text>
            <Switch value={autoApprove} onValueChange={setAutoApprove} trackColor={{ true: accent.color }} />
          </View>
          <FlatList
            data={waiseMessages}
            keyExtractor={(m) => m.id}
            contentContainerStyle={{ padding: 14, gap: 10 }}
            ListEmptyComponent={<Text style={styles.empty}>Pídele a Waise que revise o edite archivos de este proyecto.</Text>}
            renderItem={({ item }) => (
              <View style={[styles.msg, item.role === "user" && styles.msgUser, item.role === "tool" && styles.msgTool]}>
                <Text style={[styles.msgFrom, item.role === "assistant" && { color: accent.color }]}>
                  {item.role === "user" ? "Tú" : item.role === "tool" ? "resultado" : "Waise"}
                </Text>
                {!!item.content && <Text style={[styles.msgText, { fontSize: fs }]}>{item.content}</Text>}
                {item.action && (
                  <View style={styles.actionCard}>
                    <Text style={styles.actionDesc}>{describeProjectAction(item.action)}</Text>
                    {item.actionStatus === "pending" && (
                      <View style={styles.actionBtns}>
                        <TouchableOpacity
                          style={[styles.actionBtn, { backgroundColor: accent.color }]}
                          onPress={() => { approvals.current.get(item.id)?.(true); approvals.current.delete(item.id); }}
                        >
                          <Text style={[styles.actionBtnText, { color: accent.ink }]}>Aprobar</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={styles.actionBtnGhost}
                          onPress={() => { approvals.current.get(item.id)?.(false); approvals.current.delete(item.id); }}
                        >
                          <Text style={styles.actionBtnGhostText}>Rechazar</Text>
                        </TouchableOpacity>
                      </View>
                    )}
                    {item.actionStatus && item.actionStatus !== "pending" && (
                      <Text style={styles.actionStatus}>
                        {{ auto: "automático", approved: "aprobado…", done: "✓ hecho", denied: "✕ rechazado", error: "⚠ error" }[item.actionStatus]}
                      </Text>
                    )}
                  </View>
                )}
              </View>
            )}
          />
          <Glass style={styles.composerWrap} radius={20} intensity={40}>
            <View style={styles.composer}>
              <TextInput
                style={styles.input}
                placeholder={waiseBusy ? "Waise está trabajando…" : "Pregunta o pide una tarea…"}
                placeholderTextColor={colors.faint}
                value={waiseInput}
                editable={!waiseBusy}
                onChangeText={setWaiseInput}
              />
              <TouchableOpacity
                style={[styles.sendBtn, { backgroundColor: accent.color }, waiseBusy && { opacity: 0.5 }]}
                disabled={waiseBusy || !waiseInput.trim()}
                onPress={() => { askWaise(waiseInput.trim()); setWaiseInput(""); }}
              >
                {waiseBusy ? <ActivityIndicator size="small" color={accent.ink} /> : <Text style={[styles.sendIcon, { color: accent.ink }]}>↵</Text>}
              </TouchableOpacity>
            </View>
          </Glass>
        </>
      ) : tab === "chat" ? (
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
        <>
          <View style={styles.fileActions}>
            <TouchableOpacity style={styles.fileActionBtn} onPress={pickAndUpload} disabled={uploading}>
              <Text style={styles.fileActionText}>{uploading ? "Subiendo…" : "⬆ Subir"}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.fileActionBtn} onPress={downloadZip}>
              <Text style={styles.fileActionText}>⬇ ZIP</Text>
            </TouchableOpacity>
          </View>
          <View style={styles.breadcrumb}>
            <Text style={styles.crumb} onPress={() => setCurrentDir("")}>raíz</Text>
            {currentDir.split("/").filter(Boolean).map((part, i, arr) => (
              <Text key={i} style={styles.crumb} onPress={() => setCurrentDir(arr.slice(0, i + 1).join("/"))}>
                {" / "}{part}
              </Text>
            ))}
          </View>
          <FlatList
            data={entries}
            keyExtractor={(e) => e.path}
            contentContainerStyle={{ padding: 14, gap: 6 }}
            ListEmptyComponent={<Text style={styles.empty}>Sin archivos todavía.</Text>}
            renderItem={({ item }) => (
              <TouchableOpacity style={styles.fileRow} onPress={() => (item.is_dir ? setCurrentDir(item.path) : openFile(item.path))}>
                <Text style={styles.fileName}>{item.is_dir ? "📁" : "📄"} {item.name}</Text>
              </TouchableOpacity>
            )}
          />
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  tabs: { flexDirection: "row", borderBottomWidth: 1, borderBottomColor: colors.strokeSoft },
  tab: { flex: 1, padding: 12, alignItems: "center", borderBottomWidth: 2, borderBottomColor: "transparent" },
  tabText: { color: colors.text, fontSize: 13, fontWeight: "700" },
  waiseToolbar: { flexDirection: "row", alignItems: "center", justifyContent: "flex-end", gap: 8, padding: 10, borderBottomWidth: 1, borderBottomColor: colors.strokeSoft },
  toolbarLabel: { color: colors.dim, fontSize: 12.5, fontWeight: "600" },
  inviteRow: { flexDirection: "row", gap: 8, padding: 10, borderBottomWidth: 1, borderBottomColor: colors.strokeSoft },
  inviteInput: { flex: 1, backgroundColor: colors.surface2, borderWidth: 1, borderColor: colors.strokeSoft, borderRadius: 9, padding: 9, color: colors.text, fontSize: 12.5 },
  inviteBtn: { backgroundColor: colors.surface3, borderRadius: 9, paddingHorizontal: 12, justifyContent: "center" },
  inviteBtnText: { color: colors.text, fontSize: 12.5 },
  msg: { backgroundColor: colors.surface2, borderRadius: 12, padding: 11, borderWidth: 1, borderColor: colors.strokeSoft, maxWidth: "92%" },
  msgUser: { alignSelf: "flex-end", backgroundColor: colors.surface3 },
  msgTool: { opacity: 0.8 },
  msgFrom: { fontSize: 10.5, fontWeight: "800", marginBottom: 2, color: colors.faint, textTransform: "uppercase" },
  msgText: { color: colors.text, fontSize: 13.5, lineHeight: 20 },
  actionCard: { marginTop: 8, backgroundColor: "rgba(0,0,0,0.25)", borderRadius: 10, padding: 10 },
  actionDesc: { color: colors.text, fontSize: 12.5, fontWeight: "700" },
  actionBtns: { flexDirection: "row", gap: 8, marginTop: 8 },
  actionBtn: { flex: 1, borderRadius: 8, paddingVertical: 8, alignItems: "center" },
  actionBtnText: { fontWeight: "800", fontSize: 12.5 },
  actionBtnGhost: { flex: 1, borderRadius: 8, paddingVertical: 8, alignItems: "center", borderWidth: 1, borderColor: colors.strokeSoft },
  actionBtnGhostText: { color: colors.dim, fontWeight: "700", fontSize: 12.5 },
  actionStatus: { color: colors.dim, fontSize: 11.5, marginTop: 6 },
  composerWrap: { margin: 10 },
  composer: { flexDirection: "row", gap: 8, padding: 8 },
  input: { flex: 1, color: colors.text, paddingHorizontal: 10, paddingVertical: 10 },
  sendBtn: { width: 40, height: 40, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  sendIcon: { fontWeight: "800" },
  empty: { color: colors.faint, textAlign: "center", marginTop: 30 },
  fileActions: { flexDirection: "row", gap: 8, padding: 10, paddingBottom: 0 },
  fileActionBtn: { flex: 1, backgroundColor: colors.surface2, borderWidth: 1, borderColor: colors.strokeSoft, borderRadius: 10, paddingVertical: 9, alignItems: "center" },
  fileActionText: { color: colors.text, fontSize: 12.5, fontWeight: "700" },
  breadcrumb: { paddingHorizontal: 14, paddingTop: 10, paddingBottom: 2 },
  crumb: { color: colors.faint, fontSize: 11.5 },
  fileRow: { padding: 11, backgroundColor: colors.surface2, borderRadius: 10, borderWidth: 1, borderColor: colors.strokeSoft },
  fileName: { color: colors.text, fontSize: 13.5 },
  fileBar: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", padding: 10, borderBottomWidth: 1, borderBottomColor: colors.strokeSoft },
  back: { color: colors.dim, fontSize: 13 },
  filePath: { color: colors.dim, fontSize: 11, flex: 1, textAlign: "center" },
  save: { fontSize: 13, fontWeight: "800" },
  editor: { flex: 1, color: colors.text, fontFamily: "monospace", fontSize: 12.5, padding: 12, textAlignVertical: "top" },
});
