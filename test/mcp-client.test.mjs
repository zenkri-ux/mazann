import assert from "node:assert/strict";
import test from "node:test";
import { IslamicContentMcpClient, McpClientError, parseEventStream } from "@mazann/islamic-content-connector";

test("parseEventStream returns the message matching the request id", () => {
  const payload = 'event: message\ndata: {"jsonrpc":"2.0","id":7,"result":{"ok":true}}\n\n';
  assert.deepEqual(parseEventStream(payload, 7), { ok: true });
});

test("MCP client sends a read-only tool call", async () => {
  const fetchImpl = async (_url, options) => {
    const request = JSON.parse(options.body);
    assert.equal(request.method, "tools/call");
    assert.equal(request.params.name, "search");
    return new Response(`event: message\ndata: ${JSON.stringify({ jsonrpc: "2.0", id: request.id, result: { structuredContent: { results: [] } } })}\n\n`, {
      status: 200,
      headers: { "content-type": "text/event-stream" },
    });
  };
  const client = new IslamicContentMcpClient({ endpoint: "https://example.test/mcp", fetchImpl });
  const result = await client.callTool("search", { query: "الأمانة" });
  assert.deepEqual(result.structuredContent.results, []);
});

test("MCP client exposes timeout as a controlled error", async () => {
  const fetchImpl = async (_url, options) => new Promise((_resolve, reject) => {
    options.signal.addEventListener("abort", () => reject(Object.assign(new Error("aborted"), { name: "AbortError" })));
  });
  const client = new IslamicContentMcpClient({ endpoint: "https://example.test/mcp", timeoutMs: 1, fetchImpl });
  await assert.rejects(() => client.callTool("search", { query: "x" }), (error) => {
    assert.ok(error instanceof McpClientError);
    assert.equal(error.code, "MCP_TIMEOUT");
    return true;
  });
});
