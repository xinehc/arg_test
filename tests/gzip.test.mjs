import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { gzipSync, gunzipSync } from "node:zlib";
import {
  extractProfile,
  parseProfile,
  decodeProfileResponse,
  loadProfile,
} from "../site/assets/common.mjs";
const txt = extractProfile(
  gunzipSync(
    await readFile(
      new URL("../site/data/profiles/713.txt.gz", import.meta.url),
    ),
  ).toString("utf8"),
  "DRR000713",
);
const gz = gzipSync(txt);
const suppliedMetadata = txt
  .split("[data]")[0]
  .split(/\r?\n/)
  .filter((line) => line.includes("\t"))
  .map((line) => line.split("\t"));
test("uploaded gzip decodes and preserves all metadata fields and seven abundance rows", async () => {
  const text = await decodeProfileResponse(new Response(gz));
  assert.equal(text, txt);
  const p = parseProfile(text, "DRR000713"),
    m = Object.fromEntries(p.metadata);
  assert.deepEqual(p.metadata, suppliedMetadata);
  assert.equal(m.sample, "SAMD00008644");
  assert.equal(m.spot_length, "80");
  assert.equal(m.published, "2012-02-20 22:01:22");
  assert.equal(p.rows.length, 7);
  assert.equal(p.typeCount, 5);
  assert.equal(p.rows[5].type, "multidrug@RND");
  assert.equal(p.rows[5].subtype, "mexI");
  assert.equal(p.rawText, txt);
});
test("already-decompressed fetch body is not decompressed twice", async () =>
  assert.equal(
    await decodeProfileResponse(
      new Response(txt, { headers: { "Content-Encoding": "gzip" } }),
    ),
    txt,
  ));
test("damaged gzip and excessive expansion fail clearly", async () => {
  await assert.rejects(
    decodeProfileResponse(new Response(gz.subarray(0, 40))),
    /damaged/,
  );
  await assert.rejects(
    decodeProfileResponse(new Response(gzipSync("a".repeat(5_000_001)))),
    /5 MB/,
  );
});
test("header optional; new metadata fields preserved; malformed records rejected", () => {
  const p = parseProfile(
    txt.replace("[metadata]", "[metadata]\nfield\tvalue\nnew_field\t<sample>"),
    "DRR000713",
  );
  assert.deepEqual(p.metadata[0], ["new_field", "<sample>"]);
  assert.throws(
    () =>
      parseProfile(
        txt.replace("accession\tDRR000713", "accession\tOTHER"),
        "DRR000713",
      ),
    /does not match/,
  );
  assert.throws(
    () =>
      parseProfile(
        txt.replace("[metadata]", "[metadata]\nproject\tduplicate"),
        "DRR000713",
      ),
    /Duplicate/,
  );
  assert.throws(
    () =>
      parseProfile(
        txt.replace("[metadata]", "[metadata]\nbad row"),
        "DRR000713",
      ),
    /tab-separated/,
  );
  assert.throws(
    () => parseProfile(txt.replace("[data]", "[wrong]"), "DRR000713"),
    /section/,
  );
});
test("loader requests exact gz URL and returns metadata from the same response", async () => {
  globalThis.document = { baseURI: "https://user.github.io/repo/" };
  globalThis.sessionStorage = { getItem: () => null, setItem: () => {} };
  const old = globalThis.fetch;
  let calls = 0;
  try {
    globalThis.fetch = async (url) => {
      calls++;
      assert.equal(url, "https://user.github.io/repo/data/profiles/713.txt.gz");
      return new Response(gzipSync(txt));
    };
    const p = await loadProfile("drr000713");
    assert.deepEqual(p.metadata, suppliedMetadata);
    assert.equal(calls, 1);
  } finally {
    globalThis.fetch = old;
  }
});
