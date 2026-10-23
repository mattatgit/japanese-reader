# Japanese Reader — project context and operating runbook

**Last updated:** 2026-10-23 (Australia/Melbourne). **Current chosen workflow:** ChatGPT daily check-in followed by interactive, user-approved publishing. This document is the canonical entry point for new conversations in the Japanese Reader ChatGPT Project.

## What this project is

A lightweight Japanese reading and review website for a rusty former JLPT 2級 learner. The site has interactive hidden furigana on hover, contextual English definitions on click/tap, a dated archive, and review exercises with browser-local draft answers and **Copy answers** for ChatGPT.

- **Live site:** https://mattatgit.github.io/japanese-reader/
- **Public website and reading content repo:** https://github.com/mattatgit/japanese-reader
- **Private learning progress repo:** https://github.com/mattatgit/japanese
- **Website content:** `docs/data/readings.json`, `docs/data/lexicon.json`, `docs/data/reviews.json`.
- **Website source:** `docs/index.html`, `docs/styles.css`, `docs/app.js`.
- **Detailed interactive publishing steps:** [PUBLISHING.md](PUBLISHING.md).
- **Private learning history:** `sessions/`, `weak-points.md`, `vocabulary.md` in `mattatgit/japanese`.

## CURRENT workflow — no separate API billing

1. A single existing scheduled ChatGPT task, **Japanese Reading Check-In**, runs at **08:00 Australia/Melbourne**, asking if the learner has time today. It produces **only a reminder**, not reading or review content. The older separate review task is disabled.
2. The reminder alternates between **reading only** and **reading + review** days; alternate-day reviews are calendar-anchored to **2026-10-23, 25, 27, …**. The learner may decline, defer, or request a reading only.
3. **Only after the learner replies affirmatively in an interactive ChatGPT conversation**, the assistant reads the latest GitHub files through the connected GitHub app and creates content. This interaction is important: a diagnostic scheduled GitHub write was blocked by OpenAI safety checks on 2026-10-23, whereas manual-chat commits worked.
4. Publish new reading text and generous word-level kana/English vocabulary to the **public** repo via authenticated GitHub content updates. Preserve existing entries and avoid duplicate dates.
5. On an agreed review day, make a review from the **last published reading not already reviewed**, not necessarily yesterday's passage; incorporate selected older vocabulary from the **private** learning repo, without revealing the user's personal errors or scores in public.
6. Verify GitHub commit, JSON validation and GitHub Pages deployment. A commit does not guarantee successful publication. After verification, return the **direct website links**.
7. When answers are copied from the website and pasted into ChatGPT, review every answer semantically as **Correct / Partly correct / Incorrect**, including what was known, what's missing, readings, collocations and examples. Commit session records and updated weak points to the **private** `japanese` repo.

## Reading and review specification

- Natural contemporary Japanese around N2 / old JLPT 2級, occasionally with specialist vocabulary.
- **Four substantial paragraphs preferred**, 3–4 permitted; approximately **300–550 Japanese characters** per passage.
- Topics: Hokkaido, Asahikawa woodworking/furniture, architecture, design, gardens and native plants, mountains, homeownership and maintenance, city hall, trades, banking, medicine, tax, utilities and positive local developments.
- Current-news readings must be independently verified via the web; otherwise use realistic illustrative scenarios, not fabricated news.
- Add hidden-on-hover furigana and contextual click/tap English glosses for **most kanji words**, including common N3/N4 words. `lexicon.json` supplies the reading widget; missing dictionary entries do not magically acquire annotations.
- No quiz embedded in the reading itself.
- Reviews: usually 6–10 questions, mixing kanji-to-kana, kana-to-kanji production, vocabulary, natural phrasing, and comprehension. Free-text evaluation belongs in ChatGPT, not exact-string browser grading.
- In review feedback, scores are secondary to nuanced diagnosis. Revisit weak points with spaced repetition.

## GitHub, Pages and privacy

- The live site currently uses **GitHub Pages branch publishing from main/docs**; normal interactive GitHub commits trigger the existing Pages deployment workflow.
- `.github/workflows/validate.yml` checks new commits.
- An **optional, inactive** API-backed GitHub Actions publisher remains in the repo (`.github/workflows/publish.yml`, `scripts/publish.py` and [AUTOMATION.md](AUTOMATION.md)). **Do not enable it, request an API key, change Pages to Actions mode, or incur separate billing** without an explicit new request.
- All personal review answers, grades, weak-point diagnostics and learning history stay in **private** `mattatgit/japanese`; no personal data or answer key should be added to the public `japanese-reader` repository.
- If the GitHub connector is unavailable or a write fails, state the blocker; never claim publication without evidence.

## Instructions for new ChatGPT conversations

Start inside the **Japanese Reader** ChatGPT Project. Project-level instructions should direct the assistant to read this document and `PUBLISHING.md` **from GitHub at the start of any publishing or development task**, rather than assuming past chat context is complete.

For a reading: “Please prepare and publish today's Japanese reading.”

For a review: “Please review these Japanese Reader answers and update my private learning history.” Then paste the copied responses.

For development: “Read the Japanese Reader runbook in GitHub and continue improving the web app.”

The scheduled task contains its own check-in instructions. Do not rely on its ability to access files uploaded to the ChatGPT Project.

## Keeping this runbook current

Whenever the website data format, publication mechanism, account permissions, deployment process or privacy model changes materially, update **this file** and the detailed `PUBLISHING.md` in the same work session. Do not record transient conversational opinions here; use it for agreed durable decisions and the actual operational state.
