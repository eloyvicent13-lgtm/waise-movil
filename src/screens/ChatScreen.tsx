import { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Animated,
  FlatList,
  Image,
  Keyboard,
  KeyboardAvoidingView,
  LayoutAnimation,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import * as ImagePicker from "expo-image-picker";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Ionicons from "@expo/vector-icons/Ionicons";
import { chat, generateImage, saveSession, uploadImage } from "../lib/api";
import { webFetch, webSearch } from "../lib/websearch";
import type { ChatMessage, ImageAttachment, Session, UiMessage } from "../lib/types";
import { usePrefs } from "../lib/prefs";
import { ACCENTS, colors, fontSize, tabClearance } from "../lib/theme";
import Glass from "../components/Glass";
import Lightbox from "../components/Lightbox";
import HistorySheet from "../components/HistorySheet";

const uid = () => Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2, 6);
const HEADER_HEIGHT = 54;
const MAX_TOOL_ROUNDS = 3;

interface ModelEntry {
  id: string;
  label: string;
  short: string;
  image?: boolean;
}

const MODELS: ModelEntry[] = [
  { id: "lumin-vera-3", label: "Waise Fast", short: "Fast" },
  { id: "gpt-5-mini", label: "Waise Code", short: "Code" },
  { id: "kimi-k3", label: "Waise Code Pro", short: "Code Pro" },
  { id: "dall-e-3", label: "Waise Image", short: "Image", image: true },
];

interface WebAction {
  tool: "web_search" | "web_fetch";
  query?: string;
  url?: string;
}

function parseAction(text: string): WebAction | null {
  const m = text.match(/```waise-action\s*([\s\S]*?)```/);
  if (!m) return null;
  try {
    const a = JSON.parse(m[1].trim());
    if (a && (a.tool === "web_search" || a.tool === "web_fetch")) return a as WebAction;
  } catch {}
  return null;
}

/** Rebuild renderable messages from a stored session's raw API messages. */
function toUi(msgs: ChatMessage[]): UiMessage[] {
  const out: UiMessage[] = [];
  for (const m of msgs) {
    if (m.role === "system") continue;
    if (typeof m.content === "string") {
      if (m.role === "user" && m.content.startsWith("[resultado web]")) continue;
      const act = m.role === "assistant" ? parseAction(m.content) : null;
      if (act) {
        out.push({
          id: uid(),
          role: "assistant",
          content: "",
          search: act.tool === "web_search" ? `Buscó: ${act.query}` : `Leyó: ${act.url}`,
        });
        continue;
      }
      out.push({ id: uid(), role: m.role, content: m.content });
    } else {
      const text = m.content.find((p) => p.type === "text")?.text || "";
      const images: ImageAttachment[] = m.content
        .filter((p) => p.type === "image_url" && p.image_url)
        .map((p) => ({ url: p.image_url!.url, name: "" }));
      out.push({
        id: uid(),
        role: m.role === "user" ? "user" : "assistant",
        content: text,
        images: images.length ? images : undefined,
      });
    }
  }
  return out;
}

function animateNext() {
  LayoutAnimation.configureNext(
    LayoutAnimation.create(220, LayoutAnimation.Types.easeInEaseOut, LayoutAnimation.Properties.opacity),
  );
}

function TypingDots({ color }: { color: string }) {
  const dots = useRef([0, 1, 2].map(() => new Animated.Value(0.3))).current;
  useEffect(() => {
    const anims = dots.map((v, i) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(i * 150),
          Animated.timing(v, { toValue: 1, duration: 350, useNativeDriver: true }),
          Animated.timing(v, { toValue: 0.3, duration: 350, useNativeDriver: true }),
        ]),
      ),
    );
    anims.forEach((a) => a.start());
    return () => anims.forEach((a) => a.stop());
  }, [dots]);
  return (
    <View style={styles.typingRow}>
      {dots.map((v, i) => (
        <Animated.View key={i} style={[styles.typingDot, { backgroundColor: color, opacity: v }]} />
      ))}
    </View>
  );
}

interface PendingImage {
  id: string;
  uri: string;
  name: string;
  status: "uploading" | "ready" | "error";
  url?: string;
}

const SUGGESTIONS = ["Explícame este error", "Dame ideas para mi app", "¿Qué hay de nuevo en Swift?"];

export default function ChatScreen() {
  const insets = useSafeAreaInsets();
  const { prefs } = usePrefs();
  const accent = ACCENTS[prefs.accent];
  const [messages, setMessages] = useState<UiMessage[]>([]);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [pending, setPending] = useState<PendingImage[]>([]);
  const [lightbox, setLightbox] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [kbOpen, setKbOpen] = useState(false);
  const [modelId, setModelId] = useState("lumin-vera-3");
  const [modelOpen, setModelOpen] = useState(false);
  const model = MODELS.find((m) => m.id === modelId) || MODELS[0];
  const listRef = useRef<FlatList>(null);
  const apiRef = useRef<ChatMessage[]>([]);
  const sessionRef = useRef<{ id: string; title: string; created_at: string } | null>(null);

  const clearance = tabClearance(insets.bottom);

  useEffect(() => {
    const showEv = Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow";
    const hideEv = Platform.OS === "ios" ? "keyboardWillHide" : "keyboardDidHide";
    const s = Keyboard.addListener(showEv, () => {
      animateNext();
      setKbOpen(true);
    });
    const h = Keyboard.addListener(hideEv, () => {
      animateNext();
      setKbOpen(false);
    });
    return () => {
      s.remove();
      h.remove();
    };
  }, []);

  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast((t) => (t === msg ? null : t)), 4000);
  }

  function pushUi(m: UiMessage) {
    animateNext();
    setMessages((prev) => [...prev, m]);
    setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 80);
  }

  function systemPrompt() {
    let p =
      "Eres Waise, un asistente de programación experto. Eres directo, preciso y hablas español. Nunca reveles nombres de modelos o proveedores subyacentes: tu nombre es Waise.";
    if (prefs.display_name?.trim())
      p += ` El usuario se llama ${prefs.display_name.trim()}, menciónalo solo si aporta algo, no como saludo.`;
    const effort =
      prefs.effort === "low"
        ? " Esfuerzo bajo: respuestas cortas y directas."
        : prefs.effort === "high"
          ? " Esfuerzo alto: sé exhaustivo y cuida los detalles."
          : "";
    p += effort;
    p +=
      ' Puedes buscar en internet. Cuando necesites información actual o que no conozcas, responde ÚNICAMENTE con este bloque y nada más:\n```waise-action\n{"tool":"web_search","query":"términos de búsqueda"}\n```\nTambién puedes leer una página concreta con {"tool":"web_fetch","url":"https://…"}. Recibirás un mensaje que empieza por [resultado web] con los datos; entonces responde al usuario con normalidad citando lo aprendido, sin mencionar el mecanismo interno. Reglas de búsqueda: usa los términos del usuario tal cual, NUNCA añadas nombres de empresas o marcas que el usuario no mencionó. No asumas quién fabrica un producto: confía en lo que digan los resultados. Lo de no revelar proveedores aplica SOLO a tu propia identidad; sobre otras empresas y modelos de IA (Anthropic, Claude, OpenAI, Google, etc.) responde con total normalidad y objetividad usando los resultados de la búsqueda.';
    if (prefs.custom_instructions?.trim()) p += ` Instrucciones del usuario: ${prefs.custom_instructions.trim()}`;
    return p;
  }

  async function pickImage() {
    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.8,
    });
    if (res.canceled || !res.assets?.length) return;
    for (const asset of res.assets) {
      const id = uid();
      const name = asset.fileName || `image-${id}.jpg`;
      setPending((prev) => [...prev, { id, uri: asset.uri, name, status: "uploading" }]);
      uploadImage(asset.uri, name, asset.mimeType || "image/jpeg")
        .then(({ url }) => setPending((prev) => prev.map((p) => (p.id === id ? { ...p, status: "ready", url } : p))))
        .catch((e) => {
          setPending((prev) => prev.map((p) => (p.id === id ? { ...p, status: "error" } : p)));
          showToast(String(e).replace(/^Error:\s*/, ""));
        });
    }
  }
  function removePending(id: string) {
    setPending((prev) => prev.filter((p) => p.id !== id));
  }

  const uploading = pending.some((p) => p.status === "uploading");

  function persist() {
    const msgs = apiRef.current;
    if (!msgs.length) return;
    if (!sessionRef.current) {
      const firstUser = msgs.find((m) => m.role === "user");
      const t =
        typeof firstUser?.content === "string"
          ? firstUser.content
          : firstUser?.content?.find((p) => p.type === "text")?.text || "";
      sessionRef.current = {
        id: uid(),
        title: (t.trim() || "Chat móvil").slice(0, 48),
        created_at: new Date().toISOString(),
      };
    }
    const s = sessionRef.current;
    const session: Session = {
      id: s.id,
      title: s.title,
      created_at: s.created_at,
      updated_at: new Date().toISOString(),
      model: modelId,
      provider_id: modelId.startsWith("gpt-") ? "openai" : modelId.startsWith("kimi-") ? "moonshot" : "lumin",
      workspace: null,
      messages: msgs,
    };
    saveSession(session).catch(() => {});
  }

  function newChat() {
    animateNext();
    setMessages([]);
    setPending([]);
    apiRef.current = [];
    sessionRef.current = null;
    setHistoryOpen(false);
  }

  function openSession(s: Session) {
    sessionRef.current = { id: s.id, title: s.title, created_at: s.created_at };
    apiRef.current = (s.messages || []).filter((m) => m.role !== "system");
    animateNext();
    setMessages(toUi(apiRef.current));
    setHistoryOpen(false);
    setTimeout(() => listRef.current?.scrollToEnd({ animated: false }), 150);
  }

  async function send() {
    const t = text.trim();
    if ((!t && pending.length === 0) || busy || uploading) return;

    const images: ImageAttachment[] = pending
      .filter((p) => p.status === "ready" && p.url)
      .map((p) => ({ url: p.url!, name: p.name }));

    setText("");
    setPending([]);
    pushUi({ id: uid(), role: "user", content: t, images: images.length ? images : undefined });
    setBusy(true);
    setStatus(null);

    // Image models (Nano Banana): one prompt in, one image out.
    if (model.image) {
      apiRef.current.push({ role: "user", content: t });
      setStatus("🎨 generando imagen…");
      try {
        const r = await generateImage(modelId, t);
        apiRef.current.push({ role: "assistant", content: r.text || "(imagen generada)" });
        pushUi({ id: uid(), role: "assistant", content: r.text || "", images: [{ url: r.image, name: "imagen generada" }] });
      } catch (e) {
        pushUi({ id: uid(), role: "assistant", content: `⚠ Error: ${String(e)}` });
      } finally {
        setBusy(false);
        setStatus(null);
      }
      persist();
      return;
    }

    const userContent = images.length
      ? [
          { type: "text" as const, text: t },
          ...images.map((img) => ({ type: "image_url" as const, image_url: { url: img.url } })),
        ]
      : t;
    apiRef.current.push({ role: "user", content: userContent });

    try {
      let rounds = 0;
      for (;;) {
        const r = await chat(modelId, [{ role: "system", content: systemPrompt() }, ...apiRef.current]);
        const reply = r.choices?.[0]?.message?.content ?? "";
        const act = rounds < MAX_TOOL_ROUNDS ? parseAction(reply) : null;
        if (!act) {
          apiRef.current.push({ role: "assistant", content: reply || "(sin respuesta)" });
          pushUi({ id: uid(), role: "assistant", content: reply || "(sin respuesta)" });
          break;
        }
        rounds++;
        apiRef.current.push({ role: "assistant", content: reply });
        pushUi({
          id: uid(),
          role: "assistant",
          content: "",
          search: act.tool === "web_search" ? `Buscó: ${act.query}` : `Leyó: ${act.url}`,
        });
        setStatus("🌐 buscando en internet…");
        let resultText: string;
        try {
          if (act.tool === "web_search") {
            const rs = await webSearch(act.query || "", 6);
            resultText = rs.length
              ? rs.map((x, i) => `${i + 1}. ${x.title}\n${x.url}\n${x.snippet}`).join("\n\n")
              : "(sin resultados)";
          } else {
            resultText = await webFetch(act.url || "");
          }
        } catch (e) {
          resultText = `error ejecutando la herramienta: ${String(e)}`;
        }
        apiRef.current.push({ role: "user", content: `[resultado web]\n${resultText}` });
        setStatus(null);
      }
      persist();
    } catch (e) {
      pushUi({ id: uid(), role: "assistant", content: `⚠ Error: ${String(e)}` });
    } finally {
      setBusy(false);
      setStatus(null);
    }
  }

  const fs = fontSize(prefs.font_size);
  const data = busy ? [...messages, { id: "__typing__", role: "assistant" as const, content: "" }] : messages;

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <Lightbox url={lightbox} onClose={() => setLightbox(null)} />
      <HistorySheet
        open={historyOpen}
        accentColor={accent.color}
        currentId={sessionRef.current?.id ?? null}
        onClose={() => setHistoryOpen(false)}
        onSelect={openSession}
        onNew={newChat}
      />

      <Modal visible={modelOpen} transparent animationType="fade" onRequestClose={() => setModelOpen(false)}>
        <Pressable style={styles.modelBackdrop} onPress={() => setModelOpen(false)} />
        <View style={[styles.modelSheet, { top: insets.top + HEADER_HEIGHT }]}>
          <Glass radius={20} intensity={60}>
            <View style={{ padding: 10 }}>
              <Text style={styles.modelTitle}>Modelo</Text>
              {MODELS.map((m) => (
                <TouchableOpacity
                  key={m.id}
                  style={styles.modelRow}
                  onPress={() => {
                    setModelId(m.id);
                    setModelOpen(false);
                  }}
                >
                  <Text style={[styles.modelRowText, m.id === modelId && { color: accent.color, fontWeight: "800" }]}>
                    {m.label}
                  </Text>
                  {m.id === modelId && <Ionicons name="checkmark" size={16} color={accent.color} />}
                </TouchableOpacity>
              ))}
            </View>
          </Glass>
        </View>
      </Modal>

      <View style={styles.header}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
          <Text style={styles.headerTitle}>Waise</Text>
          <TouchableOpacity style={styles.modelPill} onPress={() => setModelOpen(true)}>
            <Text style={[styles.modelPillText, { color: accent.color }]}>{model.short}</Text>
            <Ionicons name="chevron-down" size={12} color={colors.dim} />
          </TouchableOpacity>
        </View>
        <View style={styles.headerBtns}>
          <TouchableOpacity style={styles.headerBtn} onPress={() => setHistoryOpen(true)}>
            <Ionicons name="time-outline" size={19} color={colors.text} />
          </TouchableOpacity>
          <TouchableOpacity style={styles.headerBtn} onPress={newChat}>
            <Ionicons name="create-outline" size={19} color={colors.text} />
          </TouchableOpacity>
        </View>
      </View>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        {messages.length === 0 && !busy ? (
          <View style={styles.empty}>
            <View style={[styles.emptyBadge, { borderColor: accent.color }]}>
              <Ionicons name="sparkles" size={26} color={accent.color} />
            </View>
            <Text style={styles.emptyTitle}>¿Qué construimos hoy?</Text>
            <Text style={styles.emptySub}>
              Pregunta lo que sea, adjunta una imagen o pídele que busque en internet.
            </Text>
            <View style={styles.chips}>
              {SUGGESTIONS.map((s) => (
                <TouchableOpacity key={s} style={styles.chip} onPress={() => setText(s)}>
                  <Text style={styles.chipText}>{s}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        ) : (
          <FlatList
            ref={listRef}
            data={data}
            keyExtractor={(m) => m.id}
            contentContainerStyle={{ padding: 16, gap: 12, paddingBottom: 8 }}
            renderItem={({ item }) => {
              if (item.id === "__typing__") {
                return (
                  <View style={[styles.bubble, styles.bubbleAi, { borderLeftColor: accent.color }]}>
                    <Text style={[styles.role, { color: accent.color }]}>Waise</Text>
                    {status ? <Text style={styles.statusText}>{status}</Text> : <TypingDots color={accent.color} />}
                  </View>
                );
              }
              if (item.search) {
                return (
                  <View style={styles.searchPill}>
                    <Ionicons name="globe-outline" size={12} color={colors.dim} />
                    <Text style={styles.searchPillText} numberOfLines={1}>
                      {item.search}
                    </Text>
                  </View>
                );
              }
              return (
                <View
                  style={[
                    styles.bubble,
                    item.role === "user" ? styles.bubbleUser : [styles.bubbleAi, { borderLeftColor: accent.color }],
                  ]}
                >
                  <Text style={[styles.role, item.role === "assistant" && { color: accent.color }]}>
                    {item.role === "user" ? "Tú" : "Waise"}
                  </Text>
                  {item.images && item.images.length > 0 && (
                    <View style={styles.imgRow}>
                      {item.images.map((img: ImageAttachment, i: number) => (
                        <TouchableOpacity key={i} onPress={() => setLightbox(img.url)}>
                          <Image source={{ uri: img.url }} style={styles.msgImage} />
                        </TouchableOpacity>
                      ))}
                    </View>
                  )}
                  {!!item.content && <Text style={[styles.content, { fontSize: fs }]}>{item.content}</Text>}
                </View>
              );
            }}
          />
        )}

        <Glass style={[styles.composer, { marginBottom: kbOpen ? 8 : clearance + 6 }]} radius={24} intensity={45}>
          <View>
            {toast && (
              <View style={styles.toast}>
                <Text style={styles.toastText}>⚠ {toast}</Text>
              </View>
            )}
            {pending.length > 0 && (
              <View style={styles.pendingRow}>
                {pending.map((p) => (
                  <View key={p.id} style={styles.pendingThumb}>
                    <Image source={{ uri: p.uri }} style={styles.pendingImage} />
                    {p.status === "uploading" && <ActivityIndicator style={StyleSheet.absoluteFill} color="#fff" />}
                    {p.status === "error" && <View style={styles.pendingError} />}
                    <TouchableOpacity style={styles.pendingRemove} onPress={() => removePending(p.id)}>
                      <Text style={styles.pendingRemoveText}>✕</Text>
                    </TouchableOpacity>
                  </View>
                ))}
              </View>
            )}
            <View style={styles.composerInner}>
              <TouchableOpacity style={styles.attachBtn} onPress={pickImage}>
                <Ionicons name="attach" size={20} color={colors.text} />
              </TouchableOpacity>
              <TextInput
                style={[styles.input, { fontSize: fs }]}
                placeholder={model.image ? "Describe la imagen a generar…" : "Escribe a Waise…"}
                placeholderTextColor={colors.faint}
                value={text}
                onChangeText={setText}
                multiline
              />
              <Pressable
                style={({ pressed }) => [
                  styles.sendBtn,
                  { backgroundColor: accent.color },
                  (busy || uploading) && { opacity: 0.5 },
                  pressed && { transform: [{ scale: 0.9 }] },
                ]}
                onPress={send}
                disabled={busy || uploading}
              >
                {busy ? (
                  <ActivityIndicator color={accent.ink} size="small" />
                ) : (
                  <Ionicons name="arrow-up" size={19} color={accent.ink} />
                )}
              </Pressable>
            </View>
          </View>
        </Glass>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  header: {
    height: HEADER_HEIGHT,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 18,
  },
  headerTitle: { color: colors.text, fontSize: 26, fontWeight: "800", letterSpacing: -0.6 },
  modelPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: colors.surface2,
    borderWidth: 1,
    borderColor: colors.strokeSoft,
    borderRadius: 14,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  modelPillText: { fontSize: 12, fontWeight: "800" },
  modelBackdrop: { position: "absolute", top: 0, left: 0, right: 0, bottom: 0, backgroundColor: "rgba(0,0,0,0.5)" },
  modelSheet: { position: "absolute", left: 16, right: 16 },
  modelTitle: {
    color: colors.faint,
    fontSize: 11,
    fontWeight: "800",
    textTransform: "uppercase",
    letterSpacing: 0.6,
    padding: 8,
    paddingBottom: 4,
  },
  modelRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 11,
    paddingHorizontal: 10,
    borderRadius: 12,
  },
  modelRowText: { color: colors.text, fontSize: 14.5, fontWeight: "600" },
  headerBtns: { flexDirection: "row", gap: 8 },
  headerBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.surface2,
    borderWidth: 1,
    borderColor: colors.strokeSoft,
  },
  empty: { flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 28 },
  emptyBadge: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1.5,
    backgroundColor: colors.surface,
    marginBottom: 16,
  },
  emptyTitle: { fontSize: 24, fontWeight: "800", letterSpacing: -0.5, color: colors.text },
  emptySub: { color: colors.dim, marginTop: 8, fontSize: 13.5, textAlign: "center", lineHeight: 19 },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 22, justifyContent: "center" },
  chip: {
    backgroundColor: colors.surface2,
    borderWidth: 1,
    borderColor: colors.strokeSoft,
    borderRadius: 18,
    paddingHorizontal: 13,
    paddingVertical: 8,
  },
  chipText: { color: colors.text, fontSize: 12.5, fontWeight: "600" },
  bubble: { borderRadius: 18, padding: 13, maxWidth: "88%", borderWidth: 1, borderColor: colors.strokeSoft },
  bubbleUser: { alignSelf: "flex-end", backgroundColor: colors.surface3, borderBottomRightRadius: 6 },
  bubbleAi: { alignSelf: "flex-start", backgroundColor: colors.surface2, borderLeftWidth: 2.5, borderBottomLeftRadius: 6 },
  role: { fontSize: 10, fontWeight: "800", color: colors.faint, textTransform: "uppercase", marginBottom: 4, letterSpacing: 0.5 },
  content: { color: colors.text, lineHeight: 21 },
  imgRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 8 },
  msgImage: { width: 160, height: 160, borderRadius: 12 },
  typingRow: { flexDirection: "row", gap: 5, paddingVertical: 4 },
  typingDot: { width: 7, height: 7, borderRadius: 3.5 },
  statusText: { color: colors.dim, fontSize: 12.5 },
  searchPill: {
    alignSelf: "center",
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.strokeSoft,
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 6,
    maxWidth: "82%",
  },
  searchPillText: { color: colors.dim, fontSize: 11.5, fontWeight: "600" },
  composer: { marginHorizontal: 12 },
  composerInner: { flexDirection: "row", gap: 8, padding: 10, alignItems: "flex-end" },
  attachBtn: { width: 40, height: 40, borderRadius: 14, alignItems: "center", justifyContent: "center", backgroundColor: colors.surface2 },
  input: { flex: 1, color: colors.text, maxHeight: 120, paddingHorizontal: 8, paddingVertical: 10 },
  sendBtn: { width: 40, height: 40, borderRadius: 14, alignItems: "center", justifyContent: "center" },
  toast: { backgroundColor: "rgba(240,97,109,0.14)", borderBottomWidth: 1, borderBottomColor: "rgba(240,97,109,0.3)", padding: 8, paddingHorizontal: 12 },
  toastText: { color: "#ff98a1", fontSize: 12 },
  pendingRow: { flexDirection: "row", gap: 8, padding: 10, paddingBottom: 0 },
  pendingThumb: { width: 52, height: 52, borderRadius: 10, overflow: "hidden", backgroundColor: colors.surface3 },
  pendingImage: { width: "100%", height: "100%" },
  pendingError: { position: "absolute", top: 0, left: 0, right: 0, bottom: 0, backgroundColor: "rgba(240,97,109,0.4)" },
  pendingRemove: { position: "absolute", top: -4, right: -4, width: 18, height: 18, borderRadius: 9, backgroundColor: "#000", alignItems: "center", justifyContent: "center" },
  pendingRemoveText: { color: "#fff", fontSize: 9 },
});
