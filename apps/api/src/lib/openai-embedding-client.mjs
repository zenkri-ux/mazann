export class OpenAIEmbeddingClient {
  constructor({ apiKey, model = "text-embedding-3-small", dimensions = 512, endpoint = "https://api.openai.com/v1/embeddings", timeoutMs = 30_000, fetchImpl = fetch }) {
    if (!apiKey) throw new Error("Embedding API key is required");
    this.apiKey = apiKey;
    this.model = model;
    this.dimensions = dimensions;
    this.endpoint = endpoint;
    this.timeoutMs = timeoutMs;
    this.fetchImpl = fetchImpl;
  }

  async embed(inputs) {
    if (!Array.isArray(inputs) || !inputs.length || inputs.some((input) => typeof input !== "string" || !input.trim())) {
      throw new TypeError("Embedding inputs must be nonempty strings");
    }
    const response = await this.fetchImpl(this.endpoint, {
      method: "POST",
      headers: { Authorization: `Bearer ${this.apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ model: this.model, dimensions: this.dimensions, encoding_format: "float", input: inputs }),
      signal: AbortSignal.timeout(this.timeoutMs),
    });
    if (!response.ok) {
      const error = new Error(`Embedding request failed with HTTP ${response.status}`);
      error.status = response.status;
      throw error;
    }
    const payload = await response.json();
    const rows = payload.data;
    if (!Array.isArray(rows) || rows.length !== inputs.length) throw new Error("Embedding response count mismatch");
    const result = Array(inputs.length);
    for (const row of rows) {
      if (!Number.isInteger(row.index) || row.index < 0 || row.index >= inputs.length || result[row.index]
        || !Array.isArray(row.embedding) || row.embedding.length !== this.dimensions
        || row.embedding.some((value) => !Number.isFinite(value))) {
        throw new Error("Embedding response is invalid");
      }
      result[row.index] = row.embedding;
    }
    if (result.some((vector) => !vector)) throw new Error("Embedding response is incomplete");
    return result;
  }
}
