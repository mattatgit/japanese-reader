# Automatic publishing — GitHub Actions

This workflow replaces unattended ChatGPT-to-GitHub writes, which failed the 2026-10-23 scheduled smoke test because of OpenAI's safety checks. The ChatGPT scheduled task itself cannot be assumed to have commit privileges.

## Architecture

1. **Scheduled GitHub Actions workflow** at **07:15 Australia/Melbourne**, including daylight-saving changes. It runs `scripts/publish.py` and calls the OpenAI **Responses API** with Structured Outputs to draft a reading and generous word-level furigana / English glosses.
2. It validates the generated content and updates `docs/data/readings.json` and `docs/data/lexicon.json` in the public repository. It publishes a separate review on alternating dates using `docs/data/reviews.json`.
3. It commits with the repository's built-in `GITHUB_TOKEN` and explicitly dispatches the **Deploy Japanese Reader** GitHub Actions workflow.
4. The deployment workflow publishes `docs/` to GitHub Pages. This explicit deployment is necessary because **a push made using GITHUB_TOKEN does not itself trigger a GitHub Pages branch-source build**.

## Activation — requires explicit owner setup

The workflows are initially **disabled for unattended publishing**. A dry-run validation is possible with no key and no API calls.

1. Create an OpenAI API project key on [the OpenAI developer platform](https://platform.openai.com/api-keys), with usage limits appropriate to a small personal app. **This API has separate billing from ChatGPT Plus.**
2. In this repository, go to **Settings → Secrets and variables → Actions → Secrets → New repository secret**. Add `OPENAI_API_KEY` (never commit the value or paste it in ChatGPT).
3. Under **Variables**, create `PUBLISH_ENABLED` with value `true` to enable the scheduled generation job. Optionally set `OPENAI_MODEL` (default: `gpt-6-luna`).
4. In **Settings → Pages**, switch **Build and deployment / Source** from **Deploy from a branch** to **GitHub Actions**.
5. Under Actions **Variables**, add `CUSTOM_PAGES_DEPLOY` = `true`. This enables the new deployment workflow. Until then, the original site remains served from the existing branch-source setup.
6. Test manually in **Actions → Publish Japanese Reading → Run workflow**, first `dry_run` (no key or cost), then `publish` (API charge, writes content, deploys site). Inspect the resulting commit and **Deploy Japanese Reader** workflow before trusting the daily schedule.

> Be sure Pages is switched to GitHub Actions **before** enabling `CUSTOM_PAGES_DEPLOY`; otherwise the explicit deployment workflow may fail.

## Review-day cadence

Review days use the previous day's passage and are anchored to **2026-10-23** (23rd, 25th, 27th, etc.) in Melbourne local dates. They are automatically included in the morning publishing job when the source reading exists. The site never auto-grades free text; users copy their answers to ChatGPT for detailed feedback.

The public workflow does **not** read personal answers, weak points or private learning records. Those remain in `mattatgit/japanese`.

## Content requirements

- One 3–4 paragraph natural contemporary N2 Japanese passage per day, **300–550 Japanese characters**.
- Topics rotate among design, woodworking, Hokkaido, gardens, mountains, homes and ordinary adult life.
- No claims of fresh news: the generator uses a fictional or general scenario unless a later workflow is explicitly equipped with trustworthy news retrieval and citations.
- Model-generated annotations aim to cover most kanji words, including many familiar N3/N4 terms.
- All generated output is checked for schema validity and sensible readings before it is committed.
- The script refuses to overwrite an existing date and never publishes any personal review answers.
- Review sets comprise 6–10 free-text and choice questions, without public answer keys.

## What can go wrong

- GitHub scheduled workflows sometimes start late; **07:15 is a target, not a guarantee** of availability at 08:00.
- Generation quality, pronunciation and word segmentation require editorial spot checks. Automated checks can't guarantee every kanji reading is correct.
- An absent API key, exhausted billing or an invalid model selection causes an explicit job failure, not a fake success.
- The first API-backed run has not been tested while the key is absent; passing a local dry run only verifies the data and workflow structure.
- The existing ChatGPT reading and review tasks remain independent until this entire workflow is proved and are **not automatically disabled**.

## Files

- `.github/workflows/publish.yml` — schedule, checks, commits, deployment dispatch
- `.github/workflows/deploy-pages.yml` — direct Pages artifact upload and deployment
- `scripts/publish.py` — content generation, annotation merging and validation
