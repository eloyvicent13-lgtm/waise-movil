import * as FileSystem from "expo-file-system/legacy";
import { SERVER_URL, getToken, serverFetch } from "./auth";
import type {
  AiChat,
  AiChatSummary,
  ChatMessage,
  McpServerEntry,
  McpServerStatus,
  McpTool,
  PlanInfo,
  Project,
  ProjectFileEntry,
  ProjectMessage,
  Session,
} from "./types";

async function json<T>(r: Response): Promise<T> {
  const body = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(body.error || `error ${r.status}`);
  return body as T;
}

// Mobile v1 uses non-streaming chat (stream:false): RN's fetch can't reliably
// read a streamed response body, so the full reply arrives in one shot.
export const chat = (model: string, messages: ChatMessage[]) =>
  serverFetch("/chat", { method: "POST", body: JSON.stringify({ model, messages, stream: false }) }).then((r) =>
    json<{ choices: { message: { content: string } }[] }>(r),
  );

/**
 * Upload a locally-picked image via our server proxy; returns the public URL.
 * Uses expo-file-system's native uploader: fetch's FormData on this SDK rejects
 * the RN {uri,name,type} part shape ("Unsupported FormDataPart implementation").
 */
export async function uploadImage(uri: string, _name: string, mime: string): Promise<{ url: string }> {
  const token = await getToken();
  if (!token) throw new Error("inicia sesión primero");
  const res = await FileSystem.uploadAsync(`${SERVER_URL}/chat/upload`, uri, {
    httpMethod: "POST",
    uploadType: FileSystem.FileSystemUploadType.MULTIPART,
    fieldName: "file",
    mimeType: mime,
    headers: { Authorization: `Bearer ${token}` },
  });
  let body: { url?: string; error?: string } = {};
  try {
    body = JSON.parse(res.body);
  } catch {}
  if (res.status >= 400 || !body.url) throw new Error(body.error || `error subiendo imagen (${res.status})`);
  return { url: body.url };
}

export const planInfo = () => serverFetch("/me/plan").then((r) => json<PlanInfo>(r));
export const loginCode = () => serverFetch("/auth/login-code", { method: "POST" }).then((r) => json<{ code: string }>(r));

export const listSessions = () => serverFetch("/me/sessions").then((r) => json<Session[]>(r));
export const saveSession = (s: Session) =>
  serverFetch(`/me/sessions/${s.id}`, { method: "PUT", body: JSON.stringify(s) }).then((r) => json(r));
export const deleteSession = (id: string) =>
  serverFetch(`/me/sessions/${id}`, { method: "DELETE" }).then((r) => json(r));

export const listProjects = () => serverFetch("/projects").then((r) => json<Project[]>(r));
export const createProject = (name: string) =>
  serverFetch("/projects", { method: "POST", body: JSON.stringify({ name }) }).then((r) => json<Project>(r));
export const inviteToProject = (id: string, username: string) =>
  serverFetch(`/projects/${id}/invite`, { method: "POST", body: JSON.stringify({ username }) }).then((r) =>
    json<Project>(r),
  );
export const listProjectFiles = (id: string, path: string) =>
  serverFetch(`/projects/${id}/files?path=${encodeURIComponent(path)}`).then((r) => json<ProjectFileEntry[]>(r));
export const readProjectFile = (id: string, path: string) =>
  serverFetch(`/projects/${id}/file?path=${encodeURIComponent(path)}`).then((r) =>
    json<{ content: string }>(r),
  );
export const writeProjectFile = (id: string, path: string, content: string) =>
  serverFetch(`/projects/${id}/file`, { method: "PUT", body: JSON.stringify({ path, content }) }).then((r) =>
    json(r),
  );
export const deleteProjectFile = (id: string, path: string) =>
  serverFetch(`/projects/${id}/file?path=${encodeURIComponent(path)}`, { method: "DELETE" }).then((r) => json(r));
export const listProjectMessages = (id: string) =>
  serverFetch(`/projects/${id}/messages`).then((r) => json<ProjectMessage[]>(r));

// ---- per-project AI chats (each user's own conversation with Waise) ----
export const listProjectAiChats = (id: string) =>
  serverFetch(`/projects/${id}/ai-chats`).then((r) => json<AiChatSummary[]>(r));
export const getProjectAiChat = (id: string, chatId: string) =>
  serverFetch(`/projects/${id}/ai-chats/${chatId}`).then((r) => json<AiChat>(r));
export const saveProjectAiChat = (id: string, chatId: string, title: string, messages: ChatMessage[]) =>
  serverFetch(`/projects/${id}/ai-chats/${chatId}`, { method: "PUT", body: JSON.stringify({ title, messages }) }).then(
    (r) => json<AiChat>(r),
  );

/**
 * Upload a local file into a shared project's files (multipart, same native
 * uploader as uploadImage — fetch's FormData rejects RN's {uri,name,type} part).
 */
export async function uploadProjectFile(id: string, dir: string, uri: string, name: string, mime: string): Promise<{ path: string }> {
  const token = await getToken();
  if (!token) throw new Error("inicia sesión primero");
  const res = await FileSystem.uploadAsync(`${SERVER_URL}/projects/${id}/upload`, uri, {
    httpMethod: "POST",
    uploadType: FileSystem.FileSystemUploadType.MULTIPART,
    fieldName: "file",
    mimeType: mime,
    parameters: { path: dir },
    headers: { Authorization: `Bearer ${token}` },
  });
  let body: { path?: string; error?: string } = {};
  try {
    body = JSON.parse(res.body);
  } catch {}
  if (res.status >= 400 || !body.path) throw new Error(body.error || `error subiendo archivo (${res.status})`);
  return { path: body.path };
}

/** Download the project's full zip export to local storage; returns the local file uri. */
export async function exportProjectZip(id: string, projectName: string): Promise<string> {
  const token = await getToken();
  if (!token) throw new Error("inicia sesión primero");
  const dest = `${FileSystem.documentDirectory}${projectName.replace(/[^\w.-]+/g, "_")}.zip`;
  const res = await FileSystem.downloadAsync(`${SERVER_URL}/projects/${id}/export`, dest, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (res.status >= 400) throw new Error(`error exportando el proyecto (${res.status})`);
  return res.uri;
}

// ---- MCP connectors (hosted server-side; mobile can't run local processes) ----
export const mcpList = () => serverFetch("/me/mcp").then((r) => json<McpServerEntry[]>(r));
export const mcpSave = (entries: McpServerEntry[]) =>
  serverFetch("/me/mcp", { method: "PUT", body: JSON.stringify(entries) }).then((r) => json(r));
export const mcpStatus = () => serverFetch("/me/mcp/status").then((r) => json<McpServerStatus[]>(r));
export const mcpTools = () => serverFetch("/me/mcp/tools").then((r) => json<McpTool[]>(r));
export const mcpCall = (toolId: string, args: Record<string, unknown>) =>
  serverFetch("/me/mcp/call", { method: "POST", body: JSON.stringify({ toolId, args }) }).then((r) =>
    json<{ result: string }>(r),
  );

/** Generate an image with Nano Banana (backed by DALL-E 3) via our server. */
export async function generateImage(model: string, prompt: string): Promise<{ image: string; text?: string }> {
  const r = await serverFetch("/image", { method: "POST", body: JSON.stringify({ model, prompt }) });
  const body = await r.json().catch(() => ({}));
  if (!r.ok || !body.image) throw new Error(body.error || `error ${r.status}`);
  return { image: body.image, text: body.text };
}
