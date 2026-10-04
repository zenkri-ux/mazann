export class McpClientError extends Error {
  constructor(message, { code = "MCP_ERROR", cause, details } = {}) {
    super(message, { cause });
    this.name = "McpClientError";
    this.code = code;
    this.details = details;
  }
}

export function parseEventStream(payload, expectedId) {
  const messages = [];

  for (const line of payload.split(/\r?\n/)) {
    if (!line.startsWith("data:")) continue;
    const data = line.slice(5).trim();
    if (!data || data === "[DONE]") continue;
    try {
      messages.push(JSON.parse(data));
    } catch (error) {
      throw new McpClientError("تعذر تحليل استجابة SSE من المصدر الرسمي", {
        code: "MCP_INVALID_SSE",
        cause: error,
      });
    }
  }

  const message = messages.find((item) => item.id === expectedId) ?? messages.at(-1);
  if (!message) {
    throw new McpClientError("لم يعد المصدر الرسمي رسالة JSON-RPC", { code: "MCP_EMPTY_RESPONSE" });
  }
  if (message.error) {
    throw new McpClientError(message.error.message ?? "فشل استدعاء أداة المصدر", {
      code: "MCP_RPC_ERROR",
      details: message.error,
    });
  }
  return message.result;
}

export class IslamicContentMcpClient {
  constructor({ endpoint, timeoutMs = 12_000, fetchImpl = globalThis.fetch } = {}) {
    if (!endpoint) throw new TypeError("MCP endpoint is required");
    if (typeof fetchImpl !== "function") throw new TypeError("fetch implementation is required");
    this.endpoint = endpoint;
    this.timeoutMs = timeoutMs;
    this.fetch = fetchImpl;
    this.nextId = 1;
  }

  async callTool(name, args = {}) {
    const id = this.nextId++;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      const response = await this.fetch(this.endpoint, {
        method: "POST",
        headers: {
          accept: "application/json, text/event-stream",
          "content-type": "application/json",
        },
        body: JSON.stringify({
          jsonrpc: "2.0",
          id,
          method: "tools/call",
          params: { name, arguments: args },
        }),
        signal: controller.signal,
      });

      if (!response.ok) {
        throw new McpClientError(`أعاد المصدر الرسمي HTTP ${response.status}`, {
          code: "MCP_HTTP_ERROR",
          details: { status: response.status },
        });
      }

      const payload = await response.text();
      const contentType = response.headers.get("content-type") ?? "";
      const result = contentType.includes("text/event-stream")
        ? parseEventStream(payload, id)
        : JSON.parse(payload).result;

      if (!result) {
        throw new McpClientError("استجابة المصدر لا تحتوي نتيجة", { code: "MCP_MISSING_RESULT" });
      }
      return result;
    } catch (error) {
      if (error instanceof McpClientError) throw error;
      if (error?.name === "AbortError") {
        throw new McpClientError("انتهت مهلة المصدر الرسمي", { code: "MCP_TIMEOUT", cause: error });
      }
      throw new McpClientError("تعذر الاتصال بالمصدر الرسمي", {
        code: "MCP_NETWORK_ERROR",
        cause: error,
      });
    } finally {
      clearTimeout(timeout);
    }
  }
}

export function textBlocks(result) {
  return (result?.content ?? [])
    .filter((item) => item?.type === "text" && typeof item.text === "string")
    .map((item) => item.text);
}
