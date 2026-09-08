---
name: update-names-id
description: Update Names & ID. The owner's workflow for putting a real name against a roster code and getting it onto the phone, encrypted. Opens the local desk for him, waits while he edits, then seeds the vault. Use when he says "update names", "add a name to an ID", "update Names & ID" or asks to seed the vault. Laptop only.
---

# Update Names & ID

The owner's two-hand workflow, written down 28 Aug 2026 on his instruction. He types the name;
the agent does everything around it. The point of the shape is rule 2 of CLAUDE.md: **plaintext
names never reach the cloud.** The name goes into `salt_bio.json` on the laptop, and only the
AES-GCM ciphertext ever leaves, pushed by `tools/seed-vault.mjs`.

## Where this may run, and where it must not

- **A native Claude Code session on Windows, on the laptop, only.** The directory
  (`salt_bio.json`) and `serve_desk.py` exist nowhere else, by design.
- **Refuse from a cloud session**: there is no directory there to edit and nothing to serve.
  Say so and point him at the laptop.
- **No git anywhere in this workflow.** Nothing here touches a repo file: the directory sits
  outside the repo and the vault lives in KV. If the session is a mounted sandbox (Cowork),
  refuse entirely per CLAUDE.md; but since this workflow never runs git, the mount rule is
  belt and braces, not the reason.

## The steps

0. **Pull first (v528).** Names filed on the phone sit in the cloud vault until they are pulled:

   ```
   node tools/pull-vault.mjs
   ```

   It asks for the passphrase hidden, adds every code the directory lacks and never overwrites a
   name typed here. Skipping this and seeding would push the laptop's older directory over them.

1. **Open the desk.** Find `serve_desk.py`: repo root first, then the project folder beside it.
   Run it in the background (`python serve_desk.py`), read the port from its output, and give
   him the local URL with one line: open **Names & IDs**, type the name against the code, Save.
   Saving writes `salt_bio.json`. If `serve_desk.py` cannot be found, stop and ask where it is;
   do not improvise a server.

2. **Wait for his word.** He edits, the agent does nothing. Proceed only when he says it is
   done. Silence is not done.

3. **Seed the vault.** Tell him to run, in his own terminal (the serve_desk window or any
   PowerShell at the repo):

   ```
   node tools/seed-vault.mjs
   ```

   The tool prompts for the passphrase itself, hidden, asked twice, and pushes only the
   ciphertext envelope to KV. **The agent never asks for, receives, relays or stores the
   passphrase, and it must never be typed into the chat.** That is why the agent does not run
   this command itself: the prompt has to reach his fingers, not a transcript. (Unattended runs
   still work the old way, `SALT_VAULT_PASS` in the environment.)

4. **Prove it landed.** The agent fetches the live vault and checks the envelope is fresh:

   ```
   curl -s https://salt-command.qyts8mh72kyg.workers.dev/vault
   ```

   It must be `{updated, vault:{v,salt,iv,ct}, ids}` with `updated` within the last few
   minutes. Stale means the push failed; read the tool's own output, which names the fix
   (`npx wrangler whoami`, the KV id in `wrangler.jsonc`). Never print the envelope back into
   the conversation beyond the `updated` stamp and the count the tool reported.

5. **Close up.** Stop the `serve_desk.py` process if this workflow started it, unless he wants
   the desk left up. Then say it plainly: the name is in the directory, the ciphertext is in
   the cloud, and the desk shows it after the passphrase, hiding it again when the app leaves
   the foreground. Nothing was committed, because nothing in the repo changed.

## Why the passphrase step is his and stays his

The phone-side rule is that the passphrase never leaves the browser; the laptop-side rule is
the same one wearing gloves: it never enters the agent. A passphrase pasted into chat is a
passphrase in a stored transcript, which is the one place it can never be unsaid.
