import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const html = readFileSync(new URL("../apps/web/dist/index.html", import.meta.url), "utf8");
const js = readFileSync(new URL("../apps/web/dist/app.js", import.meta.url), "utf8");
const css = readFileSync(new URL("../apps/web/dist/styles.css", import.meta.url), "utf8");

test("both optional brief questions share one closed disclosure after the core fields", () => {
  const coreFields = html.indexOf('class="brief-row"');
  const disclosure = html.indexOf('<details class="brief-optional" id="brief-optional">');
  const audienceDetail = html.indexOf('id="context-detail"');
  const instruction = html.indexOf('<section class="instruction-choice" id="instruction-choice"');
  const footer = html.indexOf('class="brief-footer"');
  assert.ok(coreFields >= 0 && coreFields < disclosure);
  assert.ok(disclosure < audienceDetail && audienceDetail < instruction && instruction < footer);
  assert.match(html.slice(disclosure, footer), /id="optional-summary"/u);
  assert.doesNotMatch(html.slice(disclosure, audienceDetail), /\bopen\b/u);
});

test("optional answers remain visible in the closed summary and invalid instructions reopen it", () => {
  assert.match(js, /if\(qs\('#context-detail'\)\.value\.trim\(\)\)details\.push\('تفصيل الجمهور محفوظ'\)/u);
  assert.match(js, /details\.push\('تعميم رسمي مضاف'\)/u);
  assert.match(js, /addEventListener\('invalid',event=>\{if\(qs\('#brief-optional'\)\.contains\(event\.target\)\)qs\('#brief-optional'\)\.open=true\},true\)/u);
  assert.match(css, /\.brief-optional>summary:focus-visible/u);
});
