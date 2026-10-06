import POSITION_ENGINE from "../engine/position.mjs";

export function makerCommunicationFault(kind, body) {
  if (!body || typeof body !== "object" || Array.isArray(body)) return "Send a JSON object.";
  if (kind === "thread") {
    if (Object.keys(body).some((key) => !["rid", "message", "noReply"].includes(key))
      || typeof body.rid !== "string" || !/^[A-Za-z0-9_-]{16,64}$/.test(body.rid))
      return "A reply needs its fixed request id and only message or noReply.";
    if (body.noReply === true && body.message === undefined) return "";
    if (body.noReply !== undefined || typeof body.message !== "string"
      || !body.message.trim() || body.message.length > 200)
      return "Send one nonempty message of at most 200 characters, or noReply.";
    return "";
  }
  if (kind === "bulletin") {
    if (Object.keys(body).some((key) => !["lines", "confirmed"].includes(key))
      || !Array.isArray(body.lines) || body.lines.length > 8
      || body.lines.some((line) => typeof line !== "string" || !line.trim() || line.length > 120))
      return "A notice holds at most eight nonempty lines of 120 characters each.";
    if (body.lines.length && body.confirmed !== true) return "Confirm before waking every customer.";
    if (body.confirmed !== undefined && typeof body.confirmed !== "boolean") return "Confirmation must be a boolean.";
    return "";
  }
  return "That communication action is not available.";
}

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
    handed: ["qty", "close", "rid"],
    cash: ["amount", "rid"],
    received: ["amount", "claim", "covered", "rid"],
    again: ["stage", "rid"],
    restate: ["qty", "total", "delivery", "rid"],
    notfound: ["rid", "claim", "amount"],
    move: ["rid", "status", "note", "message", "noReply", "mode"],
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
  if (action === "restate" && body.qty === undefined && body.total === undefined && body.delivery === undefined) return "Say which figure changes.";
  if (action === "restate" && (body.qty !== undefined && !(body.qty > 0) || body.total !== undefined && !(body.total > 0))) return "A size and a price are above nothing.";
  if (action === "handed" && body.qty === undefined) return "Say how many units were handed over.";
  if (["cash", "received"].includes(action) && !(body.amount > 0)) return "Say how much was received.";
  if (action === "again" && !["pay", "cash", "move", "cancel", "amend"].includes(body.stage)) return "Choose a stage to offer again.";
  if (["notfound", "move", "handed", "again", "cash", "received", "restate"].includes(action)
    && (typeof body.rid !== "string" || !/^[A-Za-z0-9_-]{16,64}$/.test(body.rid)))
    return "Send the action's immutable request id.";
  if (action === "notfound" && (body.claim === undefined || !(body.amount > 0)))
    return "Name the claim and its amount.";
  if (action === "move") {
    const kinds = [body.status !== undefined, body.message !== undefined, body.noReply !== undefined].filter(Boolean).length;
    if (kinds !== 1) return "Send one move: a status, a reply, or No reply needed.";
    if (body.status !== undefined && !["ready", "declined", "cancelled"].includes(body.status))
      return "Choose Ready, Decline or Cancel.";
    if (body.message !== undefined && (typeof body.message !== "string" || !body.message.trim() || body.message.length > 200))
      return "A reply is 1 to 200 characters.";
    if (body.noReply !== undefined && body.noReply !== true) return "No reply needed is true or absent.";
    if (body.note !== undefined && (!["declined", "cancelled"].includes(body.status)
      || typeof body.note !== "string" || !body.note.trim() || body.note.length > 140))
      return "A reason goes only with Decline or Cancel, up to 140 characters.";
    if (body.mode !== undefined && (body.status !== "ready" || !["collect", "deliver"].includes(body.mode)))
      return "Collected or delivered goes only with Ready.";
  }
  return "";
}
