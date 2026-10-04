import fs from "node:fs/promises";
import path from "node:path";

function safeFileName(id) {
  return id.replace(/[^a-zA-Z0-9_.-]+/g, "_");
}

export class RecordCache {
  constructor(directory, { fallbackDirectories = [] } = {}) {
    this.directory = directory;
    this.fallbackDirectories = fallbackDirectories;
  }

  pathFor(id) {
    return path.join(this.directory, `${safeFileName(id)}.json`);
  }

  async read(id) {
    const fileName = `${safeFileName(id)}.json`;
    for (const directory of [this.directory, ...this.fallbackDirectories]) {
      try {
        const content = await fs.readFile(path.join(directory, fileName), "utf8");
        return JSON.parse(content);
      } catch (error) {
        if (error?.code !== "ENOENT") throw error;
      }
    }
    return null;
  }

  async write(record) {
    await fs.mkdir(this.directory, { recursive: true });
    const payload = {
      cache_schema_version: "1.0.0",
      cached_at: new Date().toISOString(),
      record,
    };
    await fs.writeFile(this.pathFor(record.id), `${JSON.stringify(payload, null, 2)}\n`, "utf8");
    return payload;
  }
}
