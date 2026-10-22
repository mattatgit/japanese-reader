# Content publishing workflow

The public site is deployed from `main/docs`; data lives in `docs/data/*.json`.

## Repositories and privacy

- Public site: `mattatgit/japanese-reader`
- Private learner history: `mattatgit/japanese`
- No private review answers, scores, personal details, or weak-point table should be copied into the public repository.
- Generated review questions may draw on vocabulary needing practice, but do not publish the user's mistake history or answer keys.

## Every day: prepare a reading

1. Determine today's date in **Australia/Melbourne**. Read the last several entries in `docs/data/readings.json` to avoid repeated topics.
2. Write a natural contemporary N2-level Japanese passage in **3–4 substantial paragraphs, approximately 300–550 Japanese characters**, with a short English introduction and a topic. Prefer architecture, Hokkaido living, design, gardens, mountains, home ownership, practical adult-life situations and factual verified positive news. **Use web research to verify any current-news-based passage.**
3. Load the *current* `docs/data/readings.json` and `docs/data/lexicon.json` from GitHub. Append (don't overwrite) the new entry to the reading array: 
   `{"date":"YYYY-MM-DD","title":"日本語の題名","topic":"Garden","intro":"English one sentence.","paragraphs":["…","…","…","…"]}`.
   Valid topics presently include `Garden`, `Home`, `Design`, `Community`, `Life`.
4. Supply **generous** word-level kana readings and contextual English glosses in `docs/data/lexicon.json`, as `"無垢材":["むくざい","solid timber"]`. The UI matches the longest words first. Include common N3/N4 kanji vocabulary as well as specialist compounds, and avoid incorrect overlapping substrings/readings.
5. Validate JSON parsing, correct date and paragraph count, and the preservation of all existing entries. If an entry already exists for today's date, do **not** add a duplicate; report it instead.
6. Commit each changed file to the `main` branch of `mattatgit/japanese-reader` using the connected GitHub app. After each update, use the current blob SHA (fetch again before editing).
7. Verify the new reading actually exists in GitHub and inspect the GitHub Actions validation and Pages deployment results when available. **Do not claim the website was published solely because a commit succeeded.**

## Every second day: prepare a review

Review days are anchored to **2026-10-23 Australia/Melbourne** and repeat every 2 calendar days (25th, 27th, …). Always use local calendar dates for the calculation.

1. Read the **previous day's** published passage from `docs/data/readings.json` and, if accessible, consult the **private** `mattatgit/japanese/weak-points.md` for older topics to revisit.
2. Write about **6–10 substantive questions**, including free-text kanji readings and kana-to-kanji production, vocabulary in context, natural phrasing, and 1–2 comprehension items. Free text is *not* graded by exact match on the site.
3. Fetch `docs/data/reviews.json`; append an entry `{"date":"YYYY-MM-DD","sourceDate":"YYYY-MM-DD","title":"…","intro":"…","questions":[…]}`.
4. Questions use `{"id":"1","type":"text","prompt":"…"}` or `{"id":"2","type":"single","prompt":"…","options":[{"id":"A","label":"…"}]}` or `"multiple"`. No public answer key or personal submissions.
5. Preserve all previous reviews; commit the update and verify it in GitHub.

## Website delivery and fallback

The goal is **ready by 08:00 Australia/Melbourne**. Schedule generation sufficiently beforehand, but note that task execution time and deployment can vary.

The task must report one of:
- **Published & verified** — commit SHA plus deployed website checked
- **Committed, deployment not yet confirmed** — SHA with explicit warning
- **Not published** — state the cause and do not claim success

If a scheduled task cannot use GitHub or encounters an approval requirement, **do not silently revert to ChatGPT-only delivery**. Preserve the original reading in the task response and flag the publishing failure for manual resolution. No API key or GitHub Personal Access Token should be stored in this public repository.

## Limitation

Scheduled ChatGPT tasks may use connected GitHub apps, but write approvals or account/workspace permissions can pause a task. Confirm by running an **unattended** scheduled smoke test, not by assuming a successful interactive chat commit proves scheduled access.

## Existing content

The site currently has seven archived readings, two reviews, and its vocabulary dictionary. Keep them intact when appending content.
