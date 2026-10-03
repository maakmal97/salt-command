import { webcrypto } from "node:crypto";
import { MAKER_GEO_JS } from "../stmt/maker-geo.js";
import { openMaster } from "../tools/payload.mjs";

export async function run({ ok }) {
  const geo = new Function("crypto", "TextEncoder", "return " + MAKER_GEO_JS)(webcrypto, TextEncoder);
  const { w: desk } = await openMaster();
  try {
    Object.defineProperty(desk, "crypto", { value: webcrypto, configurable: true });
    desk.TextEncoder = TextEncoder;
    geo.configure(JSON.parse(desk.eval("JSON.stringify(PLACED)")));
    const incumbent = JSON.parse(desk.eval("JSON.stringify([...placePicks()])"));
    ok(JSON.stringify([...geo.picks()]) === JSON.stringify(incumbent),
      "Counter official picks match every incumbent locality, label and point including filed localities");
    for (const text of ["Pudu", "Ampang, KL", "Ampang, Selangor", "Unknown invented locality"]) {
      desk.eval("window.__makerPlace=null;placeFromText(" + JSON.stringify(text)
        + ").then(function(value){window.__makerPlace=value;})");
      for (let tries = 0; tries < 200 && !desk.__makerPlace; tries++)
        await new Promise((resolve) => setTimeout(resolve, 1));
      if (!desk.__makerPlace) throw new Error("Incumbent place lookup did not finish.");
      const expected = JSON.parse(JSON.stringify(desk.__makerPlace));
      ok(JSON.stringify(await geo.find(text)) === JSON.stringify(expected),
        "Counter locality lookup shares the incumbent official/gazetteer result for " + text);
    }
    const fixtures = [
      ["Secret Way https://waze.com/ul?ll=3.123456,101.654321", "waze", 3.123456, 101.654321, "Secret Way"],
      ["https://www.google.com/maps/place/Invented+Road/data=!3d3.234567!4d101.765432", "google", 3.234567, 101.765432, "Invented Road"],
      ["https://waze.com/ul/hw283", "waze", null, null, null],
      ["https://maps.app.goo.gl/AbC123", "short", null, null, null]
    ];
    ok(fixtures.every(([link, src, lat, lng, addr]) => {
      const value = geo.link(link);
      const expected = JSON.parse(desk.eval("JSON.stringify(mapsLink(" + JSON.stringify(link) + "))"));
      return JSON.stringify(value) === JSON.stringify(expected) && (src === "short" ? !!value.short
        : value.src === src && (lat == null ? Number.isFinite(value.lat)
          : value.lat === lat && value.lng === lng && value.addr === addr));
    }) && geo.link("https://evil.test/maps?ll=3,101") === null,
    "Counter reads Maps pins, Waze points/geohashes and short-link shape on-device through the incumbent parser only");
  } finally { desk.close(); }
}
