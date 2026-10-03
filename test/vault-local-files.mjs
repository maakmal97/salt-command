import { mkdtempSync, readFileSync, writeFileSync, existsSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import { lockVaultFiles, vaultFilesReady, withVaultFiles, recoverLocalVaultFiles } from "../tools/vault-local-files.mjs";

export async function run({ ok }) {
  const dir=mkdtempSync(join(tmpdir(),"salt-local-pair-"));
  try {
    const value={bio:{bio:{"CX1-ZED":{raw:"Invented pair"}}},addr:{addr:{"CX1-ZED":{lat:3.1,lng:101.7}}},
      pair:{revision:4,names:{ct:"ciphertext"},places:{ct:"places ciphertext"}}};
    const lock=lockVaultFiles(dir);
    let concurrent=false;
    try{lockVaultFiles(dir);}catch(error){concurrent=/Another process/.test(error.message);}
    ok(concurrent,"local pair lock excludes a concurrent seed/pull reader before any pair file access");
    writeFileSync(join(dir,"salt_bio.json"),JSON.stringify({bio:{}}));
    writeFileSync(join(dir,"salt_addr.json"),JSON.stringify({addr:{}}));
    for(const tool of ["seed-vault","pull-vault"]){
      const child=spawnSync(process.execPath,[fileURLToPath(new URL("../tools/"+tool+".mjs",import.meta.url)),"--dry-run"],{
        encoding:"utf8",timeout:30000,env:{...process.env,SALT_DATA:dir,SALT_VAULT_PASS:"invented-local-lock-pass",SALT_BASE:"http://127.0.0.1:1"}
      });
      ok(child.status!==0&&/Another process holds/.test(child.stderr),
        "actual "+tool+" CLI refuses an active pair-file lock before any local read or remote operation");
    }
    let interrupted=false;
    try{lock.commit(value,()=>{throw new Error("fixture interrupted pull");});}catch(error){interrupted=error.message==="fixture interrupted pull";}
    lock.release();
    let refuses=false;
    try{vaultFilesReady(dir);}catch(error){refuses=/recovery/.test(error.message);}
    ok(interrupted&&refuses&&existsSync(join(dir,"salt_vault_files.journal"))
      &&!existsSync(join(dir,"salt_vault_pair.json")),
      "an interrupted first pair rename leaves a durable journal and refuses mixed-revision readers");
    const reader=spawnSync(process.execPath,[fileURLToPath(new URL("../tools/ledger.mjs",import.meta.url)),"--check"],{
      encoding:"utf8",timeout:30000,env:{...process.env,SALT_DATA:dir}
    });
    ok(reader.status!==0&&/locked or needs recovery/.test(reader.stderr),
      "the actual ledger leak-check consumer refuses a partial local pair revision until journal recovery completes");
    const recovery=spawnSync(process.execPath,[fileURLToPath(new URL("../tools/vault-local-files.mjs",import.meta.url)),
      "--recover","--directory",dir],{encoding:"utf8",timeout:30000});
    ok(recovery.status===0&&/journal recovered/.test(recovery.stdout),
      "the explicit local recovery CLI completes a partial pair-file transaction without a remote operation");
    await withVaultFiles(dir,async()=>{
      const read=file=>existsSync(join(dir,file))?JSON.parse(readFileSync(join(dir,file),"utf8")):{};
      ok(read("salt_bio.json").bio?.["CX1-ZED"]?.raw==="Invented pair"
        &&read("salt_addr.json").addr?.["CX1-ZED"]?.lat===3.1
        &&read("salt_vault_pair.json").revision===4,
        "startup recovery rolls all pair files to the journaled revision before allowing a seed or pull consumer");
    });
    ok(!existsSync(join(dir,"salt_vault_files.lock"))&&!existsSync(join(dir,"salt_vault_files.journal")),
      "verified pair-file recovery releases the exclusive lock and removes the completed journal");
    writeFileSync(join(dir,"salt_vault_files.lock"),JSON.stringify({pid:2147483647}));
    await withVaultFiles(dir,async()=>{});
    ok(!existsSync(join(dir,"salt_vault_files.lock")),
      "startup can reclaim a proven-dead process lock without stealing an active writer");
    const guard=join(dir,"salt_vault_files.lock.recovery");
    writeFileSync(guard,JSON.stringify({pid:2147483647}));
    let unreviewed=false;
    try{await recoverLocalVaultFiles(dir);}catch(error){unreviewed=/Pause all local writers/.test(error.message);}
    await recoverLocalVaultFiles(dir,true);
    ok(unreviewed&&!existsSync(guard),
      "an abandoned recovery guard needs explicit writers-paused review before local recovery may remove it");
    writeFileSync(guard,JSON.stringify({pid:process.pid}));
    let activeRefused=false;
    try{await recoverLocalVaultFiles(dir,true);}catch(error){activeRefused=/active process/.test(error.message);}
    ok(activeRefused&&existsSync(guard),
      "even reviewed recovery refuses to steal an active process's recovery guard");
  } finally { rmSync(dir,{recursive:true,force:true}); }
}
