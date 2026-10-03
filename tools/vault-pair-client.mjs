import { sealedVaultEnvelope } from "../src/vault-pair.js";
import "./cloudflare.mjs";
import E from "../engine/position.mjs";

export const vaultMapMerge = E.vaultMapMerge;

export function pairClient({ base, writeKey, accessToken, fetch: transport = globalThis.fetch }) {
  if (!writeKey) throw new Error("Set SALT_WRITE_KEY in the environment for the keyed pair; it is never written to a file.");
  const headers = { "X-Salt-Key": writeKey, "content-type": "application/json",
    ...(accessToken ? { "Cf-Access-Jwt-Assertion": accessToken } : {}) };
  const call = async (method, body) => {
    const response = await transport(new Request(base.replace(/\/+$/, "") + "/vault/pair", {
      method, headers, cache: "no-store", ...(body ? { body: JSON.stringify(body) } : {})
    }));
    const result = await response.json();
    if (!response.ok || result?.ok !== true) throw Object.assign(new Error(result?.error || "The versioned vault did not answer."),
      { status: response.status, detail: result });
    return result;
  };
  return {
    async read() {
      const pair = await call("GET");
      if (!Number.isSafeInteger(pair.revision) || pair.revision < 1 || !sealedVaultEnvelope(pair.names)
        || pair.places !== null && !sealedVaultEnvelope(pair.places))
        throw new Error("The pair read has an invalid revision or ciphertext envelope.");
      return pair;
    },
    write: (body) => call("POST", body)
  };
}

export async function readVaultAuthority(base, transport = globalThis.fetch, accessToken) {
  const response = await transport(new Request(base.replace(/\/+$/, "") + "/vault", {
    cache: "no-store", headers: accessToken ? { "Cf-Access-Jwt-Assertion": accessToken } : {}
  }));
  const reading = await response.json();
  if (!response.ok || !reading || reading.ok !== true)
    throw new Error(reading?.error || "The live vault authority could not be read. No writer may run blind.");
  return { pair: Object.hasOwn(reading, "revision"), reading };
}
