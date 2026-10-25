# The nightly backup of D1's decisions (S0b)

**Live since v1251 (25 Oct 2026)**: `src/backup.js`, `tools/backup-key.mjs`, `tools/backup-open.mjs`, tests `backup*.mjs`. The bucket `salt-d1-backup`, the key
and the cron below were set up that day, each on his yes; the first backup was filed by hand that morning and the cron's first night is 02:30 on 26 Oct.
With no bucket or no public key bound the job does nothing, which is also how a rebuild on a fresh account starts.

## What it does

Once a night, at 18:30 UTC (02:30 in Kuala Lumpur), the Desk Worker reads nine D1 tables in one batch (one transaction): `draft`,
`refused`, `preapproval`, `maker_request`, `input_admission`, `input_admission_source`, `vault_pair`, `vault_receipt`, `vault_outbox`.
It seals them to a public key it holds and files the ciphertext in R2 as `backup/<Kuala Lumpur date>.json`. The newest 30 stay.
The private half is on his laptop, sealed under the vault passphrase, so nothing on Cloudflare can open a backup. Not backed up:
`entry`, `state` and `snapshot` (the mirror of git's book, re-seeded at every fold) and the vault's write-gate flags (a restored
flag would lock the database).

The object is read back for its size before the night counts. The result, good or bad, is KV `backup:last` on the Desk's namespace,
and the 09:00 digest pushes when the last backup failed, never ran, or is more than 36 hours old. It stays silent until a bucket is
bound.

## How it was turned on (his terminal, in this order; the same for a rebuild)

1. The bucket. `npx wrangler r2 bucket create salt-d1-backup`. If R2 is not enabled on the account, wrangler says so first.
2. The key. `node tools/backup-key.mjs` asks for the vault passphrase (hidden, twice), writes `10_Data\salt_backupkey.json` and prints
   the public half as one quoted line. Keep a copy of that file off the laptop's disk: it is ciphertext, and without it or the
   passphrase no backup can be opened.
3. The config, in `wrangler.jsonc`, all three together (a test pins that the cron and the bucket arrive as a pair):

   ```
   "r2_buckets": [{ "binding": "BACKUP", "bucket_name": "salt-d1-backup" }],
   "triggers": { "crons": ["* * * * *", "0 1 * * *", "30 18 * * *"] },
   "vars": { ... "BACKUP_PUBLIC_JWK": "<the quoted line from step 2>" }
   ```

4. Deploy the Desk Worker (a `wrangler.jsonc` change does not move `rev.json`'s id): `npx wrangler deploy`.
5. Prove it. After 02:30, or from the dashboard's cron trigger test:
   `npx wrangler kv key get backup:last --binding SALT_QUEUE --remote` must say `"ok":true` with a key and a byte count.

## The drill (do it once before trusting it, and again after any change to the tables)

```
npx wrangler r2 object get salt-d1-backup/backup/<date>.json --file <backup.json> --remote
node tools/backup-open.mjs <backup.json> --sql <restore.sql>
```

The first line fetches one night; the second asks for the passphrase, prints each table's row count and writes a restore script of
INSERT statements, parents before children. Both outputs are plaintext decisions: write them under `test\tmp` or `%TEMP%`, never into
the repo, and delete them afterwards. Run the script into a scratch D1 or a local copy first and compare it with the live tables
(`npx wrangler d1 execute <db> --file <restore.sql>`). Without `--replace` it only inserts, so it stops at the first row that
already exists; with `--replace` it deletes the nine tables first, children first, and is destructive by design. A restore into the
live database is a decision of his, never a routine. The suite runs the same drill against a real SQLite on every run
(`test/backup-tools.mjs`).

## Losing the key

A new key (`node tools/backup-key.mjs --force`) leaves every backup sealed to the old one unreadable, so it is refused unasked and the
old file is kept aside. If the file and the passphrase are both lost, the backups are noise; the D1 decisions themselves are
unaffected.
