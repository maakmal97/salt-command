import io

p = ".github/workflows/cloud-commit.yml"
s = io.open(p, encoding="utf-8").read()

old = """      - name: Wake the phone
        if: ${{ secrets.SALT_WRITE_KEY != '' }}
        continue-on-error: true
        run: |
          set -euo pipefail
          if [ ! -f master/_folded.json ]; then echo "No fold in this build; not waking anyone."; exit 0; fi"""

new = """      # THE SECRET IS TESTED IN THE SHELL, NOT IN `if:`. The first version wrote
      # `if: ${{ secrets.SALT_WRITE_KEY != '' }}` and GitHub REJECTED THE WHOLE FILE, because
      # the `secrets` context is not available in an if condition. The run had zero jobs, no
      # logs, and was named by its file path rather than "Cloud commit", which is the tell that
      # a workflow failed to PARSE rather than failed to run. It emailed, at least, so it was
      # loud. But it meant the stage and deploy jobs were dead from the moment it was added.
      - name: Wake the phone
        continue-on-error: true
        env:
          SALT_KEY: ${{ secrets.SALT_WRITE_KEY }}
        run: |
          set -euo pipefail
          if [ -z "${SALT_KEY:-}" ]; then echo "No SALT_WRITE_KEY secret, so nothing is woken. This step is optional."; exit 0; fi
          if [ ! -f master/_folded.json ]; then echo "No fold in this build; not waking anyone."; exit 0; fi"""

assert old in s, "wake anchor"
s = s.replace(old, new, 1)

old_hdr = '            -H "X-Salt-Key: ${{ secrets.SALT_WRITE_KEY }}" \\'
new_hdr = '            -H "X-Salt-Key: $SALT_KEY" \\'
assert old_hdr in s, "header anchor"
s = s.replace(old_hdr, new_hdr)

io.open(p, "w", encoding="utf-8", newline="").write(s)
print("fixed")
