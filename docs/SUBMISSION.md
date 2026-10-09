# Submission form answers (copy-paste)

Fill in the bracketed parts. Submit once on the Cerebral Valley event page before **10:00 AM, Oct 10**. No edits after.

**Project name:** Tantiya

**Short description:**
Tantiya is offline AI damage triage for the days after a typhoon. Municipal social welfare teams load field photos into one laptop; a vision model running locally sorts each house into DSWD shelter-assistance categories (totally / partially damaged) with its reasoning, the officer confirms or overrides every result, duplicate families are caught with local embeddings, and the app produces a masterlist. Everything works with the Wi-Fi off.

**Team members:** [names exactly as on appbuildersph.com/hackathon]

**Public GitHub repository:** [https://github.com/<you>/tantiya]

**Demo video:** [link]

**X / LinkedIn video URL:** [link] (tag Devin / Cognition, include #AppBuildersPH)

**What runs locally:**
Everything in the core flow: the vision model (gemma3:4b via Ollama) that describes each photo and suggests a damage category, the embedding model (nomic-embed-text via Ollama) and rules for duplicate-family detection, the SQLite database, photo storage, the web app, reports and CSV export.

**What requires internet:**
Only the one-time setup: installing Ollama, downloading the two models and running npm install. At runtime nothing needs internet; the app only checks whether a connection exists so it can show "offline · still works".

**Models used:** gemma3:4b (Google, Gemma Terms of Use); nomic-embed-text (Nomic AI). Both run locally through Ollama.

**Technologies and frameworks:** Node.js 22 (built-in node:sqlite), Express 5, Multer 2, React 19, Vite 8, Tailwind CSS 4, lucide-react, Fontsource fonts, Ollama. Dev only: puppeteer-core for screenshots and end-to-end tests.

**APIs and cloud services:** None at runtime. The Wikimedia Commons API was used once during development to download freely licensed test photos.

**Existing code and assets:** No code written before the hackathon. Test/demo photos from Wikimedia Commons (public domain / CC BY / CC BY-SA, credited in ASSETS.md). Logo by the team. Sample families are invented.

**AI development tools:** Claude Code (research, planning, coding). [add any others you used]

**Why does this product benefit from running AI locally?**
Damage assessment happens in the hours and days after a typhoon, when cell sites are down and power is out. Days after Typhoon Uwan, only 54–74% of each telco's network was working. A cloud-only tool fails exactly when it is needed. Tantiya runs its vision model on one laptop, so a municipal team can sort hundreds of house photos with zero connectivity and zero data cost (about [X] seconds per photo on a mid-range gaming laptop). Photos of families' homes linked to their names are personal data under the Data Privacy Act; with Tantiya they never leave the device.

**Measured results (from results/eval-*.json):** [fill from README "Measured results"]
