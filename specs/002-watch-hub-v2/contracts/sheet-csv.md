# Contract: Editor sheet CSV (v2 additions)

Everything in `specs/001-watch-hub-v1/contracts/sheet-csv.md` still applies. New row types:

| type | field1 | field2 | field3 | notes |
|------|--------|--------|--------|-------|
| skill | name | rank (integer, optional) | desc (optional) | upserts by name |
| class | class | – | – | |
| hotlist | add (`;`) | remove (`;`) | – | |

Diagnostics: `skill` with a non-integer `rank` → ERROR; empty `name`/`class` → ERROR.

`--initial-state` may now carry the optional crawler fields `race`, `pronouns`, `crawlerNumber`,
`stats { str, int, con, dex, cha }`, `hotlist[]`, `skills[] { name, rank? }`; they pass through
unchanged. Files without them remain valid.

Samples: `scripts/samples/ep1.csv` gains at least two rows of each new type; `ep1-broken.csv`
gains a `skill` row with rank `"high"` (ERROR case moves to `ep1-error.csv` as a second error row).
