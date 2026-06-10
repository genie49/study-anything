#!/usr/bin/env python3
"""Validate a .soul/{track} bundle against the soul schema.

Purpose: the soul-structuring skill is the ONLY place an LLM runs in the
pipeline (raw -> soul -> db -> learning). The DB import and the learning
runtime are LLM-free, so every field the runtime needs MUST be baked here,
with NO omissions. This validator enforces that completeness deterministically
so a half-structured bundle fails loudly instead of producing broken cards.

Usage:
    validate_soul.py <path-to-.soul/{trackName}>

Exit code 0 = valid, 1 = errors found (printed to stderr).
"""
import argparse
import json
import sys
from pathlib import Path

CARD_TYPES = {"cloze", "qa", "mcq", "application"}
GRADING_MODES = {"exact", "mcq", "self", "keyword"}


def _err(errors, where, msg):
    errors.append(f"[{where}] {msg}")


def load_json(path, errors):
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except FileNotFoundError:
        _err(errors, str(path), "file not found")
    except json.JSONDecodeError as e:
        _err(errors, str(path), f"invalid JSON: {e}")
    return None


def validate_card(card, where, errors, card_keys):
    key = card.get("cardKey")
    if not key or not isinstance(key, str):
        _err(errors, where, "cardKey missing or not a string")
    else:
        if key in card_keys:
            _err(errors, where, f"duplicate cardKey '{key}'")
        card_keys.add(key)
        where = f"{where}#{key}"

    ctype = card.get("type")
    if ctype not in CARD_TYPES:
        _err(errors, where, f"type must be one of {sorted(CARD_TYPES)}, got {ctype!r}")

    for field in ("prompt", "answer"):
        if not card.get(field) or not isinstance(card.get(field), str):
            _err(errors, where, f"{field} missing or empty")

    # explanation strongly recommended (shown after grading; no runtime LLM)
    if not card.get("explanation"):
        _err(errors, where, "explanation missing (required so feedback needs no runtime LLM)")

    dp = card.get("difficultyPrior")
    if not isinstance(dp, (int, float)) or not (0.0 <= float(dp) <= 1.0):
        _err(errors, where, f"difficultyPrior must be a number in [0,1], got {dp!r}")

    grading = card.get("grading")
    if not isinstance(grading, dict):
        _err(errors, where, "grading object missing")
        return
    mode = grading.get("mode")
    if mode not in GRADING_MODES:
        _err(errors, where, f"grading.mode must be one of {sorted(GRADING_MODES)}, got {mode!r}")
        return

    # mode-specific completeness: this is what guarantees LLM-free runtime grading
    if mode == "exact":
        if not grading.get("acceptedAnswers"):
            _err(errors, where, "grading.mode=exact requires non-empty acceptedAnswers[]")
    elif mode == "keyword":
        if not grading.get("keywords"):
            _err(errors, where, "grading.mode=keyword requires non-empty keywords[]")
    elif mode == "mcq":
        if ctype != "mcq":
            _err(errors, where, "grading.mode=mcq only valid for type=mcq")
        if not card.get("distractors"):
            _err(errors, where, "grading.mode=mcq requires non-empty distractors[]")
    elif mode == "self":
        if not grading.get("rubric"):
            _err(errors, where, "grading.mode=self requires non-empty rubric[] (self-grading checkpoints)")


def main():
    ap = argparse.ArgumentParser(description="Validate a .soul/{track} bundle.")
    ap.add_argument("track_dir", help="path to .soul/{trackName}")
    args = ap.parse_args()

    root = Path(args.track_dir)
    errors = []
    if not root.is_dir():
        print(f"[{root}] not a directory", file=sys.stderr)
        sys.exit(1)

    manifest = load_json(root / "manifest.json", errors)
    deck_slugs = []
    if isinstance(manifest, dict):
        if manifest.get("soulVersion") != 1:
            _err(errors, "manifest", "soulVersion must be 1")
        for f in ("trackSlug", "title"):
            if not manifest.get(f):
                _err(errors, "manifest", f"{f} missing")
        decks = manifest.get("decks")
        if not isinstance(decks, list) or not decks:
            _err(errors, "manifest", "decks[] missing or empty")
        else:
            for i, d in enumerate(decks):
                slug = d.get("slug")
                if not slug:
                    _err(errors, f"manifest.decks[{i}]", "slug missing")
                else:
                    deck_slugs.append(slug)
                for f in ("title", "order"):
                    if d.get(f) is None:
                        _err(errors, f"manifest.decks[{slug}]", f"{f} missing")

    # collect all concept keys across decks first (for confusableWith resolution)
    concept_keys = set()
    card_keys = set()
    deck_payloads = {}
    for slug in deck_slugs:
        payload = load_json(root / "decks" / f"{slug}.json", errors)
        if not isinstance(payload, dict):
            continue
        deck_payloads[slug] = payload
        if payload.get("deckSlug") != slug:
            _err(errors, f"decks/{slug}", f"deckSlug mismatch (file says {payload.get('deckSlug')!r})")
        for c in payload.get("concepts", []) or []:
            ck = c.get("conceptKey")
            if ck:
                if ck in concept_keys:
                    _err(errors, f"decks/{slug}", f"duplicate conceptKey '{ck}'")
                concept_keys.add(ck)

    # validate concepts + cards
    for slug, payload in deck_payloads.items():
        concepts = payload.get("concepts")
        if not isinstance(concepts, list) or not concepts:
            _err(errors, f"decks/{slug}", "concepts[] missing or empty")
            continue
        for c in concepts:
            ck = c.get("conceptKey") or "?"
            where = f"decks/{slug}:{ck}"
            if not c.get("conceptKey"):
                _err(errors, where, "conceptKey missing")
            for f in ("title", "bodyMd"):
                if not c.get(f):
                    _err(errors, where, f"{f} missing")
            if c.get("order") is None:
                _err(errors, where, "order missing")
            for ref in c.get("confusableWith", []) or []:
                if ref not in concept_keys:
                    _err(errors, where, f"confusableWith references unknown conceptKey '{ref}'")
            cards = c.get("cards")
            if not isinstance(cards, list) or not cards:
                _err(errors, where, "cards[] missing or empty (every concept needs retrieval items)")
                continue
            for card in cards:
                validate_card(card, where, errors, card_keys)

    if errors:
        print(f"❌ {len(errors)} error(s) in {root}:", file=sys.stderr)
        for e in errors:
            print("  - " + e, file=sys.stderr)
        sys.exit(1)
    print(f"✅ valid: {root}  ({len(concept_keys)} concepts, {len(card_keys)} cards)")


if __name__ == "__main__":
    main()
