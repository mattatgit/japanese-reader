#!/usr/bin/env python3
"""Prepare daily Japanese Reader content. Standard library only.

dry_run: verify existing content, date and cadence without API calls or writes.
publish: draft via OpenAI Responses API, validate, and write JSON for GitHub Actions.
"""
from __future__ import annotations

import datetime as dt
import json
import os
import re
import sys
import urllib.error
import urllib.request
from pathlib import Path
from zoneinfo import ZoneInfo

ROOT = Path(__file__).resolve().parents[1]
DATA_DIR = ROOT / "docs" / "data"
TIMEZONE = ZoneInfo("Australia/Melbourne")
REVIEW_ANCHOR = dt.date(2026, 10, 23)
KANJI = re.compile(r"[\u3400-\u9fff\uF900-\uFAFF]")
HIRAGANA = re.compile(r"^[ぁ-ゖー・]+$")
TOPICS = [
    ("Design", "An Asahikawa woodworking workshop and furniture construction"),
    ("Garden", "Hokkaido native plants, garden soils and seasonal maintenance"),
    ("Home", "Winter-proof home maintenance, heat and ventilation"),
    ("Community", "Practical interactions with Japanese neighbours or tradespeople"),
    ("Mountains", "Mountain culture, backcountry safety and changing seasons"),
    ("Life", "City-hall, banking, insurance, medical and tax interactions"),
    ("Design", "Architecture, joinery, natural materials and interior design"),
    ("Garden", "Planning a sustainable garden that handles heavy snow"),
]
BASE_INSTRUCTIONS = (
    "You are an expert Japanese-language reading teacher and editor. "
    "Write natural contemporary Japanese, approximately N2 level, for a rusty advanced "
    "learner who previously lived in Japan five years and passed the old JLPT 2-kyuu. "
    "Present practical adult-life context, careful wording, credible everyday details. "
    "Do NOT invent current news, quote supposed real people, or assert specific recent events. "
    "Any narrative should be a realistic illustrative scenario, not reported news. "
    "Generate only structured JSON conforming to the requested schema."
)


def read_data(name: str):
    with (DATA_DIR / (name + ".json")).open("r", encoding="utf-8") as handle:
        return json.load(handle)


def write_data(name: str, value) -> None:
    target = DATA_DIR / (name + ".json")
    temp = target.with_suffix(".json.tmp")
    temp.write_text(json.dumps(value, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    temp.replace(target)


def local_date() -> dt.date:
    return dt.datetime.now(TIMEZONE).date()


def review_due(day: dt.date) -> bool:
    return (day - REVIEW_ANCHOR).days % 2 == 0


def validate_catalogue(readings: list, reviews: list, lexicon: dict) -> None:
    if not isinstance(readings, list) or not isinstance(reviews, list) or not isinstance(lexicon, dict):
        raise ValueError("Unexpected JSON structure.")
    dates = [r["date"] for r in readings]
    if len(dates) != len(set(dates)):
        raise ValueError("Duplicate reading dates.")
    for r in readings:
        if not isinstance(r.get("paragraphs"), list) or not (3 <= len(r["paragraphs"]) <= 4):
            raise ValueError(f"Invalid paragraphs in reading {r.get('date')}")
        if not all(isinstance(p, str) and len(p.strip()) >= 25 for p in r["paragraphs"]):
            raise ValueError(f"Empty or very short paragraph: {r.get('date')}")
        if not isinstance(r.get("title"), str) or not r["title"]:
            raise ValueError(f"Missing title: {r.get('date')}")
    review_dates = [r["date"] for r in reviews]
    if len(review_dates) != len(set(review_dates)):
        raise ValueError("Duplicate review dates.")
    for r in reviews:
        if not isinstance(r.get("questions"), list) or not r["questions"]:
            raise ValueError(f"Invalid review: {r.get('date')}")
    for word, definition in lexicon.items():
        if not (isinstance(word, str) and word and isinstance(definition, list) and len(definition) == 2
                and all(isinstance(v, str) and v.strip() for v in definition)):
            raise ValueError(f"Invalid lexicon entry: {word!r}")


def kanji_coverage(text: str, lexicon: dict) -> float:
    """Proportion of kanji characters belonging to an annotated dictionary match."""
    terms = sorted((term for term in lexicon if KANJI.search(term)), key=len, reverse=True)
    total = sum(bool(KANJI.match(c)) for c in text)
    if total == 0:
        return 1.0
    covered = 0
    i = 0
    while i < len(text):
        match = next((term for term in terms if text.startswith(term, i)), None)
        if match:
            covered += sum(bool(KANJI.match(c)) for c in match)
            i += len(match)
        else:
            i += 1
    return covered / total


def api_json(prompt: str, schema: dict, label: str) -> dict:
    key = os.getenv("OPENAI_API_KEY", "").strip()
    if not key:
        raise RuntimeError("OPENAI_API_KEY is not set. Add it as a GitHub Actions repository secret.")
    payload = {
        "model": os.getenv("OPENAI_MODEL", "gpt-6-luna"),
        "instructions": BASE_INSTRUCTIONS,
        "input": prompt,
        "reasoning": {"effort": "low"},
        "text": {"format": {"type": "json_schema", "name": label,
                            "strict": True, "schema": schema}},
        "max_output_tokens": 12000,
        "store": False,
    }
    request = urllib.request.Request(
        "https://api.openai.com/v1/responses",
        data=json.dumps(payload, ensure_ascii=False).encode("utf-8"),
        headers={"Content-Type": "application/json", "Authorization": "Bearer " + key},
        method="POST",
    )
    try:
        with urllib.request.urlopen(request, timeout=180) as response:
            result = json.load(response)
    except urllib.error.HTTPError as error:
        detail = error.read(1200).decode("utf-8", "replace")
        raise RuntimeError(f"OpenAI API HTTP {error.code}: {detail}") from error
    if result.get("status") not in ("completed", None):
        raise RuntimeError("OpenAI did not complete response: " + str(result.get("status")))
    pieces = [
        entry.get("text", "")
        for block in result.get("output", [])
        for entry in block.get("content", [])
        if entry.get("type") == "output_text"
    ]
    if not pieces:
        raise RuntimeError("OpenAI returned no structured output_text.")
    return json.loads("".join(pieces))


def reading_schema() -> dict:
    return {
        "type": "object",
        "properties": {
            "title": {"type": "string"},
            "intro": {"type": "string"},
            "paragraphs": {"type": "array", "items": {"type": "string"}},
            "vocabulary": {
                "type": "array",
                "items": {
                    "type": "object",
                    "properties": {
                        "word": {"type": "string"},
                        "reading": {"type": "string"},
                        "meaning": {"type": "string"},
                    },
                    "required": ["word", "reading", "meaning"],
                    "additionalProperties": False,
                },
            },
        },
        "required": ["title", "intro", "paragraphs", "vocabulary"],
        "additionalProperties": False,
    }


def review_schema() -> dict:
    option = {
        "type": "object",
        "properties": {"id": {"type": "string"}, "label": {"type": "string"}},
        "required": ["id", "label"],
        "additionalProperties": False,
    }
    question = {
        "type": "object",
        "properties": {
            "type": {"type": "string", "enum": ["text", "single", "multiple"]},
            "prompt": {"type": "string"},
            "options": {"type": "array", "items": option},
        },
        "required": ["type", "prompt", "options"],
        "additionalProperties": False,
    }
    return {
        "type": "object",
        "properties": {
            "title": {"type": "string"},
            "intro": {"type": "string"},
            "questions": {"type": "array", "items": question},
        },
        "required": ["title", "intro", "questions"],
        "additionalProperties": False,
    }


def prepare_reading(day: dt.date, previous: list, lexicon: dict) -> tuple[dict, dict]:
    topic, detail = TOPICS[day.toordinal() % len(TOPICS)]
    previous_titles = [r["title"] for r in previous[-12:]]
    prompt = (
        f"Generate the Japanese reading for {day.isoformat()} in Melbourne. Topic: {topic}. "
        f"Specific suggested context: {detail}. Avoid repeating these recent titles: "
        f"{json.dumps(previous_titles, ensure_ascii=False)}. "
        "Return exactly FOUR substantial paragraphs containing 300–550 Japanese characters "
        "in total (ignore newline separators). Write a 1–2 sentence English introduction. "
        "Provide an abundant vocabulary list: include most words containing kanji, "
        "including common N3/N4-level compounds and verbs with their exact inflected surface "
        "forms, plus specialist vocabulary. Aim for 65–100 meaningful entries and favour "
        "exact whole word / compound boundaries (no shorter substrings that would alter other "
        "words). Supply full hiragana readings with natural contextual English meanings. "
        "Vocabulary 'word' MUST appear verbatim in one of your four paragraphs. "
        "Be especially careful with kunyomi, rendaku, proper names and inflected words. "
        "Do not insert furigana brackets inside the paragraphs."
    )
    for attempt in range(1, 4):
        result = api_json(prompt, reading_schema(), "japanese_reading")
        paras = result.get("paragraphs", [])
        if not (len(paras) == 4 and all(isinstance(p, str) and len(p) >= 65 for p in paras)):
            print(f"Attempt {attempt}: invalid paragraph structure.")
            continue
        full = "".join(paras)
        if not 300 <= len(full) <= 550:
            print(f"Attempt {attempt}: passage length {len(full)}, expected 300–550.")
            continue
        merged = dict(lexicon)
        valid_terms = 0
        for entry in result.get("vocabulary", []):
            surface, reading, meaning = [entry.get(k, "").strip() for k in ("word", "reading", "meaning")]
            if not (surface and reading and meaning and surface in full and KANJI.search(surface)
                    and HIRAGANA.fullmatch(reading)):
                continue
            if surface not in merged:
                merged[surface] = [reading, meaning]
            valid_terms += 1
        coverage = kanji_coverage(full, merged)
        if coverage < 0.72 or valid_terms < 35:
            print(f"Attempt {attempt}: insufficient furigana coverage {coverage:.0%} ({valid_terms} valid entries).")
            continue
        record = {
            "date": day.isoformat(),
            "title": result["title"].strip(),
            "topic": topic,
            "intro": result["intro"].strip(),
            "paragraphs": paras,
        }
        if not record["title"] or not record["intro"]:
            continue
        print(f"Reading: {record['title']}; {len(full)} chars; kanji coverage {coverage:.0%}.")
        return record, merged
    raise RuntimeError("The reading failed length/furigana quality checks after three attempts.")


def prepare_review(day: dt.date, source: dict) -> dict:
    prompt = (
        f"Generate a separate reading-comprehension/vocabulary review for {day.isoformat()}. "
        f"The Japanese source reading is from {source['date']} and is titled {source['title']}. "
        f"Paragraphs: {json.dumps(source['paragraphs'], ensure_ascii=False)}. "
        "Make 8 varied numbered questions based on the exact passage: kanji reading "
        "production, kana-to-kanji production, contextual vocabulary meaning, natural polite "
        "Japanese phrasing, grammar and 1–2 reading-comprehension questions. "
        "Include at least 4 text-production questions, at least one single-choice and one "
        "multiple-choice question. Keep all questions natural and around N2. "
        "Return arrays of 4 {id,label} options labelled A,B,C,D for each choice question, "
        "and EMPTY options arrays for text questions. Never reveal answer keys, mark correct "
        "options, or put any private learning history or scores in the output. "
        "The website collects answers but ChatGPT reviews free text semantically."
    )
    for attempt in range(1, 3):
        result = api_json(prompt, review_schema(), "japanese_review")
        questions = result.get("questions", [])
        types = [q.get("type") for q in questions]
        if not (6 <= len(questions) <= 10 and types.count("text") >= 4
                and "single" in types and "multiple" in types):
            print(f"Attempt {attempt}: review question mix is invalid.")
            continue
        valid = True
        for q in questions:
            opts = q.get("options", [])
            if not isinstance(q.get("prompt"), str) or len(q["prompt"]) < 7:
                valid = False
            if q["type"] == "text" and opts:
                valid = False
            if q["type"] != "text" and (
                len(opts) != 4 or [o.get("id") for o in opts] != ["A", "B", "C", "D"]
                or any(not o.get("label") for o in opts)
            ):
                valid = False
        if not valid:
            print(f"Attempt {attempt}: invalid review options.")
            continue
        public_questions = [
            {"id": str(i), "type": q["type"], "prompt": q["prompt"], **(
                {"options": q["options"]} if q["type"] != "text" else {}
            )}
            for i, q in enumerate(questions, 1)
        ]
        return {
            "date": day.isoformat(),
            "sourceDate": source["date"],
            "title": result["title"].strip(),
            "intro": result["intro"].strip(),
            "questions": public_questions,
        }
    raise RuntimeError("Review failed question validation after two attempts.")


def main() -> int:
    mode = sys.argv[1] if len(sys.argv) > 1 else "dry_run"
    if mode not in ("dry_run", "publish"):
        raise ValueError("Usage: publish.py [dry_run|publish]")
    readings, reviews, lexicon = (read_data(n) for n in ("readings", "reviews", "lexicon"))
    validate_catalogue(readings, reviews, lexicon)
    day = local_date()
    print(f"Local date: {day.isoformat()}; review due: {review_due(day)}")
    print(f"Archive: {len(readings)} readings, {len(reviews)} review sets, {len(lexicon)} annotated terms.")
    if mode == "dry_run":
        print("DRY RUN PASSED — no OpenAI API request, JSON changes, or commit.")
        return 0
    changed_readings = False
    changed_reviews = False
    existing = next((r for r in readings if r["date"] == day.isoformat()), None)
    updated_lexicon = lexicon
    if existing:
        print("Today's reading already exists. No duplicate will be created.")
    else:
        new_reading, updated_lexicon = prepare_reading(day, readings, lexicon)
        readings.append(new_reading)
        changed_readings = True
    if review_due(day) and not any(r["date"] == day.isoformat() for r in reviews):
        yesterday = (day - dt.timedelta(days=1)).isoformat()
        source = next((r for r in readings if r["date"] == yesterday), None)
        if source is None:
            print("WARNING: Previous day's reading is missing; no review generated.")
        else:
            review = prepare_review(day, source)
            reviews.append(review)
            changed_reviews = True
            print(f"Review prepared for {review['sourceDate']}: {len(review['questions'])} questions.")
    validate_catalogue(readings, reviews, updated_lexicon)
    if changed_readings:
        write_data("readings", readings)
        if updated_lexicon != lexicon:
            write_data("lexicon", updated_lexicon)
    if changed_reviews:
        write_data("reviews", reviews)
    print("Done. Changes:", "reading" if changed_readings else "",
          "review" if changed_reviews else "", "lexicon" if updated_lexicon != lexicon else "")
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except (RuntimeError, ValueError, OSError, json.JSONDecodeError) as exc:
        print("PUBLISHING ERROR:", exc, file=sys.stderr)
        raise SystemExit(1)
