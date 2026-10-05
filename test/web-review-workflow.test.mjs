import assert from "node:assert/strict";
import fs from "node:fs/promises";
import test from "node:test";

const [html, script, styles] = await Promise.all([
  fs.readFile(new URL("../apps/web/dist/index.html", import.meta.url), "utf8"),
  fs.readFile(new URL("../apps/web/dist/app.js", import.meta.url), "utf8"),
  fs.readFile(new URL("../apps/web/dist/styles.css", import.meta.url), "utf8"),
]);

test("retrieval wait state uses the compact mark in a symmetric activity frame", () => {
  assert.match(html, /mazann-symbol-small-dark\.svg/);
  assert.match(styles, /\.retrieval-route\{[^}]*width:64px;height:64px/);
  assert.match(html, /بحث الصلة.*جلب السجل الكامل.*فحص المرجع/s);
});

test("evidence review explains axis use and provides a gated next step", () => {
  assert.match(html, /id="tafsir-context" hidden/);
  assert.match(script, /related_tafsir/);
  assert.match(script, /تفسير مرتبط · رابط خارجي/);
  assert.match(html, /id="evidence-use-text"/);
  assert.match(html, /id="open-coverage"[^>]*disabled/);
  assert.match(script, /const ready=total>0&&state\.reviewed===total/);
  assert.match(script, /evidenceUseLabel\(item\)/);
  assert.match(html, /id="evidence-axis-select"/);
  assert.match(html, /id="evidence-axis-change"/);
  assert.match(html, /تغيير المحور المقترح/);
  assert.match(script, /axisChange\.open=!hasSuggestion/);
  assert.match(script, /qs\('#evidence-axis-change'\)\.open=true/);
  assert.match(script, /item\.axis_ids=\(state\.roadmap\?\.axes\|\|\[\]\)\.some/);
  assert.match(script, /if\(evidenceAxes\(item\)\.length!==1\)/);
  assert.match(script, /class="hadith-matn">\$\{escapeHtml\(record\.text\)\}/);
  assert.match(script, /هذا هو المتن الكامل المنشور في سجل الإتاحة/);
});

test("evidence review has sequential navigation, preserves filters, and prioritizes mobile review", () => {
  assert.match(html, /id="review-previous"/);
  assert.match(html, /id="review-next"/);
  assert.match(html, /id="review-position" aria-live="polite"/);
  assert.match(html, /id="review-finish"[^>]*hidden/);
  assert.ok(html.indexOf('id="source-inspector"') < html.indexOf('id="evidence-feed"'));
  assert.match(script, /function visibleEvidenceItems\(\)/);
  assert.match(script, /function navigateEvidence\(delta\)/);
  assert.match(script, /state\.evidenceFilter=type;state\.referenceFilter='all';applyEvidenceFilters\(\)/);
  assert.match(script, /state\.evidenceFilter='all';state\.referenceFilter=key;applyEvidenceFilters\(\)/);
  assert.match(script, /if\(scrollToReview&&window\.matchMedia\('\(max-width: 800px\)'\)\.matches\)panel\.scrollIntoView/);
  assert.match(styles, /\.source-inspector,\.evidence-feed,\.source-rail\{grid-column:1;grid-row:auto\}/);
  assert.doesNotMatch(styles, /\.accept-button:after/);
  assert.doesNotMatch(script, /classList\.add\('is-refreshing'\)/);
});

test("desktop review keeps decisions in view and incomplete coverage is neutral", () => {
  assert.match(html, /class="inspector-body"/);
  assert.match(styles, /\.source-inspector\{min-width:0;max-height:calc\(100dvh - 108px\);display:flex;flex-direction:column;overflow:hidden\}/);
  assert.match(styles, /\.inspector-body\{min-height:0;overflow-y:auto/);
  assert.match(styles, /\.evidence-screen\.active:has\(\.evidence-card\) \.inspector-controls\{position:fixed/);
  assert.match(styles, /\.source-inspector\.motion-item\{animation:none!important/);
  assert.match(styles, /\.gap\{background:#a9a5df!important\}/);
  assert.match(html, /قابل للاستكمال/);
  assert.match(html, /تغطية المصادر المطلوبة/);
  assert.match(script, /عدم توفر دليل من هذا النوع ليس خطأً بحد ذاته/);
});

test("coverage renders an evidence-linked writing outline without claiming a generated sermon", () => {
  assert.match(html, /id="writing-outline-list"/);
  assert.match(html, /لا يولّد نص الخطبة/);
  assert.match(script, /زاوية المعالجة/);
  assert.match(script, /row\.included/);
  assert.match(script, /content_type==='ayah'\)return item\.record\.reference\?\.locator_ar/);
  assert.match(script, /item\.record\.source_family==='quran'\?item\.record\.text:evidenceTitle\(item\)/);
  assert.match(script, /ids\.length===1\?ids:\[\]/);
  assert.doesNotMatch(script, /return `سورة النساء، الآية \$\{item\.record\.metadata\.ayah\}`/);
});

test("user-facing exports include print-PDF and Word while retaining Markdown for audit", () => {
  assert.match(html, /data-export-format="print"/);
  assert.match(html, /data-export-format="word"/);
  assert.match(html, /data-export-format="markdown"/);
  assert.match(script, /application\/msword/);
  assert.match(script, /printWindow\.print/);
});
