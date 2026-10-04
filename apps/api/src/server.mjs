import http from "node:http";
import fs from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { config } from "./config.mjs";
import { IslamicContentMcpClient } from "@mazann/islamic-content-connector";
import { RecordCache } from "./lib/record-cache.mjs";
import { ProjectStore } from "./lib/project-store.mjs";
import { EvidenceService, EvidenceUnavailableError } from "./services/evidence-service.mjs";
import { createTopicRoadmap } from "@mazann/domain/topic-roadmap";

const client = new IslamicContentMcpClient({ endpoint: config.mcpUrl, timeoutMs: config.mcpTimeoutMs });
const cache = new RecordCache(config.cacheDir, { fallbackDirectories: [config.seedCacheDir] });
const evidence = new EvidenceService({ client, cache, cacheWrite: config.cacheWrite });
const projects = new ProjectStore(config.projectDir);
const distDir = config.webDir;
const startedAt = new Date().toISOString();

const mimeTypes = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".svg": "image/svg+xml",
  ".ttf": "font/ttf",
  ".json": "application/json; charset=utf-8",
};

function sendJson(response, status, data) {
  response.writeHead(status, {
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store",
    "x-content-type-options": "nosniff",
  });
  response.end(JSON.stringify(data));
}

async function readJson(request, maxBytes = 65_536) {
  const chunks = [];
  let size = 0;
  for await (const chunk of request) {
    size += chunk.length;
    if (size > maxBytes) throw Object.assign(new Error("الطلب أكبر من الحد المسموح"), { status: 413 });
    chunks.push(chunk);
  }
  const body = Buffer.concat(chunks).toString("utf8");
  try {
    return body ? JSON.parse(body) : {};
  } catch {
    throw Object.assign(new Error("صيغة JSON غير صحيحة"), { status: 400 });
  }
}

function requireInteger(value, name, { min = 1, max = Number.MAX_SAFE_INTEGER } = {}) {
  if (!Number.isInteger(value) || value < min || value > max) {
    throw Object.assign(new Error(`${name} يجب أن يكون عددًا صحيحًا بين ${min} و${max}`), { status: 400 });
  }
  return value;
}

async function handleApi(request, response, url) {
  if (request.method === "GET" && url.pathname === "/api/health") {
    return sendJson(response, 200, {
      status: "ok",
      service: "mazann",
      version: "0.1.0",
      started_at: startedAt,
      source_mode: "official_mcp_with_visible_cache_fallback",
    });
  }

  if (request.method === "GET" && url.pathname === "/api/projects") {
    return sendJson(response, 200, { projects: await projects.list() });
  }

  const projectMatch = /^\/api\/projects\/(project_[a-f0-9-]{36})$/.exec(url.pathname);
  if (request.method === "GET" && projectMatch) {
    return sendJson(response, 200, await projects.get(projectMatch[1]));
  }

  if (request.method !== "POST") return sendJson(response, 405, { error: "METHOD_NOT_ALLOWED" });
  const body = await readJson(request, url.pathname === "/api/projects" ? 1_000_000 : 65_536);

  if (url.pathname === "/api/projects") {
    return sendJson(response, body.project_id ? 200 : 201, await projects.save(body));
  }

  if (url.pathname === "/api/research/roadmap") {
    return sendJson(response, 200, createTopicRoadmap(body));
  }

  if (url.pathname === "/api/research/evidence") {
    const maxRecords = body.max_records === undefined
      ? 6
      : requireInteger(body.max_records, "max_records", { min: 1, max: 10 });
    return sendJson(response, 200, await evidence.collectForRoadmap({ roadmap: body.roadmap, maxRecords }));
  }

  if (url.pathname === "/api/evidence/search") {
    if (typeof body.query !== "string" || !body.query.trim()) {
      throw Object.assign(new Error("حقل query مطلوب"), { status: 400 });
    }
    const allowedSources = new Set(["quran", "hadith", "library"]);
    const sources = Array.isArray(body.sources) ? body.sources : ["quran", "hadith"];
    if (!sources.length || sources.some((source) => !allowedSources.has(source))) {
      throw Object.assign(new Error("المصادر المطلوبة غير صالحة"), { status: 400 });
    }
    const limit = body.limit === undefined ? 10 : requireInteger(body.limit, "limit", { min: 1, max: 25 });
    return sendJson(response, 200, await evidence.search({
      query: body.query.trim(),
      sources,
      language: body.language ?? "ar",
      limit,
    }));
  }

  if (url.pathname === "/api/evidence/quran") {
    const surah = requireInteger(body.surah, "surah", { min: 1, max: 114 });
    const ayah = requireInteger(body.ayah, "ayah");
    return sendJson(response, 200, await evidence.quran({ surah, ayah, language: body.language ?? "ar" }));
  }

  if (url.pathname === "/api/evidence/hadith") {
    if ((typeof body.id !== "string" && typeof body.id !== "number") || String(body.id).trim() === "") {
      throw Object.assign(new Error("حقل id مطلوب"), { status: 400 });
    }
    return sendJson(response, 200, await evidence.hadith({ id: String(body.id), language: body.language ?? "ar" }));
  }

  if (url.pathname === "/api/evidence/fetch") {
    if (typeof body.id !== "string" || !body.id.trim()) {
      throw Object.assign(new Error("حقل id مطلوب"), { status: 400 });
    }
    return sendJson(response, 200, await evidence.fetchCandidate({ id: body.id.trim(), language: body.language ?? "ar" }));
  }

  return sendJson(response, 404, { error: "API_NOT_FOUND" });
}

async function serveStatic(response, url) {
  const requested = url.pathname === "/" ? "/index.html" : url.pathname;
  const decoded = decodeURIComponent(requested);
  const filePath = path.resolve(distDir, `.${decoded}`);
  if (!filePath.startsWith(`${distDir}${path.sep}`)) return sendJson(response, 403, { error: "FORBIDDEN" });

  try {
    const content = await fs.readFile(filePath);
    response.writeHead(200, {
      "content-type": mimeTypes[path.extname(filePath)] ?? "application/octet-stream",
      "x-content-type-options": "nosniff",
    });
    response.end(content);
  } catch (error) {
    if (error?.code === "ENOENT") return sendJson(response, 404, { error: "NOT_FOUND" });
    throw error;
  }
}

export function createServer() {
  return http.createServer(async (request, response) => {
    const url = new URL(request.url, `http://${request.headers.host ?? "localhost"}`);
    try {
      if (url.pathname.startsWith("/api/")) await handleApi(request, response, url);
      else await serveStatic(response, url);
    } catch (error) {
      const status = error.status ?? (error instanceof EvidenceUnavailableError ? 503 : 500);
      sendJson(response, status, {
        error: error.code ?? "REQUEST_FAILED",
        message: error.message,
        details: error.details,
      });
    }
  });
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  createServer().listen(config.port, config.host, () => {
    console.log(`Mazann listening on http://${config.host}:${config.port}`);
  });
}
