import { deleteProjectFile, listProjectFiles, readProjectFile, writeProjectFile } from "./api";
import type { ProjectAction, ProjectToolName } from "./types";

const AUTO_TOOLS: ProjectToolName[] = ["read_file", "list_dir", "todo_write"];

export function projectNeedsApproval(tool: ProjectToolName): boolean {
  return !AUTO_TOOLS.includes(tool);
}

export function parseProjectAction(text: string): ProjectAction | null {
  const m = text.match(/```waise-action\s*([\s\S]*?)```/);
  if (!m) return null;
  try {
    const a = JSON.parse(m[1].trim());
    if (a && typeof a.tool === "string") return { tool: a.tool, args: a.args || {} };
  } catch {}
  return null;
}

/**
 * True when the model opened a waise-action fence but the response got cut
 * off before closing it — usually a max-output-tokens limit while writing a
 * big file inline, not a real hang. Lets the caller ask it to continue
 * instead of silently showing broken JSON as the final answer.
 */
export function isTruncatedAction(text: string): boolean {
  return /```waise-action/.test(text) && !/```waise-action\s*[\s\S]*?```/.test(text);
}

/** Text visible to the user: strips the waise-action fenced block out of the reply. */
export function visibleText(raw: string): string {
  return raw.replace(/```waise-action\s*[\s\S]*?```/, "").trim();
}

export function projectSystemPrompt(projectName: string, displayName?: string): string {
  const who = displayName?.trim() ? `El usuario se llama ${displayName.trim()}.\n` : "";
  return `Eres **Waise**, asistente de programación, ayudando dentro del proyecto compartido "${projectName}". Varias personas colaboran aquí en tiempo real; sé claro sobre qué archivo tocas. Habla el idioma del usuario (por defecto español).

${who}
Los archivos de este proyecto viven en un servidor compartido, NO en el móvil de nadie. No tienes acceso a terminal/comandos aquí.

Para actuar, responde con UN ÚNICO bloque cercado (sin texto después):
\`\`\`waise-action
{"tool":"<nombre>","args":{...}}
\`\`\`
Máximo una acción por mensaje. Tras ejecutarla recibirás [tool_result:<tool>] ... y podrás continuar. Sin bloque de acción = tarea terminada.

Herramientas:
- read_file — {"path": "..."} — lee un archivo (automático).
- list_dir — {"path": "... o vacío"} — lista una carpeta (automático).
- todo_write — {"items": [{"text":"...","done":false}]} — plan de tareas visible (automático).
- create_file — {"path": "...", "content": "..."} — crea archivo nuevo (requiere aprobación).
- write_file — {"path": "...", "content": "..."} — crea o sobrescribe (requiere aprobación).
- edit_file — {"path": "...", "find": "texto exacto", "replace": "texto nuevo"} — reemplaza primera coincidencia (requiere aprobación).
- delete_file — {"path": "..."} — borra (requiere aprobación).

Antes de editar, lee el archivo si no conoces su contenido.`;
}

export async function executeProjectAction(projectId: string, action: ProjectAction): Promise<string> {
  const a = action.args ?? {};
  switch (action.tool) {
    case "read_file":
      return (await readProjectFile(projectId, a.path)).content;
    case "list_dir": {
      const entries = await listProjectFiles(projectId, a.path ?? "");
      return JSON.stringify(entries.map((e) => ({ path: e.path, dir: e.is_dir })));
    }
    case "todo_write":
      return "Lista actualizada.";
    case "create_file":
    case "write_file":
      await writeProjectFile(projectId, a.path, a.content ?? "");
      return `Guardado: ${a.path}`;
    case "edit_file": {
      const { content } = await readProjectFile(projectId, a.path);
      if (!content.includes(a.find ?? "")) throw new Error("`find` no encontrado en el archivo");
      await writeProjectFile(projectId, a.path, content.replace(a.find ?? "", a.replace ?? ""));
      return `Editado: ${a.path}`;
    }
    case "delete_file":
      await deleteProjectFile(projectId, a.path);
      return `Borrado: ${a.path}`;
    default:
      return `Herramienta no disponible: ${action.tool}`;
  }
}

export function describeProjectAction(action: ProjectAction): string {
  const a = action.args ?? {};
  switch (action.tool) {
    case "read_file": return `Leer ${a.path}`;
    case "list_dir": return `Listar ${a.path || "raíz"}`;
    case "todo_write": return "Actualizar lista de tareas";
    case "create_file": return `Crear archivo ${a.path}`;
    case "write_file": return `Escribir ${a.path}`;
    case "edit_file": return `Editar ${a.path}`;
    case "delete_file": return `Borrar ${a.path}`;
    default: return action.tool;
  }
}
