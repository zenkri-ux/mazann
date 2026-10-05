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
  assert.match(html, /id="evidence-use-text"/);
  assert.match(html, /id="open-coverage"[^>]*disabled/);
  assert.match(script, /const ready=total>0&&state\.reviewed===total/);
  assert.match(script, /evidenceUseLabel\(item\)/);
});

test("coverage renders an evidence-linked writing outline without claiming a generated sermon", () => {
  assert.match(html, /id="writing-outline-list"/);
  assert.match(html, /لا يولّد نص الخطبة/);
  assert.match(script, /زاوية المعالجة/);
  assert.match(script, /row\.included/);
  assert.match(script, /content_type==='ayah'\)return item\.record\.reference\?\.locator_ar/);
  assert.doesNotMatch(script, /return `سورة النساء، الآية \$\{item\.record\.metadata\.ayah\}`/);
});

test("user-facing exports include print-PDF and Word while retaining Markdown for audit", () => {
  assert.match(html, /data-export-format="print"/);
  assert.match(html, /data-export-format="word"/);
  assert.match(html, /data-export-format="markdown"/);
  assert.match(script, /application\/msword/);
  assert.match(script, /printWindow\.print/);
});
