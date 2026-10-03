import { readFileSync, writeFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import ts from "typescript";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const OUT = resolve(ROOT, "stmt", "maker-geo.js");
export function makerGeoText(master) {
  const scripts = [...master.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/gi)]
    .map((match) => match[1]).join("\n");
  const tree = ts.createSourceFile("desk.js", scripts, ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);
  const named = (name, kind) => {
    const hits = [];
    const walk = (node) => {
      if (kind(node) && node.name?.getText(tree) === name) hits.push(node);
      ts.forEachChild(node, walk);
    };
    walk(tree);
    if (hits.length !== 1) throw new Error("Expected one incumbent geography declaration: " + name);
    return hits[0].getText(tree);
  };
  const fn = (name) => named(name, ts.isFunctionDeclaration);
  const constant = (name) => "const " + named(name, ts.isVariableDeclaration) + ";";
  const position = ["PLACE_ABBR", "PLACE_GENERIC"].map(constant)
    .concat(["placeKey", "placeBare", "placeCandidates"].map(fn)).join("\n");
  const data = ["AREAS", "DISTRICTS", "PLACE_LIST", "GAZ", "PLACE_WORDS"].map(constant).join("\n");
  const functions = ["decodeRing", "areaShape", "inShape", "areaOf", "placeWords", "placePicks",
    "gazDecode", "areaKeys", "sha7", "placeWithin", "placeFromText", "mapsLink", "geohashPoint"].map(fn).join("\n");
  const script = "(function(){\n" + data + "\n"
    + "const POSITION_ENGINE=(function(){\n" + position + "\nreturn {placeKey,placeCandidates};})();\n"
    + "let PLACED={},AREA_SHAPES={},AREA_KEYS=null,GAZ_INDEX=null;\n"
    + constant("placeTidy") + "\n" + constant("areaName") + "\n" + constant("gazIndex") + "\n"
    + functions + "\n" + fn("vaultMapMerge") + "\n" + fn("vaultRekeyMap") + "\n" + fn("vaultPendingOk")
    + "\nreturn {configure:function(places){PLACED=places||{};},picks:placePicks,find:placeFromText,link:mapsLink,merge:vaultMapMerge,rekey:vaultRekeyMap,pendingOk:vaultPendingOk};\n})()";
  return "// GENERATED from the incumbent Desk geography by tools/maker-geosync.mjs; never edit.\n"
    + "export const MAKER_GEO_JS = " + JSON.stringify(script) + ";\n";
}
export function syncMakerGeo(master) {
  writeFileSync(OUT, makerGeoText(master));
}
export function checkMakerGeo(master) {
  return readFileSync(OUT, "utf8") === makerGeoText(master);
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const master = readFileSync(resolve(ROOT, "master", "salt_command.html"), "utf8");
  if (process.argv.includes("--sync")) syncMakerGeo(master);
  else if (!checkMakerGeo(master)) throw new Error("Counter geography differs from Desk; run maker-geosync --sync.");
}
