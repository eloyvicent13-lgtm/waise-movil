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
    geminiEcon: PlanWindowedBucket;
    geminiPremium: PlanWindowedBucket;
    nanoBanana: PlanMonthlyBucket;
    nanoBananaPro: PlanMonthlyBucket;
    video: PlanMonthlyBucket;
  };
}

export interface UiMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  images?: ImageAttachment[];
  streaming?: boolean;
  /** Small centered pill: web tool activity ("Buscó: …" / "Leyó: …"). */
  search?: string;
}
