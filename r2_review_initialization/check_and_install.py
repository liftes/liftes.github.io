"""Check source fidelity and install only the two R2 reviewer subfiles."""
from pathlib import Path
import argparse
import hashlib
import json
import re
import shutil
import subprocess
import unicodedata

HERE = Path(__file__).resolve().parent
BASE = Path(r"C:\Users\79323\OneDrive\Working\2022-PolymerSimulations\Artical\@SlidePolymer-SCFT")
R1, R2 = BASE / "#ACS-R1", BASE / "#ACS-R2"
SOURCES = R2 / "#2st" / "@source"
FILES = [r"#2st\sections\Reviewer1.tex", r"#2st\sections\Reviewer2.tex"]


def sha(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def snapshot(root):
    return {str(p.relative_to(root)): sha(p) for p in root.rglob("*")
            if p.is_file() and p.suffix.lower() in {".tex", ".bib", ".sty", ".cls", ".md"}}


def canonical(text):
    text = unicodedata.normalize("NFKC", text)
    for name, symbol in {"phi": "φ", "chi": "χ", "Delta": "Δ", "leq": "≤"}.items():
        text = re.sub(r"\\" + name + r"(?![A-Za-z])", lambda _: symbol, text)
    text = re.sub(r"\\(?:text|mathrm)\b", "", text)
    text = re.sub(r"\\(?:begin|end)\{equation\*\}", "", text)
    text = re.sub(r"[${}_^]", "", text)
    return re.sub(r"\s+", "", text)


def blocks(text, environment):
    return re.findall(r"\\begin\{" + environment + r"\}(.*?)\\end\{" + environment + r"\}", text, re.S)


def validate_structure(text):
    code = re.sub(r"(?m)%[^\n]*", "", text)
    brace = 0
    for token in re.findall(r"\\(?:[A-Za-z@]+|[^\n])|[{}]", code):
        if token == "{":
            brace += 1
        elif token == "}":
            brace -= 1
            assert brace >= 0
    assert brace == 0
    stack = []
    for command, env in re.findall(r"\\(begin|end)\{([^}]+)\}", code):
        if command == "begin":
            stack.append(env)
        else:
            assert stack and stack.pop() == env
    assert not stack
    assert code.count("$") % 2 == 0
    assert not re.search(r"\\begin\{qa\}\s*\[", code)
    assert not re.search(r"\\(?:,|;|!)|\\mathbf\b", code)
    assert not re.search(r"\n[ \t]*\n[ \t]*\n[ \t]*\n", text)
    questions = blocks(text, "qa")
    replies = blocks(text, "reply")
    assert len(questions) == len(replies)
    assert all(reply.strip() == "Response to be added." for reply in replies)
    assert re.findall(r"\\begin\{(qa|reply)\}", text) == ["qa", "reply"] * len(questions)


def sources():
    decision = (SOURCES / "Decision.md").read_text(encoding="utf-8-sig")
    reviewer1 = decision.split("Reviewer: 1", 1)[1].split("Additional Questions:", 1)[0]
    reviewer1 = reviewer1.split("Comments:", 1)[1].strip()
    first = re.split(r"(?m)^\d+\.\s+", reviewer1)
    pdf = SOURCES / "7351126_File000012_143679827.pdf"
    second = subprocess.run(["pdftotext", "-raw", str(pdf), "-"],
                            capture_output=True, check=True).stdout.decode("utf-8")
    introduction, major = second.split("Major comments", 1)
    major, specific = major.split("More specific comments", 1)
    major = re.split(r"(?m)^\d+\.\s+", major)[1:]
    specific = re.split(r"(?m)^\d+\.\s+", specific)[1:]
    assert len(first[1:]) == 2 and len(major) == 2 and len(specific) == 4
    return [(first[0], first[1:]), (introduction, major + specific)]


def check(root):
    for n, (introduction, expected) in enumerate(sources(), start=1):
        file = root / f"Reviewer{n}.tex"
        text = file.read_text(encoding="utf-8-sig")
        validate_structure(text)
        actual_intro = blocks(text, "reviewercomment")
        assert len(actual_intro) == 1
        assert canonical(actual_intro[0]) == canonical(introduction), f"Reviewer {n} opening differs"
        actual = blocks(text, "qa")
        assert len(actual) == len(expected)
        for q, (source, target) in enumerate(zip(expected, actual), start=1):
            a, b = canonical(source), canonical(target)
            if a != b:
                mismatch = next((k for k, (x, y) in enumerate(zip(a, b)) if x != y), min(len(a), len(b)))
                raise AssertionError(f"Reviewer {n}, question {q}: {a[max(0,mismatch-30):mismatch+100]!r} != {b[max(0,mismatch-30):mismatch+100]!r}")
        if n == 2:
            assert re.findall(r"\\begin\{reviewergroup\}\{([^}]+)\}", text) == ["Major comments", "More specific comments"]
        print(f"PASS Reviewer {n}: opening and all {len(expected)} questions match source in order; math formatting normalized.")


def prepare():
    check(HERE)
    record = {"r1": snapshot(R1), "r2": snapshot(R2),
              "sources": {p.name: sha(p) for p in SOURCES.iterdir() if p.is_file()},
              "outputs": {relative: sha(HERE / Path(relative).name) for relative in FILES}}
    (HERE / "manifest.json").write_text(json.dumps(record, indent=2), encoding="utf-8")
    print("PASS braces, environments, placeholder safety, paragraph spacing; no compilation run.")


def install():
    record = json.loads((HERE / "manifest.json").read_text(encoding="utf-8"))
    assert snapshot(R1) == record["r1"]
    assert snapshot(R2) == record["r2"]
    assert {p.name: sha(p) for p in SOURCES.iterdir() if p.is_file()} == record["sources"]
    for relative, expected in record["outputs"].items():
        assert sha(HERE / Path(relative).name) == expected
        assert (R2 / relative).resolve().is_relative_to(R2.resolve())
    for relative in FILES:
        shutil.copyfile(HERE / Path(relative).name, R2 / relative)
    check(R2 / "#2st" / "sections")
    assert snapshot(R1) == record["r1"]
    current = snapshot(R2)
    assert current.keys() == record["r2"].keys()
    for relative, original in record["r2"].items():
        assert current[relative] == record["outputs"].get(relative, original), relative
    assert {p.name: sha(p) for p in SOURCES.iterdir() if p.is_file()} == record["sources"]
    print("PASS only two R2 reviewer subfiles changed; R1, source documents, main text, SI, and command definitions untouched.")
    print("No TeX compilation performed.")


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("mode", choices=("prepare", "install"))
    globals()[parser.parse_args().mode]()
