import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { gzipSync } from "node:zlib";
import {
  batchProfiles,
  extractProfile,
  profileUrl,
  parseProfile,
  decodeProfileResponse,
  loadProfile,
  MAX_BATCH_BYTES,
} from "../site/assets/common.mjs";
const block = (id, value = 1) =>
  `[metadata]\naccession\t${id}\nproject\tP\n\n[data]\nsubtype\tcopy\tabundance\nA|gene\t2\t${value}\n\n`;
test("three-digit batch URLs preserve zeros, Pages subpaths, and same-origin storage", () => {
  assert.equal(
    profileUrl(" drr000713 ", "https://u.github.io/repo/"),
    "https://u.github.io/repo/data/profiles/713.txt.gz",
  );
  assert.equal(
    profileUrl("ERR100001", "https://u.github.io/repo/"),
    "https://u.github.io/repo/data/profiles/001.txt.gz",
  );
  assert.throws(
    () => profileUrl("SRR71", "https://u.github.io/repo/"),
    /ending in digits/,
  );
});
test("full accession matching prevents suffix, prefix, and cross-prefix collisions", () => {
  const text =
    block("DRR000713") + block("SRR000713", 2) + block("SRR1000713", 3);
  assert.equal(
    parseProfile(extractProfile(text, "srr000713"), "SRR000713").total,
    2,
  );
  assert.equal(extractProfile(text, "DRR000713"), block("DRR000713"));
  assert.throws(() => extractProfile(text, "ERR000713"), /Accession not found/);
  assert.throws(
    () => extractProfile(text + block("SRR000713"), "SRR000713"),
    /Duplicate accession/,
  );
  assert.throws(
    () => [
      ...batchProfiles(
        block("SRR000713").replace("accession\tSRR000713\n", ""),
      ),
    ],
    /exactly one/,
  );
  const crlf = text.replaceAll("\n", "\r\n");
  assert.ok(extractProfile("\uFEFF" + crlf, "SRR000713").includes("\r\n"));
});
test("real repacked batch decodes with the browser API and uses [data]", async () => {
  const text = await decodeProfileResponse(
    new Response(
      await readFile(
        new URL("../site/data/profiles/713.txt.gz", import.meta.url),
      ),
    ),
    undefined,
    MAX_BATCH_BYTES,
  );
  assert.ok([...batchProfiles(text)].length > 1);
  const profile = parseProfile(extractProfile(text, "DRR000713"), "DRR000713");
  assert.equal(profile.rows.length, 7);
  assert.ok(profile.rawText.includes("[data]"));
  assert.equal(Object.fromEntries(profile.metadata).accession, "DRR000713");
});
test("cache stores only the selected profile and distinguishes accessions sharing a batch", async () => {
  globalThis.document = { baseURI: "https://u.github.io/repo/" };
  const cache = new Map();
  globalThis.sessionStorage = {
    getItem: (k) => cache.get(k),
    setItem: (k, v) => cache.set(k, v),
  };
  const original = globalThis.fetch;
  let calls = 0;
  try {
    globalThis.fetch = async () => {
      calls++;
      return new Response(gzipSync(block("DRR000713") + block("SRR000713", 2)));
    };
    assert.equal((await loadProfile("DRR000713")).total, 1);
    assert.equal((await loadProfile("drr000713")).total, 1);
    assert.equal(calls, 1);
    assert.equal((await loadProfile("SRR000713")).total, 2);
    assert.equal(calls, 2);
    const cached = JSON.parse([...cache.values()][0]);
    assert.equal(cached.id, "SRR000713");
    assert.equal(cached.text, block("SRR000713", 2));
    const abort = new AbortController();
    abort.abort();
    await assert.rejects(loadProfile("SRR000713", abort.signal), {
      name: "AbortError",
    });
  } finally {
    globalThis.fetch = original;
  }
});
test("new data format supports zero detections and explicitly unavailable abundance", () => {
  const empty = block("SRR000713").replace("A|gene\t2\t1\n", "");
  const p = parseProfile(empty, "SRR000713");
  assert.equal(p.total, 0);
  assert.equal(p.rows.length, 0);
  const unavailable = parseProfile(block("SRR000713", "n/a"), "SRR000713");
  assert.equal(unavailable.rows[0].abundance, null);
  assert.equal(unavailable.total, null);
  assert.equal(unavailable.typeCount, 1);
  assert.ok(unavailable.rawText.includes("\tn/a"));
});
