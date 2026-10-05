import fs from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";

const PROJECT_ID = /^project_[a-f0-9-]{36}$/;
const WORKSPACE_ID = /^workspace_[a-f0-9-]{36}$/;

export class ProjectStoreError extends Error {
  constructor(message, { code = "INVALID_PROJECT", status = 400, details } = {}) {
    super(message);
    this.name = "ProjectStoreError";
    this.code = code;
    this.status = status;
    this.details = details;
  }
}

function cleanTitle(value) {
  if (typeof value !== "string") throw new ProjectStoreError("عنوان البحث مطلوب");
  const title = value.replace(/\s+/g, " ").trim();
  if (title.length < 3 || title.length > 160) throw new ProjectStoreError("عنوان البحث يجب أن يكون بين 3 و160 حرفًا");
  return title;
}

function validateId(id) {
  if (!PROJECT_ID.test(id ?? "")) throw new ProjectStoreError("معرف البحث غير صالح", { code: "INVALID_PROJECT_ID" });
  return id;
}

function validateWorkspaceId(id) {
  if (id === undefined || id === null || id === "") return null;
  if (!WORKSPACE_ID.test(id)) throw new ProjectStoreError("معرف مساحة البحث غير صالح", { code: "INVALID_WORKSPACE_ID" });
  return id;
}

function safeState(value) {
  const serialized = JSON.stringify(value ?? null);
  if (Buffer.byteLength(serialized, "utf8") > 900_000) {
    throw new ProjectStoreError("حجم البحث المحفوظ أكبر من الحد المسموح", { code: "PROJECT_TOO_LARGE", status: 413 });
  }
  return JSON.parse(serialized);
}

export class ProjectStore {
  constructor(directory, { clock = () => new Date() } = {}) {
    this.directory = directory;
    this.clock = clock;
  }

  directoryFor(workspaceId) {
    const validated = validateWorkspaceId(workspaceId);
    return validated ? path.join(this.directory, validated) : this.directory;
  }

  pathFor(id, { workspaceId } = {}) {
    return path.join(this.directoryFor(workspaceId), `${validateId(id)}.json`);
  }

  async save(input = {}, { workspaceId } = {}) {
    await fs.mkdir(this.directoryFor(workspaceId), { recursive: true });
    const id = input.project_id ? validateId(input.project_id) : `project_${randomUUID()}`;
    const existing = input.project_id ? await this.get(id, { required: false, workspaceId }) : null;
    const timestamp = this.clock().toISOString();
    const project = {
      schema_version: "1.0.0",
      project_id: id,
      title: cleanTitle(input.title),
      created_at: existing?.created_at ?? timestamp,
      updated_at: timestamp,
      current_view: ["start", "plan", "evidence", "coverage"].includes(input.current_view) ? input.current_view : "start",
      brief: safeState(input.brief),
      roadmap: safeState(input.roadmap),
      evidence: Array.isArray(input.evidence) ? safeState(input.evidence.slice(0, 50)) : [],
    };
    const target = this.pathFor(id, { workspaceId });
    const temporary = `${target}.${randomUUID()}.tmp`;
    await fs.writeFile(temporary, `${JSON.stringify(project, null, 2)}\n`, { encoding: "utf8", mode: 0o600 });
    await fs.rename(temporary, target);
    return project;
  }

  async get(id, { required = true, workspaceId } = {}) {
    try {
      return JSON.parse(await fs.readFile(this.pathFor(id, { workspaceId }), "utf8"));
    } catch (error) {
      if (error?.code === "ENOENT" && !required) return null;
      if (error?.code === "ENOENT") {
        throw new ProjectStoreError("البحث المحفوظ غير موجود", { code: "PROJECT_NOT_FOUND", status: 404 });
      }
      throw error;
    }
  }

  async list({ workspaceId } = {}) {
    try {
      const names = (await fs.readdir(this.directoryFor(workspaceId))).filter((name) => /^project_[a-f0-9-]{36}\.json$/.test(name));
      const projects = await Promise.all(names.map((name) => this.get(name.slice(0, -5), { workspaceId })));
      return projects
        .sort((left, right) => right.updated_at.localeCompare(left.updated_at))
        .map(({ project_id, title, created_at, updated_at, current_view, roadmap, evidence }) => ({
          project_id,
          title,
          created_at,
          updated_at,
          current_view,
          axis_count: roadmap?.axes?.length ?? 0,
          evidence_count: evidence?.length ?? 0,
          accepted_count: evidence?.filter((item) => item.decision === "accepted").length ?? 0,
        }));
    } catch (error) {
      if (error?.code === "ENOENT") return [];
      throw error;
    }
  }
}
