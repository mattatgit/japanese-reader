# Japanese Reader — interactive publishing procedure

**Current adopted process as of 2026-10-23:** Daily check-in via ChatGPT; generate and publish only after the user opts in to a live interactive conversation. This replaces the proposed unattended ChatGPT-write and paid API-generation approaches.

For overall system context and privacy boundaries, first read [PROJECT_CONTEXT.md](PROJECT_CONTEXT.md).

## GitHub sources of truth

- **Public content/app:** `mattatgit/japanese-reader` on `main`; website deployed from `main/docs` on GitHub Pages.
- **Private learning history:** `mattatgit/japanese`; session reports, vocabulary and weak-points list.
- **Readings:** `docs/data/readings.json`
- **Definitions:** `docs/data/lexicon.json`
- **Reviews:** `docs/data/reviews.json`

Never put user-submitted answers, scores, weak-point diagnostics, or private conversation information into the public repository.

## Reminder vs publishing

- The enabled **Japanese Reading Check-In** runs at **08:00 Australia/Melbourne** each day, asking “Do you have time?” **It does not generate content or call GitHub.**
- Alternate review reminders are anchored to **2026-10-23** local calendar date: 23rd, 25th, 27th, etc. The separate review task is disabled.
- If the user declines or ignores the prompt, do nothing; no backfilling is required just to fill calendar days.
- If the user says **yes** to today's reading, or asks for reading only, continue **in the interactive conversation** with GitHub writes.
- If the user wants a review, use the **latest actually published passage for which no corresponding review yet exists**, rather than assuming yesterday's date; follow user preferences if they request a different passage.
- On a review day, publish today's reading *and* the review only if both were requested. Reading and review are separate website pages.
- A scheduled GitHub write test on 2026-10-23 was blocked by OpenAI's safety checks. Do not try unattended publishing again unless explicitly requested.

## Interactive publishing — reading

1. Resolve today's local date using **Australia/Melbourne**. Fetch live public `readings.json`, `lexicon.json`, and `reviews.json` using the connected GitHub app; fetch a sample of previous topics to avoid repetition. Do **not** assume copied historical summaries are current.
2. Check whether the target date is **already present**. If so, provide its link and do not create a duplicate. The user can explicitly ask to revise an existing item.
3. Write a natural contemporary Japanese passage in **3–4 substantial paragraphs (normally 4), 300–550 Japanese characters** total, plus a one- or two-sentence English introduction. N2 level, practical, interesting Hokkaido/Asahikawa life, architecture, timber, gardens, mountain culture, design and adult situations. Verify any news with current web sources; otherwise use a realistic scenario, not fabricated local reporting.
4. Add **generous vocabulary annotations** to `lexicon.json`, including common N3/N4 kanji and specialist compounds. Format: `"無垢材": ["むくざい", "solid timber"]`. The frontend matches longer entries before shorter ones. Check actual readings, inflected surface forms and segmentation; generic substring annotations can be misleading. The website cannot infer furigana if a word is absent.
5. Append the reading to `readings.json` using:
   `{"date":"YYYY-MM-DD","title":"題名","topic":"Design","intro":"Short English intro.","paragraphs":["…","…","…","…"]}`.
6. Validate all JSON, paragraph lengths, unique dates, and that old readings/vocabulary remain intact.
7. Update the relevant files in the public GitHub repository, using current blob SHAs and preserving all other data.
8. Fetch the files back after commits and check the GitHub Actions validation run and GitHub Pages deployment. A successful **commit** is not necessarily a successful **site deployment**. Do not claim publication without confirming deployment. The direct reading link is `https://mattatgit.github.io/japanese-reader/#/reading/YYYY-MM-DD`.

## Interactive publishing — review

1. Determine the unreviewed source: locate latest published reading whose date does not already appear as a `sourceDate` in `docs/data/reviews.json`. If there is no suitable unreviewed passage, ask whether to review a previous one or make new spaced-repetition exercises; do not duplicate prior reviews.
2. Optionally consult the private `mattatgit/japanese/weak-points.md` to choose older vocabulary needing reinforcement; don't reveal personal error history publicly.
3. Write roughly 6–10 N2-level questions with active recall (kanji/kana production), contextual vocabulary, appropriate register and 1–2 comprehension questions. Keep free-text evaluation for ChatGPT; don't force exact-string grading or publish an answer key.
4. Append a review record to `reviews.json`:
   `{"date":"YYYY-MM-DD","sourceDate":"YYYY-MM-DD","title":"…","intro":"…","questions":[…]}`.
   For each question: `{"id":"1","type":"text","prompt":"…"}` or `{"id":"2","type":"single","prompt":"…","options":[{"id":"A","label":"…"}, …]}` or `"multiple"`. Ensure options use unique identifiers.
5. Commit, verify validation and deployment, and provide `https://mattatgit.github.io/japanese-reader/#/review/YYYY-MM-DD`.

## When answers return from the website

The website holds unfinished drafts in the browser and has a **Copy answers** control; it does not send answers or personal learning data to GitHub. When the learner pastes those answers into an interactive ChatGPT conversation:

1. Grade each semantically: **Correct / Partly correct / Incorrect**, saying what the learner already knew, what was missing or confused, including kanji readings, nuance and a useful natural example where helpful.
2. Save a dated, truthful session record to **private** `mattatgit/japanese/sessions/` and update `weak-points.md` and `vocabulary.md` as appropriate.
3. Never claim to save an answer until a GitHub commit succeeded; respect pending questions and later follow-ups.

## Verification and fallback

Report one of:
- **Published & verified:** commit SHA(s) and confirmed Pages status/live content, plus direct link(s).
- **Committed, deployment not yet confirmed:** SHA(s) plus explicit caveat.
- **Not published:** error or missing GitHub connection, no false link/claim.

Site uses **GitHub Pages from branch main/docs**. Interactive GitHub commits normally trigger the ordinary build. Keep the optional paid API-based GitHub Actions publisher **disabled** and do not switch Pages to GitHub Actions unless specifically requested. See [AUTOMATION.md](AUTOMATION.md) only as an inactive alternative.
