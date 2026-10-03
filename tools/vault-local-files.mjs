import { existsSync, readFileSync, openSync, writeFileSync, fsyncSync, closeSync, renameSync, unlinkSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

const files = ["salt_bio.json", "salt_addr.json", "salt_vault_pair.json"];
const lockName = "salt_vault_files.lock", journalName = "salt_vault_files.journal";
function durable(file, text, exclusive = false) {
  const fd = openSync(file, exclusive ? "wx" : "w", 0o600);
  try { writeFileSync(fd, text); fsyncSync(fd); } finally { closeSync(fd); }
}
export function vaultFilesReady(dir) {
  if ([lockName,lockName+".recovery",journalName].some(file=>existsSync(join(dir,file))))
    throw new Error("The local vault pair is locked or needs recovery. Run pull-vault before reading or seeding it.");
}
export function lockVaultFiles(dir) {
  const path = join(dir, lockName);
  const guard = path + ".recovery";
  const guardFd = openSync(guard, "wx", 0o600);
  try {
    writeFileSync(guardFd, JSON.stringify({ pid: process.pid }));fsyncSync(guardFd);
    if (existsSync(path)) {
    const owner = JSON.parse(readFileSync(path, "utf8"));
    if (!Number.isSafeInteger(owner.pid) || owner.pid <= 0) throw new Error("The vault file lock is invalid; reviewed recovery is required.");
    let alive = true;
    try { process.kill(owner.pid, 0); } catch (error) { if (error.code === "ESRCH") alive = false; else throw error; }
    if (alive) throw new Error("Another process holds the local vault files. Wait for it before retrying.");
    unlinkSync(path);
    }
    durable(path, JSON.stringify({ pid: process.pid }), true);
  } finally { closeSync(guardFd); unlinkSync(guard); }
  const journal = join(dir, journalName);
  const recover = (afterWrite = () => {}) => {
    if (!existsSync(journal)) return;
    const data = JSON.parse(readFileSync(journal, "utf8"));
    if (data.v !== 1 || files.some((file) => typeof data.files?.[file] !== "string")
      || Object.keys(data.files).length !== files.length) throw new Error("The local vault journal is invalid; nothing may read this pair.");
    for (const file of files) {
      const temp = join(dir, file + ".pair-next");
      durable(temp, data.files[file]);
      renameSync(temp, join(dir, file));
      afterWrite(file);
    }
    unlinkSync(journal);
  };
  return {
    recover,
    commit({ bio, addr, pair }, afterWrite) {
      if (existsSync(journal)) throw new Error("Recover the prior local pair before another pull.");
      durable(journal, JSON.stringify({ v: 1, files: Object.fromEntries(
        files.map((file, index) => [file, JSON.stringify([bio, addr, pair][index], null, 2) + "\n"])) }), true);
      recover(afterWrite);
    },
    release() { if (existsSync(path)) unlinkSync(path); }
  };
}
export async function withVaultFiles(dir, action) {
  const lock = lockVaultFiles(dir);
  const release = () => lock.release();
  process.once("exit", release);
  try { lock.recover(); return await action(lock); }
  finally { process.off("exit", release); lock.release(); }
}
export async function recoverLocalVaultFiles(dir, writersPaused = false) {
  const guard = join(dir, lockName + ".recovery");
  if (existsSync(guard)) {
    if (!writersPaused) throw new Error("A recovery guard remains. Pause all local writers and explicitly review --writers-paused.");
    let owner;
    try { owner = JSON.parse(readFileSync(guard, "utf8")); } catch { owner = null; }
    if (Number.isSafeInteger(owner?.pid) && owner.pid > 0) {
      try { process.kill(owner.pid, 0); throw new Error("The recovery guard belongs to an active process."); }
      catch (error) { if (error.code !== "ESRCH") throw error; }
    }
    unlinkSync(guard);
  }
  return withVaultFiles(dir, async () => ({ ok: true }));
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const dirIndex = process.argv.indexOf("--directory");
  if (!process.argv.includes("--recover") || dirIndex < 0 || !process.argv[dirIndex + 1]) {
    console.error("Use --recover --directory <local-data-folder> [--writers-paused]. No remote operation occurs.");
    process.exitCode = 2;
  } else recoverLocalVaultFiles(process.argv[dirIndex + 1], process.argv.includes("--writers-paused"))
    .then(() => console.log("Local pair-file journal recovered and lock released. No remote operation occurred."))
    .catch(error => { console.error(error.message); process.exitCode = 1; });
}
