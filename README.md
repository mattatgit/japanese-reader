# Japanese Reader

A lightweight, no-backend Japanese reading and review website for GitHub Pages.

## Features

- Four-paragraph daily readings with hidden furigana on hover and contextual English definitions on click/tap.
- Searchable archive, date and topic browsing, and mobile-friendly layout.
- Mixed reviews with text answers, single- and multiple-choice questions.
- Autosaved review drafts in this browser (localStorage); a **Copy answers** button to paste into ChatGPT for semantic feedback.
- Seven archived passages from 17–23 October 2026 and initial reviews.
- No account, server, tracking, API key, build system or npm dependencies.

## Publishing to GitHub Pages

In **Settings → Pages → Build and deployment**, choose **Deploy from a branch**, branch **main**, folder **/docs**, then Save. The website will be at **https://mattatgit.github.io/japanese-reader/** after deployment. The `docs/.nojekyll` file prevents Jekyll processing.

## Add a reading

Add an entry to `docs/data/readings.json` containing `date` (YYYY-MM-DD), `title`, `topic`, `intro`, and an array of four `paragraphs`. Extend `docs/data/lexicon.json` with entries such as `"無垢材": ["むくざい", "solid timber"]`. The renderer matches longer entries first and **does not invent readings**.

## Add a review

Add an entry to `docs/data/reviews.json` with `date`, `sourceDate`, `title`, `intro`, and `questions`. Question types: `text`, `single`, `multiple`. For choices provide `options` as `{id,label}`. Public content deliberately excludes private answer keys and user answer history.

## Privacy and learning history

Personal progress is **not stored in this public repository**. Review drafts are local to the browser and are copied, not transmitted, to ChatGPT. Detailed reviews, answers, weak points and spaced repetition should be recorded in the existing **private** `mattatgit/japanese` repository.

## Automation

Publishing via GitHub requires **actual GitHub commits**, which the scheduled ChatGPT daily reading task did not previously do. A separately tested scheduled publishing workflow will be needed before claiming fully automatic 8am delivery.

## Automated publication (optional, disabled by default)

The proof-of-concept ChatGPT scheduled write was blocked by OpenAI safety checks. A replacement GitHub Actions publisher and explicit Pages deployer are now staged, with an **offline dry-run mode and no automatic API charges** until the owner enables them.

**See [AUTOMATION.md](AUTOMATION.md) for exact setup**, including the `OPENAI_API_KEY` secret, `PUBLISH_ENABLED` and `CUSTOM_PAGES_DEPLOY` variables, the Pages source switch from branch publishing to GitHub Actions, and the manual test sequence. The `scripts/publish.py` content generator requires a separately billed OpenAI API key for live publication; the main website itself never needs one.

The existing ChatGPT reminder tasks are not disabled by this change. Do not treat a successful content commit as proof that GitHub Pages deployed successfully; automated commits must explicitly dispatch the deployment workflow.
