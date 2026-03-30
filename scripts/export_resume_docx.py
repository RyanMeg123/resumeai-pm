#!/usr/bin/env python3
"""Update a DOCX resume while preserving layout as much as possible."""

from __future__ import annotations

import argparse
import json
import re
from copy import deepcopy
from difflib import SequenceMatcher
from pathlib import Path
from typing import Iterable

from docx import Document
from docx.text.paragraph import Paragraph


def normalize(text: str) -> str:
    text = text.replace("\xa0", " ")
    text = re.sub(r"\s+", " ", text)
    return text.strip()


def iter_paragraphs(parent) -> Iterable[Paragraph]:
    for paragraph in getattr(parent, "paragraphs", []):
        yield paragraph

    for table in getattr(parent, "tables", []):
        for row in table.rows:
            for cell in row.cells:
                yield from iter_paragraphs(cell)


def clear_paragraph(paragraph: Paragraph) -> None:
    element = paragraph._element
    for child in list(element):
        if child.tag.endswith("pPr"):
            continue
        element.remove(child)


def add_text_with_style(paragraph: Paragraph, text: str, sample_run) -> None:
    lines = text.splitlines() or [text]
    for index, line in enumerate(lines):
        run = paragraph.add_run(line)
        if sample_run is not None and sample_run._element.rPr is not None:
            run._element.append(deepcopy(sample_run._element.rPr))
        if index < len(lines) - 1:
            run.add_break()


def replace_paragraph_span(paragraphs: list[Paragraph], replacement_text: str) -> None:
    if not paragraphs:
        return

    sample_run = None
    for run in paragraphs[0].runs:
        if normalize(run.text):
            sample_run = run
            break
    if sample_run is None and paragraphs[0].runs:
        sample_run = paragraphs[0].runs[0]

    clear_paragraph(paragraphs[0])
    add_text_with_style(paragraphs[0], replacement_text, sample_run)

    for paragraph in paragraphs[1:]:
        clear_paragraph(paragraph)


def score_candidate(target: str, candidate: str, project_name: str) -> float:
    if not candidate:
        return 0.0

    score = SequenceMatcher(None, target, candidate).ratio()

    if target in candidate or candidate in target:
        score += 0.2

    if project_name and project_name in candidate:
        score += 0.05

    return score


def find_best_span(
    paragraphs: list[Paragraph], target_text: str, project_name: str
) -> tuple[int, int, float] | None:
    target = normalize(target_text)
    if not target:
        return None

    best: tuple[int, int, float] | None = None

    for start in range(len(paragraphs)):
        for span_len in range(1, 4):
            end = start + span_len
            if end > len(paragraphs):
                break

            span_text = normalize(
                "\n".join(paragraph.text for paragraph in paragraphs[start:end])
            )
            score = score_candidate(target, span_text, normalize(project_name))

            if best is None or score > best[2]:
                best = (start, end, score)

    return best


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--input", required=True)
    parser.add_argument("--output", required=True)
    parser.add_argument("--replacements", required=True)
    args = parser.parse_args()

    input_path = Path(args.input)
    output_path = Path(args.output)
    replacements_path = Path(args.replacements)

    document = Document(str(input_path))
    replacements = json.loads(replacements_path.read_text("utf-8"))

    paragraphs = [paragraph for paragraph in iter_paragraphs(document) if normalize(paragraph.text)]
    unmatched: list[str] = []
    matched_count = 0

    for replacement in replacements:
        original = replacement.get("original", "")
        updated = replacement.get("updated", "")
        project_name = replacement.get("name", "")

        best = find_best_span(paragraphs, original, project_name)
        if best is None or best[2] < 0.45:
            unmatched.append(project_name or original[:50])
            continue

        start, end, _ = best
        replace_paragraph_span(paragraphs[start:end], updated)
        matched_count += 1

    output_path.parent.mkdir(parents=True, exist_ok=True)
    document.save(str(output_path))

    print(
        json.dumps(
            {
                "matched": matched_count,
                "unmatched": unmatched,
            },
            ensure_ascii=False,
        )
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
