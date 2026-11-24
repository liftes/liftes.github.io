"""Restore R1 preambles into cleaned R2 sources without compiling TeX."""
from pathlib import Path
import argparse
import json
import re
import shutil

from r2_cleanup import R1, R2, STAGE, active, body, digest, source_hashes, structures

RESTORE = STAGE / "restored_definitions"
FILES = ("Manuscript.tex", "SupportingInformation.tex", r"#1st\ResponsetoReviewers.tex")
BOUNDARY = rb"\begin{document}"
OLD_MARK = re.compile(r"\\(?:ntqpoint|ntq|ntr|ntb|nto|ntg|ntp|ntt|ntc)\b|rev:")


def prepare():
    RESTORE.mkdir(exist_ok=True)
    record = {"r1": source_hashes(R1), "r2": source_hashes(R2), "changes": {}, "bodies": {}}
    for relative in FILES:
        original = (R1 / relative).read_bytes()
        cleaned = (R2 / relative).read_bytes()
        prefix, _, _ = original.partition(BOUNDARY)
        _, marker, unchanged_body = cleaned.partition(BOUNDARY)
        assert marker, relative
        restored = prefix + marker + unchanged_body
        text = restored.decode("utf-8-sig")
        structures(text)
        assert restored.partition(BOUNDARY)[0] == original.partition(BOUNDARY)[0]
        assert restored.partition(BOUNDARY)[2] == unchanged_body
        assert not OLD_MARK.search(active(body(text))), relative
        path = RESTORE / relative
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_bytes(restored)
        record["changes"][relative] = digest(restored)
        record["bodies"][relative] = digest(unchanged_body)
    (RESTORE / "manifest.json").write_text(json.dumps(record, indent=2), encoding="utf-8")
    print("Prepared 3 files: R1 preambles restored byte-for-byte; cleaned R2 bodies unchanged.")


def install():
    record = json.loads((RESTORE / "manifest.json").read_text(encoding="utf-8"))
    assert source_hashes(R1) == record["r1"], "R1 changed during preparation"
    assert source_hashes(R2) == record["r2"], "R2 changed during preparation"
    for relative, expected in record["changes"].items():
        assert digest((RESTORE / relative).read_bytes()) == expected
        assert (R2 / relative).resolve().is_relative_to(R2.resolve())
    for relative in FILES:
        shutil.copyfile(RESTORE / relative, R2 / relative)
    assert source_hashes(R1) == record["r1"], "R1 hashes changed"
    after = source_hashes(R2)
    for relative, before in record["r2"].items():
        assert after[relative] == record["changes"].get(relative, before), relative
    for relative in FILES:
        data = (R2 / relative).read_bytes()
        assert data.partition(BOUNDARY)[0] == (R1 / relative).read_bytes().partition(BOUNDARY)[0]
        assert digest(data.partition(BOUNDARY)[2]) == record["bodies"][relative]
        structures(data.decode("utf-8-sig"))
    for path in (R2 / "sections").glob("*.tex"):
        assert not OLD_MARK.search(active(path.read_text(encoding="utf-8-sig"))), str(path)
    for name in ("Reviewer1.tex", "Reviewer2.tex"):
        text = (R2 / "#1st" / "sections" / name).read_text(encoding="utf-8-sig")
        assert text.count(r"\begin{reviewersection}") == 1
        assert text.count(r"\begin{qa}") == 1
        assert text.count(r"\begin{reply}") == 1
    print("PASS: 3 R2 preambles match R1 byte-for-byte, including all reusable command definitions.")
    print("PASS: cleaned document bodies, section files, and two reviewer placeholders are unchanged.")
    print("PASS: braces/environments checked; R1 source hashes unchanged; no compilation performed.")


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("mode", choices=("prepare", "install"))
    globals()[parser.parse_args().mode]()
