import { JSDOM } from "jsdom";
import { webcrypto } from "node:crypto";
import { vaultDecrypt } from "../tools/seed-vault.mjs";
import { answerSheets, unlockPage } from "./maker-act.mjs";

export async function run({ ok, html, record, transport, pageWork }) {
  const saved=JSON.stringify(record),calls=[];
  let work,choice=false;
  /* the vault conflict asks on the page's Sheet (Phase 2c): `choice` is its answer, taken as it comes up */
  const boot=()=>answered(new JSDOM(html,{url:"https://site.test/all",runScripts:"dangerously",pretendToBeVisual:true,
    beforeParse(win){
      Object.defineProperty(win,"crypto",{value:webcrypto,configurable:true});
      win.TextEncoder=TextEncoder;win.TextDecoder=TextDecoder;win.scrollTo=()=>{};
      win.localStorage.setItem("saltMakerPending:"+record.path,saved);
      win.fetch=async(path,options)=>{
        if(path===record.path&&options?.method==="POST"){
          calls.push(JSON.parse(options.body));
          return {ok:true,status:200,json:async()=>({ok:true,draft:record.body.at})};
        }
        return transport(path,options);
      };
      work=pageWork(win);
    }}));
  const answered=(dom)=>{answerSheets(dom.window,[],()=>choice);return dom;};
  let dom=boot();
  try{
    const doc=dom.window.document;
    doc.querySelector('button[data-act="nav.record"]').click();await work.quiet();
    const recovery=[...doc.querySelectorAll("#makerInputs .maker-input")]
      .find(section=>section.querySelector("h3")?.textContent==="Unsent entry");
    ok(!!recovery&&!saved.includes("Zora")&&!saved.includes("name-pass"),
      "a fresh Counter page restores a ciphertext-only retained input without opened names or passphrase");
    if(!recovery)return;
    const retry=[...recovery.querySelectorAll("button")].find(button=>button.textContent==="Send again");
    retry.click();await work.quiet();
    ok(calls.length===0&&dom.window.localStorage.getItem("saltMakerPending:"+record.path)===saved,
      "Counter reload refuses a locked retry and retains its exact ciphertext and timestamp");
    /* the one unlock (Phase 4b) replaces the unsent entry's own field: a password that opens nothing leaves the page locked, so the entry is neither sent nor cleared */
    await unlockPage(dom.window,work,"wrong-pass");
    retry.click();await work.quiet();
    ok(calls.length===0&&dom.window.localStorage.getItem("saltMakerPending:"+record.path)===saved
      &&/Locked/.test(recovery.textContent)&&/did not open/.test(doc.getElementById("vaultSay").textContent),
      "Counter reload proves the password opens the vault before sending; a wrong password leaves the page locked and neither sends nor clears the entry");
    await unlockPage(dom.window,work,"name-pass");
    retry.click();await work.quiet();
    ok(calls.length===1&&JSON.stringify(calls[0])===JSON.stringify(record.body)
      &&!dom.window.localStorage.getItem("saltMakerPending:"+record.path),
      "Counter reload unlocks and sends the original request byte-shape unchanged, clearing storage only on confirmed completion");
    dom.window.close();dom=boot();
    dom.window.document.querySelector('button[data-act="nav.record"]').click();await work.quiet();
    const reviewed=[...dom.window.document.querySelectorAll("#makerInputs .maker-input")]
      .find(section=>section.querySelector("h3")?.textContent==="Unsent entry");
    if(!reviewed){ok(false,"reloaded Counter exposes conflict review for its retained encrypted intent");return;}
    const review=[...reviewed.querySelectorAll("button")].find(button=>button.textContent==="Update and send");
    await unlockPage(dom.window,work,"name-pass");review.click();await work.quiet();
    ok(calls.length===1&&dom.window.localStorage.getItem("saltMakerPending:"+record.path)===saved,
      "reloaded Counter overlap Cancel retains its encrypted intent and submits no replacement request");
    choice=true;review.click();await work.quiet();
    const rebased=calls[1],names=rebased?await vaultDecrypt("name-pass",rebased.pair.names):{};
    ok(calls.length===2&&rebased.at!==record.body.at&&rebased.pair.expectedRevision===11
      &&names["CZ4-PUD"]==="Zora (Pudu)"&&names["CX9-FIK"]==="Invented remote"
      &&!dom.window.localStorage.getItem("saltMakerPending:"+record.path),
      "reloaded Counter explicitly reviews encrypted intent against the latest pair, preserving remote entries under a new request identity");
    dom.window.close();dom=boot();
    dom.window.document.querySelector('button[data-act="nav.record"]').click();await work.quiet();
    const cancelled=[...dom.window.document.querySelectorAll("#makerInputs .maker-input")]
      .find(section=>section.querySelector("h3")?.textContent==="Unsent entry");
    const cancel=[...(cancelled?.querySelectorAll("button")||[])].find(button=>button.textContent==="Discard");
    cancel?.click();await work.quiet();
    ok(!!cancel&&calls.length===2&&!dom.window.localStorage.getItem("saltMakerPending:"+record.path),
      "Counter explicit local cancellation clears a reloaded request without submitting or withdrawing a server row");
  }finally{dom.window.close();}
}
