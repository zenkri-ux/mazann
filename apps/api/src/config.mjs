import path from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");

function integerFromEnv(name, fallback) {
  const value = Number.parseInt(process.env[name] ?? "", 10);
  return Number.isFinite(value) ? value : fallback;
}

export const config = Object.freeze({
  projectRoot,
  host: process.env.HOST ?? "127.0.0.1",
  port: integerFromEnv("PORT", 8090),
  mcpUrl: process.env.MCP_ISLAMIC_CONTENT_URL ?? "https://mcp.islamiccontent.org/mcp",
  mcpTimeoutMs: integerFromEnv("MCP_TIMEOUT_MS", 12_000),
  cacheDir: path.resolve(projectRoot, process.env.MAZANN_CACHE_DIR ?? "data/runtime/cache"),
  seedCacheDir: path.resolve(projectRoot, process.env.MAZANN_SEED_CACHE_DIR ?? "data/cache"),
  projectDir: path.resolve(projectRoot, process.env.MAZANN_PROJECT_DIR ?? "data/runtime/projects"),
  webDir: path.resolve(projectRoot, "apps/web/dist"),
  cacheWrite: (process.env.MAZANN_CACHE_WRITE ?? "true").toLowerCase() !== "false",
  plannerProvider: process.env.MAZANN_PLANNER_PROVIDER ?? "deterministic",
  plannerTimeoutMs: integerFromEnv("MAZANN_PLANNER_TIMEOUT_MS", 30_000),
  openaiApiKey: process.env.OPENAI_API_KEY ?? "",
  openaiModel: process.env.OPENAI_MODEL ?? "",
  openaiResponsesUrl: process.env.OPENAI_RESPONSES_URL ?? "https://api.openai.com/v1/responses",
});
