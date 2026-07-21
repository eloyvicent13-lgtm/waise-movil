export interface ContentPart {
  type: "text" | "image_url";
  text?: string;
  image_url?: { url: string };
}

export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string | ContentPart[];
}

export interface Session {
  id: string;
  title: string;
  created_at: string;
  updated_at: string;
  model: string;
  provider_id: string;
  workspace: string | null;
  messages: ChatMessage[];
}

export interface Project {
  id: string;
  name: string;
  owner: string;
  members: string[];
  created_at: string;
}

export interface ProjectFileEntry {
  name: string;
  path: string;
  is_dir: boolean;
}

export interface ProjectMessage {
  id: string;
  from: string;
  text: string;
  ts: string;
}

export interface ImageAttachment {
  url: string;
  name: string;
}

export interface PlanWindowedBucket {
  used5h: number;
  limit5h: number;
  usedWeek: number;
  limitWeek: number;
  resets5hInSeconds: number | null;
  resetsWeekInSeconds: number | null;
}
export interface PlanMonthlyBucket {
  used: number;
  limit: number;
  resetsInSeconds: number;
}
export interface PlanInfo {
  plan: "free" | "lite" | "pro" | "ultra";
  label: string;
  agent_mode: boolean;
  max_steps: number;
  projects: number;
  buckets: {
    lumin: PlanWindowedBucket;
    gpt5mini: PlanWindowedBucket;
    kimik3: PlanWindowedBucket;
    nanoBanana: PlanMonthlyBucket;
  };
  topups: Record<string, number>;
}

export interface AiChatSummary {
  id: string;
  title: string;
  created_at: string;
  updated_at: string;
}
export interface AiChat extends AiChatSummary {
  owner: string;
  messages: ChatMessage[];
}

export interface McpServerEntry {
  id: string;
  name: string;
  preset: string;
  enabled: boolean;
  /** Which env keys are already stored server-side (secrets never echo back). */
  envKeys: string[];
  /** Only when submitting new/changed credentials. */
  env?: Record<string, string>;
}

export interface McpTool {
  serverId: string;
  serverName: string;
  id: string;
  name: string;
  description?: string;
}

export interface McpServerStatus {
  id: string;
  name: string;
  enabled: boolean;
  connected: boolean;
  error: string | null;
  toolCount: number;
}

export type ProjectToolName = "read_file" | "list_dir" | "todo_write" | "create_file" | "write_file" | "edit_file" | "delete_file";
export interface ProjectAction {
  tool: ProjectToolName;
  args: Record<string, string>;
}
export type ActionStatus = "pending" | "auto" | "approved" | "denied" | "done" | "error";

export interface UiMessage {
  id: string;
  role: "user" | "assistant" | "tool";
  content: string;
  images?: ImageAttachment[];
  streaming?: boolean;
  /** Small centered pill: web tool activity ("Buscó: …" / "Leyó: …"). */
  search?: string;
  raw?: string;
  action?: ProjectAction;
  actionStatus?: ActionStatus;
  actionResult?: string;
}
