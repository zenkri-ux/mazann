import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { IslamicContentMcpClient, textBlocks } from "@mazann/islamic-content-connector";
import { normalizeArabicForSearch } from "../apps/api/src/lib/quran-search-index.mjs";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const outputPath = path.resolve(projectRoot, process.env.MAZANN_QURAN_INDEX_PATH ?? "data/quran-search-index.json");
const partsDirectory = path.resolve(projectRoot, "data/runtime/quran-index-parts");
const endpoint = process.env.MCP_ISLAMIC_CONTENT_URL ?? "https://mcp.islamiccontent.org/mcp";
const client = new IslamicContentMcpClient({ endpoint, timeoutMs: 30_000 });
const EXPECTED_AYAH_COUNTS = [
  7,286,200,176,120,165,206,75,129,109,123,111,43,52,99,128,111,110,98,135,112,78,118,64,77,227,93,88,69,60,
  34,30,73,54,45,83,182,88,75,85,54,53,89,59,37,35,38,29,18,45,60,49,62,55,78,96,29,22,24,13,14,11,11,18,
  12,12,30,52,52,44,28,28,20,56,40,31,50,40,46,42,29,19,36,25,22,17,19,26,30,20,15,21,11,8,8,19,5,8,
  8,11,11,8,3,9,5,4,7,3,6,3,5,4,5,6,
];
const SURAH_NAMES = ["الفاتحة","البقرة","آل عمران","النساء","المائدة","الأنعام","الأعراف","الأنفال","التوبة","يونس","هود","يوسف","الرعد","إبراهيم","الحجر","النحل","الإسراء","الكهف","مريم","طه","الأنبياء","الحج","المؤمنون","النور","الفرقان","الشعراء","النمل","القصص","العنكبوت","الروم","لقمان","السجدة","الأحزاب","سبأ","فاطر","يس","الصافات","ص","الزمر","غافر","فصلت","الشورى","الزخرف","الدخان","الجاثية","الأحقاف","محمد","الفتح","الحجرات","ق","الذاريات","الطور","النجم","القمر","الرحمن","الواقعة","الحديد","المجادلة","الحشر","الممتحنة","الصف","الجمعة","المنافقون","التغابن","الطلاق","التحريم","الملك","القلم","الحاقة","المعارج","نوح","الجن","المزمل","المدثر","القيامة","الإنسان","المرسلات","النبأ","النازعات","عبس","التكوير","الانفطار","المطففين","الانشقاق","البروج","الطارق","الأعلى","الغاشية","الفجر","البلد","الشمس","الليل","الضحى","الشرح","التين","العلق","القدر","البينة","الزلزلة","العاديات","القارعة","التكاثر","العصر","الهمزة","الفيل","قريش","الماعون","الكوثر","الكافرون","النصر","المسد","الإخلاص","الفلق","الناس"];

function exactBlock(text) {
  const match = text.match(/\[EXACT\][^\n]*\n([\s\S]*?)\n\[\/EXACT\]/u);
  if (!match) throw new Error("Official Quran response has no EXACT block");
  return match[1].trim();
}

export function parseSurah(text, surah) {
  const block = exactBlock(text);
  const marker = /^\[(\d+):(\d+)\]$/u;
  const lines = block.split(/\r?\n/u);
  const documents = [];
  let cursor = 0;
  while (cursor < lines.length) {
    if (!lines[cursor].trim()) { cursor += 1; continue; }
    const locator = lines[cursor].trim().match(marker);
    if (!locator) throw new Error(`Unexpected Quran response line for surah ${surah}: ${lines[cursor]}`);
    const responseSurah = Number(locator[1]);
    const ayah = Number(locator[2]);
    if (responseSurah !== surah || ayah !== documents.length + 1) throw new Error(`Non-sequential locator [${responseSurah}:${ayah}]`);
    const quranText = lines[cursor + 1]?.trim();
    if (!quranText) throw new Error(`Missing Quran text at [${surah}:${ayah}]`);
    cursor += 2;
    const explanationLines = [];
    while (cursor < lines.length && !marker.test(lines[cursor].trim())) {
      if (lines[cursor].trim()) explanationLines.push(lines[cursor].trim());
      cursor += 1;
    }
    const explanation = explanationLines.join(" ");
    if (!explanation) throw new Error(`Missing published explanation at [${surah}:${ayah}]`);
    documents.push({
      id: `quran:${surah}:${ayah}:ar`,
      surah,
      ayah,
      title: `سورة ${SURAH_NAMES[surah - 1]}، الآية ${ayah}`,
      citation_url: `https://islamenc.com/ar/quran/${surah}/${ayah}`,
      quran_search_text: normalizeArabicForSearch(quranText),
      explanation_search_text: normalizeArabicForSearch(explanation),
    });
  }
  if (documents.length !== EXPECTED_AYAH_COUNTS[surah - 1]) {
    throw new Error(`Surah ${surah}: expected ${EXPECTED_AYAH_COUNTS[surah - 1]} ayat, received ${documents.length}`);
  }
  return documents;
}

async function withRetry(surah, attempts = 8) {
  let lastError;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      const result = await client.callTool("get_quran_verses", { surah, language: "ar" });
      const text = textBlocks(result).join("\n");
      return parseSurah(text, surah);
    } catch (error) {
      lastError = error;
      if (attempt < attempts) {
        const rateLimited = error?.details?.status === 429;
        const delay = rateLimited ? Math.min(20_000, 2_000 * (2 ** (attempt - 1))) : attempt * 750;
        process.stdout.write(`retrying surah ${surah} after ${delay}ms (${error.code ?? error.message})\n`);
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }
  }
  throw lastError;
}

async function main() {
  await fs.mkdir(partsDirectory, { recursive: true });
  const documents = [];
  const queue = Array.from({ length: 114 }, (_, index) => index + 1);
  const workers = Array.from({ length: 2 }, async () => {
    while (queue.length) {
      const surah = queue.shift();
      const partPath = path.join(partsDirectory, `${String(surah).padStart(3, "0")}.json`);
      let records;
      try {
        records = JSON.parse(await fs.readFile(partPath, "utf8"));
        if (!Array.isArray(records) || records.length !== EXPECTED_AYAH_COUNTS[surah - 1]) throw new Error("invalid checkpoint");
        process.stdout.write(`reused surah ${surah} (${records.length} ayat)\n`);
      } catch {
        records = await withRetry(surah);
        await fs.writeFile(partPath, `${JSON.stringify(records)}\n`, "utf8");
        process.stdout.write(`indexed surah ${surah} (${records.length} ayat)\n`);
        await new Promise((resolve) => setTimeout(resolve, 250));
      }
      documents.push(...records);
    }
  });
  await Promise.all(workers);
  documents.sort((left, right) => left.surah - right.surah || left.ayah - right.ayah);
  if (documents.length !== 6236) throw new Error(`Expected 6236 ayat, received ${documents.length}`);
  const payload = {
    schema_version: "1.0.0",
    metadata: {
      generated_at: new Date().toISOString(),
      source: "QuranEnc via Islamic Content MCP",
      source_endpoint: endpoint,
      translation_key: "arabic_moyassar",
      unit: "whole_ayah",
      display_policy: "search-derived fields are never displayed as sacred text; fetch the exact canonical record before use",
      retrieval_fields: ["quran_text", "published_explanation"],
    },
    documents,
  };
  await fs.mkdir(path.dirname(outputPath), { recursive: true });
  await fs.writeFile(outputPath, `${JSON.stringify(payload)}\n`, "utf8");
  process.stdout.write(`wrote ${documents.length} ayat to ${outputPath}\n`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  await main();
}
