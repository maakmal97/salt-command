import POSITION_ENGINE from "../engine/position.mjs";

export function makerStockCount(body) {
  if (!body || typeof body !== "object" || Array.isArray(body)
    || Object.keys(body).some((key) => !["at", "product", "date", "qty"].includes(key)))
    return { error: "A stock count carries only its timestamp, product, date and units." };
  if (typeof body.at !== "string" || !Number.isFinite(Date.parse(body.at)) || new Date(body.at).toISOString() !== body.at)
    return { error: "A stock count needs its canonical request timestamp." };
  if (typeof body.product !== "string" || !/^[a-z]{1,20}$/.test(body.product))
    return { error: "Choose a product." };
  if (typeof body.date !== "string" || !/^[0-9]{4}-[0-9]{2}-[0-9]{2}$/.test(body.date)
    || !Number.isFinite(Date.parse(body.date)) || new Date(body.date).toISOString().slice(0, 10) !== body.date)
    return { error: "A count needs a real date in YYYY-MM-DD." };
  if (typeof body.qty !== "number" || !Number.isFinite(body.qty) || body.qty < 0 || body.qty > 1000000)
    return { error: "Counted units must be a finite non-negative number." };
  return { entry: POSITION_ENGINE.stockCountEntry(body) };
}

export function makerKeyMatches(request, env) {
  const expected = String(env && env.COUNTER_MAKER_KEY || "");
  const supplied = String(request.headers.get("X-Counter-Maker-Key") || "");
  if (expected.length < 32 || supplied.length !== expected.length) return false;
  let different = 0;
  for (let i = 0; i < expected.length; i++) different |= expected.charCodeAt(i) ^ supplied.charCodeAt(i);
  return different === 0;
}

export function makerOrderFault(action, body) {
  if (!body || typeof body !== "object" || Array.isArray(body)) return "Send a JSON object.";
  const fields = {
    preview: ["delivery", "total"],
    accept: ["delivery", "total", "hash"],
    handed: ["qty", "close"],
    cash: ["amount"],
    received: ["amount", "claim", "covered"],
    again: ["stage"],
    amend: ["u", "product", "qty", "mode", "place", "forFriend", "rid", "week", "digest", "wantBy"]
  };
  if (!Object.hasOwn(fields, action) || Object.keys(body).some((key) => !fields[action].includes(key)))
    return "Unsupported order action fields.";
  if (action === "amend") {
    if (typeof body.u !== "string" || !/^[a-z0-9-]{1,40}$/.test(body.u)
      || typeof body.rid !== "string" || !/^[A-Za-z0-9_-]{16,64}$/.test(body.rid)
      || typeof body.digest !== "string" || !body.digest || body.digest.length > 128
      || typeof body.product !== "string" || !/^[a-z]{1,20}$/.test(body.product)
      || !(body.qty > 0) || typeof body.forFriend !== "boolean"
      || !["collect", "deliver"].includes(body.mode))
      return "An amendment needs the account, product, figures, mode, list digest and request id.";
    for (const key of ["place", "week", "wantBy"])
      if (body[key] !== undefined && (typeof body[key] !== "string" || body[key].length > 240))
        return "Amendment text fields must be bounded strings.";
  }
  for (const key of ["delivery", "total", "qty", "amount", "unit"]) {
    if (body[key] !== undefined && (typeof body[key] !== "number" || !Number.isFinite(body[key])
      || body[key] < 0 || body[key] > 1000000)) return "Order figures must be finite, non-negative numbers.";
  }
  if (body.close !== undefined && typeof body.close !== "boolean") return "Close must be a boolean.";
  if (body.covered !== undefined && typeof body.covered !== "boolean") return "Covered must be a boolean.";
  if (body.hash !== undefined && (typeof body.hash !== "string" || !/^[a-f0-9]{64}$/.test(body.hash)))
    return "Accept needs the preview digest.";
  if (body.claim !== undefined && (typeof body.claim !== "string" || !Number.isFinite(Date.parse(body.claim))))
    return "Claim must name its timestamp.";
  if (action === "accept" && body.hash === undefined) return "Accept needs the preview digest.";
  if (action === "handed" && body.qty === undefined) return "Say how many units were handed over.";
  if (["cash", "received"].includes(action) && !(body.amount > 0)) return "Say how much was received.";
  if (action === "again" && !["pay", "cash", "move", "cancel"].includes(body.stage)) return "Choose a stage to offer again.";
  return "";
}
