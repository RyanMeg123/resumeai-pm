#!/usr/bin/env python3
"""Create a PDF-friendly DOCX copy without changing the overall layout."""

from __future__ import annotations

import argparse
import re
import xml.etree.ElementTree as ET
from pathlib import Path
from zipfile import ZIP_DEFLATED, ZipFile


WORD_NS = "http://schemas.openxmlformats.org/wordprocessingml/2006/main"
NS = {"w": WORD_NS}
ET.register_namespace("w", WORD_NS)


def strip_leading_title_artifact(root: ET.Element) -> None:
    for paragraph in root.findall(".//w:body/w:p", NS):
        texts = paragraph.findall(".//w:t", NS)
        if not texts:
            continue

        joined = "".join(text.text or "" for text in texts).strip()
        if not joined:
            continue

        cleaned = re.sub(r"^[A-Za-z]\s*(?=[\u4e00-\u9fff])", "", joined, count=1)
        if cleaned == joined:
            return

        remainder = cleaned
        for text in texts:
            current = text.text or ""
            if not current:
                continue
            if remainder:
                text.text = remainder
                remainder = ""
            else:
                text.text = ""
        return


def patch_document_xml(document_text: str) -> str:
    root = ET.fromstring(document_text)
    strip_leading_title_artifact(root)

    for paragraph in root.findall(".//w:p", NS):
        paragraph_props = paragraph.find("w:pPr", NS)
        if paragraph_props is None:
            continue

        num_props = paragraph_props.find("w:numPr", NS)
        if num_props is None:
            continue

        num_id = num_props.find("w:numId", NS)
        if num_id is None:
            continue

        paragraph_props.remove(num_props)

    return ET.tostring(root, encoding="unicode")


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--input", required=True)
    parser.add_argument("--output", required=True)
    args = parser.parse_args()

    input_path = Path(args.input)
    output_path = Path(args.output)
    output_path.parent.mkdir(parents=True, exist_ok=True)

    with ZipFile(input_path) as source_zip, ZipFile(
        output_path, "w", ZIP_DEFLATED
    ) as target_zip:
        for item in source_zip.infolist():
            data = source_zip.read(item.filename)

            if item.filename == "word/document.xml":
                text = data.decode("utf-8", "ignore")
                data = patch_document_xml(text).encode("utf-8")

            target_zip.writestr(item, data)

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
