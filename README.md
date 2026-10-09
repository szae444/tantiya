<p align="center"><img src="web/public/logo.png" alt="Tantiya" width="360"></p>

<p align="center"><b>Offline AI damage triage for the days after a typhoon.</b><br>
Runs entirely on one laptop. No internet needed. The officer makes every decision.</p>

---

## The problem

After a typhoon, municipal social welfare (MSWDO) and disaster office staff must check damaged houses one by one so families can receive DSWD **Emergency Shelter Assistance**, which pays differently for *totally* and *partially* damaged houses. This happens exactly when the network is down: days after Typhoon Uwan (Nov 2025), only 54–74% of each telco's network was working ([DICT via Manila Bulletin](https://mb.com.ph/2025/11/10/metro-manila-100-reconnected-bicol-northern-luzon-still-struggle-with-outages-dict)). DSWD has itself cited validation in remote areas, houses put in the wrong category, and duplicate names as causes of delayed payouts ([DSWD FO6](https://fo6.dswd.gov.ph/?p=3129), [ReliefWeb](https://m.reliefweb.int/report/3348543/philippines/dswd-releases-p644m-ompong-victims)).

## What Tantiya does

1. **Intake.** Load field photos (drag and drop, or straight from a phone on the same local Wi-Fi). Photos are resized in the browser.
2. **Triage.** A vision model **running on the laptop** describes each photo, rates roof, walls and structure, and suggests a category: *Totally damaged*, *Partially damaged*, *Minor / none* or *Not a house*. Category meanings follow the [DSWD FO5 Emergency Shelter Assistance guide](https://fo5.dswd.gov.ph/wp-content/uploads/2022/03/Emergency-Shelter-Assistance.pdf).
3. **Officer review.** Every suggestion must be confirmed or changed by a person. Changing it requires a reason. Inconsistent or risky answers are flagged ("wide shot", "leaning structure", "no house visible").
4. **Households + duplicate check.** Photos are linked to families. New families are checked against the list with rules plus **local text embeddings**, so "Rosario Villanueba" is caught as a duplicate of "Rosario Villanueva".
5. **Report.** Counts per category and barangay, a printable report, and a CSV masterlist.

## Why local

Damage assessment happens in the hours and days after a typhoon, when cell sites are down and power is out. A cloud-only tool fails exactly when it is needed. Tantiya runs its vision model on one laptop, so a municipal team can sort hundreds of photos with zero connectivity and zero data cost. Photos of families' homes linked to their names are personal data under the Data Privacy Act; they never leave the device.

## What runs locally / what needs internet

| Runs locally (offline) | Needs internet |
|---|---|
| Vision AI (`gemma3:4b` via Ollama), damage categories, flags | One-time download of Ollama and the two models |
| Duplicate detection (`nomic-embed-text` embeddings via Ollama + rules) | One-time `npm install` |
| Database (SQLite), photo storage, web app, report, CSV export | Nothing else. To show "Internet: offline · still works", the server only opens a TCP connection to 1.1.1.1:443 and sends no data |

Verified by `npm run e2e`, which drives the full flow in a headless browser and fails if any request leaves the machine. Fonts and icons are bundled; there are no CDNs.

## Measured results

Measured on the demo laptop (Ryzen 7 7435HS, RTX 4050 6 GB, 16 GB RAM, Ollama 0.35.1) on **37 freely licensed photos** (9 totally damaged, 10 partially damaged, 10 minor/no damage, 8 not a house). Reproduce with `npm run eval`; raw outputs are in [`results/`](results/).

| Prompt | Agreed with labels | Damaged vs not damaged | Not-a-house caught | Seconds per photo (mean) |
|---|---|---|---|---|
| **v2 (default), two runs** | **27 / 37 (73%) and 26 / 37 (70%)** | **33 / 37 (89%) and 32 / 37 (86%)** | 8 / 8 both runs | 6.9 / 6.7 |
| v4 (adds Philippine building materials), one run, before the rule fix below | 27 / 37 (73%) | 33 / 37 (89%) | 7 / 8 | 7.3 |

**Stability:** 36 of 37 photos got the same answer in both v2 runs. The one that changed is an aerial photo of a whole district (Total in run 1, Not a house in run 2). GPU arithmetic is not bit-for-bit repeatable, so borderline photos can flip even at temperature 0; another reason the officer decides.

Confusion for v2, run 1 (rows = label, columns = AI suggestion):

| | Total | Partial | Minor | Not a house |
|---|---|---|---|---|
| **Total** | 7 | 2 | 0 | 0 |
| **Partial** | 3 | 7 | 0 | 0 |
| **Minor** | 1 | 3 | 5 | 1 |
| **Not a house** | 0 | 0 | 0 | 8 |

What we learned:

- **Most errors are Total vs Partial**, which human assessors also disagree on. That is why every result needs an officer's decision.
- **Intact nipa huts were often called "partially damaged"** under v2 (thatch and bamboo look "damaged" to the model). That is a fairness risk for the poorest households. Prompt v4 fixed two of them but made the model under-call destroyed houses (5/9 Total vs 7/9), the worse error for families, so v2 stays the default. v4 was written after seeing v2's mistakes on the same photos, so its number is optimistic. Fixing this properly needs more Philippine house photos, which is our next step.
- **Earlier prompt v3** (longer context) got 2 of 3 smoke-test photos wrong, so it was dropped before the full evaluation.
- **A rule bug found in rehearsal.** For a debris field the model answered *Total* but marked "no house visible", and our safety rule turned that into *Not a house*. Debris is the remains of houses, so the rule now keeps the model's category and flags the photo instead (regression test in `scripts/test-rules.mjs`). The v2 numbers above were re-measured after the fix; the earlier files are kept as `results/*-before-rule-fix.json`.
- **Duplicate check:** `npm run test:dedupe` catches 4/4 planted near-duplicates (including the typo "Villanueba" via embeddings, similarity 0.988) with 0/3 false alarms. The 0.95 threshold was set from measurement: the 435 pairs of distinct sample families topped out at 0.91.
- The first request after starting Ollama took about 84 s (model loading); `npm run warmup` avoids that during demos.

Caveats: 37 photos is a small test set, and the labels are draft labels from the team's visual inspection (prepared with AI assistance, made before running the model), not official assessments. The 10 photos in the live demo (`scripts/demo-set.mjs`) are a curated subset; the numbers above are for the full set.

## Setup (Windows, macOS or Linux)

Requirements: **Node.js 22.13+**, **[Ollama](https://ollama.com)**, about 4 GB of free RAM/VRAM. Tested on a Ryzen 7 7435HS laptop with an RTX 4050 (6 GB) and 16 GB RAM.

```bash
ollama pull gemma3:4b
ollama pull nomic-embed-text

git clone <this repo> tantiya && cd tantiya
npm install
npm run build        # builds the web app into dist/
npm run seed         # optional: 30 invented sample families
npm start            # http://localhost:8787
```

Open http://localhost:8787, go to **Intake** and drop photos from `data/photos/`. You can now turn the Wi-Fi off; everything keeps working.

Development mode with hot reload: `npm run dev` (web on http://localhost:5173, API on 8787).

### Useful scripts

| Command | What it does |
|---|---|
| `npm run warmup` | Loads the vision model before a demo (first load can take over a minute) |
| `npm run eval` | Re-runs the accuracy test on `data/photos` + `data/labels.csv` and saves `results/eval-*.json` |
| `npm test` | Unit tests for the safety rules applied to every model answer |
| `npm run test:dedupe` | Checks that planted duplicate families are caught and distinct ones are not (needs `npm run seed`) |
| `npm run e2e -- <outDir> data/demo/*.jpg` | Full flow through the real UI in headless Edge/Chrome, with screenshots and an offline check (server must be running) |
| `npm run demo-set` | Copies the 10 stage-demo photos to `data/demo/` |
| `npm run reset` | Deletes all photos, decisions and families (stop the server first) |
| `TANTIYA_PROMPT=v3 npm run eval` | Compares another prompt version on the same photos |

Environment variables: `PORT` (8787), `OLLAMA_HOST`, `TANTIYA_MODEL` (gemma3:4b), `TANTIYA_EMBED_MODEL` (nomic-embed-text), `TANTIYA_DUP_THRESHOLD` (0.95), `TANTIYA_PROMPT` (v2).

## How it works

```
 phone camera ──photos──▶ ┌──────────── laptop (offline) ────────────┐
                          │ React web app ⇄ Express API ⇄ SQLite      │
                          │                    │                       │
                          │          one-at-a-time AI queue            │
                          │                    ▼                       │
                          │ Ollama: gemma3:4b (vision, JSON schema)    │
                          │         nomic-embed-text (duplicates)      │
                          └────────────────────────────────────────────┘
```

- **Structured output.** The model must answer in a fixed JSON schema. Fields are ordered so it *describes the photo first* and *decides last*. In testing this stopped it from inventing damage in photos with no house.
- **Rules in code, not just the prompt.** `server/ai.js` overrides "house not visible" answers to *Not a house* and flags contradictions (e.g. *Minor* with a collapsed structure).
- **Human in the loop.** The AI never approves anything. The report and CSV only include officer decisions, and record whether the officer changed the AI suggestion and why.
- **No confidence percentages.** A language model's self-reported confidence is not calibrated, so Tantiya shows the evidence (roof, walls, structure, description) instead.

## Limitations

- The test labels are draft labels from visual inspection, not official DSWD assessments. Damage categories are partly subjective; some photos (roof gone, walls standing) are genuine edge cases.
- Wide shots of whole neighborhoods get one category for many houses. Field teams should photograph one house at a time.
- A 4B vision model makes mistakes. That is why the officer decides every photo.
- Tantiya is designed to fit the DSWD shelter-assistance process. It is **not** an official DSWD tool and does not replace LSWDO certification or C/MAT validation.

## Disclosures

| Item | Details |
|---|---|
| Models | `gemma3:4b` (Google, Gemma Terms of Use) and `nomic-embed-text` (Nomic AI), both run locally through Ollama |
| Frameworks & libraries | Node.js (built-in `node:sqlite`), Express 5, Multer 2, React 19, Vite 8, Tailwind CSS 4, lucide-react icons, Fontsource fonts (Archivo, IBM Plex Mono), puppeteer-core (dev-only screenshots) |
| APIs & cloud services | None at runtime. Wikimedia Commons API used once, during development, to download test photos (`scripts/fetch-photos.mjs`) |
| Existing code & assets | No code from before the hackathon. Test/demo photos from Wikimedia Commons, credited in [ASSETS.md](ASSETS.md). Logo provided by the team. Sample families are invented |
| AI development tools | Claude Code (research, planning, code) |

## Project structure

```
server/   Express API, Ollama calls (ai.js), queue, SQLite (db.js), duplicate check (dedupe.js)
web/      React app: Intake, Triage + review drawer, Households, Report
scripts/  eval, warmup, seed, reset, dataset builder, photo fetcher, dedupe test
data/     test photos, labels.csv, sample households, planted duplicates
results/  committed evaluation outputs
```

## License

MIT
