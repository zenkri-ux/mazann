import { config } from "../apps/api/src/config.mjs";
import { IslamicContentMcpClient } from "@mazann/islamic-content-connector";
import { RecordCache } from "../apps/api/src/lib/record-cache.mjs";
import { EvidenceService } from "../apps/api/src/services/evidence-service.mjs";

const client = new IslamicContentMcpClient({ endpoint: config.mcpUrl, timeoutMs: config.mcpTimeoutMs });
const cache = new RecordCache(config.seedCacheDir);
const evidence = new EvidenceService({ client, cache, cacheWrite: true });

const quran = await evidence.quran({ surah: 4, ayah: 58, language: "ar" });
const hadith = await evidence.hadith({ id: "3016", language: "ar" });

console.log(JSON.stringify({
  quran: { id: quran.record.id, mode: quran.retrieval_mode, status: quran.record.validation.status },
  hadith: { id: hadith.record.id, mode: hadith.retrieval_mode, status: hadith.record.validation.status },
}, null, 2));
