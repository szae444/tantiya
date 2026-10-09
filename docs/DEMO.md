# Demo Day runbook

## Before you leave home

- [ ] Laptop charger, HDMI / USB-C adapter, mouse.
- [ ] `git pull` is **not** needed. Everything is on the laptop. Do not change code after 10:00 AM.
- [ ] Backup screen recording of the full demo on the desktop.

## At the venue (12:15 AV check, and again right before your slot)

```bash
cd tantiya
npm run reset          # stop the server first (Ctrl+C) if it is running
npm run seed           # 30 invented sample families
npm run demo-set       # copies the 10 stage photos to data/demo/
npm start              # http://localhost:8787  (keep this window open)
npm run warmup         # in a second terminal: loads the AI model (first load can take ~1.5 min)
```

Open http://localhost:8787 in the browser, full screen (F11), zoom 100–110%.
The sidebar should say **AI ready**.

## The 5 minutes

| Time | Say | Do |
|---|---|---|
| 0:00 | "November 2025, Typhoon Uwan. Days later, nearly half of one major telco's network was still down. That is exactly when social welfare teams start checking houses, so families can get shelter assistance." | Tantiya on screen. |
| 0:40 | "So let's do this with no internet." | **Turn Wi-Fi off.** After ~5 s the sidebar shows *Internet: offline · still works*. |
| 1:00 | "A field team just came back with photos." | **Intake** → drag the 10 files from `data/demo/` onto the drop zone. |
| 1:10 | "Each photo is analyzed by a vision model running on this laptop, about 7 seconds each." | Point at the scanning thumbnails and the gauge. Go to **Triage** as cards arrive. |
| 2:30 | "It sorts them using DSWD's own definitions of totally and partially damaged, and shows its evidence." | Click **Start reviewing**. Show description, roof/walls/structure, reason. Press **Enter** to confirm one or two. |
| 3:00 | "But the officer decides. Here the roof sheets are gone but the walls stand. Under DSWD's definition an unusable roof can mean *totally damaged*." | On photo `05-p011` press **1** (Totally damaged), type a reason, press **Ctrl+Enter**. |
| 3:30 | "Duplicate claims are a known cause of delays." | In the drawer, link a family, or go to **Households** and add *Rosario Villanueba*, *San Jose*, *Purok 2*. It flags *Rosario Villanueva* (similarity 0.99), caught by a local embedding model. |
| 4:10 | "And the masterlist is ready. Still offline." | **Report** → show counts, changed-by-officer count, **Download masterlist (CSV)**. |
| 4:30 | "Why local: no signal after typhoons, no data cost for hundreds of photos, and families' photos and names never leave the device. Next: a pilot with one MSWDO." | Wi-Fi back on (optional). |

## If something goes wrong

- **AI not running / red status:** start the Ollama app, then `npm run warmup`.
- **Very slow first photo:** the model was not warm. Wait; it continues by itself.
- **A photo gets a surprising category:** that is the point. Override it and explain that the officer decides.
- **Anything else:** play the backup recording and keep talking.

## Numbers you may quote (measured, see README "Measured results")

- Agreement with labels on the 37-photo test set and damaged-vs-not agreement: use the latest `results/eval-*-v2.json`.
- About 7 seconds per photo on this laptop (RTX 4050 6 GB).
- Duplicate check: 4/4 planted duplicates caught, 0/3 false alarms.

Do **not** quote any other accuracy numbers.
