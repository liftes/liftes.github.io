"""Prepare/apply a bounded ACS-R2 source cleanup; never compile TeX."""
from pathlib import Path
from collections import Counter
import argparse
import hashlib
import json
import re
import shutil

BASE = Path(r"C:\Users\79323\OneDrive\Working\2022-PolymerSimulations\Artical\@SlidePolymer-SCFT")
R1, R2 = BASE / "#ACS-R1", BASE / "#ACS-R2"
STAGE = Path(__file__).resolve().parent / "r2_cleanup_staging"
MARKS = {"ntr": 1, "ntb": 1, "nto": 1, "ntg": 1, "ntp": 1, "ntt": 1,
         "ntc": 2, "ntq": 2, "ntqpoint": 1}


def digest(data):
    return hashlib.sha256(data).hexdigest()


def active(text):
    return re.sub(r"\\[\s\S]|%[^\n]*", lambda m: "" if m[0].startswith("%") else m[0], text)


def group(text, pos):
    while pos < len(text) and text[pos].isspace():
        pos += 1
    if text[pos:pos + 1] != "{":
        raise ValueError(f"Expected braced argument near {text[pos:pos + 60]!r}")
    begin, depth = pos + 1, 1
    pos += 1
    while pos < len(text):
        if text[pos] == "\\":
            match = re.match(r"\\(?:[A-Za-z@]+|[\s\S])", text[pos:])
            pos += len(match[0])
            continue
        if text[pos] == "%":
            end = text.find("\n", pos)
            pos = len(text) if end < 0 else end + 1
            continue
        if text[pos] == "{":
            depth += 1
        elif text[pos] == "}":
            depth -= 1
            if depth == 0:
                return text[begin:pos], pos + 1
        pos += 1
    raise ValueError("Unbalanced revision argument")


def unwrap(text, counts):
    output, pos = [], 0
    while pos < len(text):
        if text[pos] == "%":
            end = text.find("\n", pos)
            end = len(text) if end < 0 else end + 1
            output.append(text[pos:end])
            pos = end
        elif text[pos] == "\\":
            match = re.match(r"\\(?:[A-Za-z@]+|[\s\S])", text[pos:])
            token = match[0]
            pos += len(token)
            name = token[1:]
            if name not in MARKS:
                output.append(token)
                continue
            args = []
            for _ in range(MARKS[name]):
                arg, pos = group(text, pos)
                args.append(arg)
            counts[name] += 1
            if name != "ntqpoint":
                output.append(unwrap(args[-1], counts))
        else:
            output.append(text[pos])
            pos += 1
    return "".join(output)


def clean(text, counts):
    # Remove the legacy annotation scaffolding, retaining line-number styling.
    if "% NT revision colors" in text:
        start = text.rfind("% ============================================================", 0,
                           text.index("% NT revision colors"))
        endpoint = text.index("\n}", text.index("\\NewDocumentCommand{\\ntqpoint}")) + 2
        replacement = ("% Line-number appearance\n\\usepackage{xcolor}\n\\usepackage{xparse}\n"
                       "\\renewcommand{\\linenumberfont}{%\n"
                       "  \\normalfont\n  \\tiny\n  \\color{black}%\n}\n")
        text = text[:start] + replacement + text[endpoint:]
    text = re.sub(r"% 中文批注\n.*?(?=\\usepackage\{lineno\})", "", text, flags=re.S)
    # One obsolete revision wrapper is itself commented out in the SI.
    text = re.sub(r"(?m)^[ \t]*% \\ntq\{[^{}]+\}\{[^\n]*\n((?:[ \t]*%[^\n]*\n)*?)[ \t]*% \}[ \t]*(?=\n|$)",
                  lambda m: m[1].rstrip("\n"), text)
    return unwrap(text, counts)


def body(text):
    return text.split(r"\begin{document}", 1)[-1]


def signature(text):
    # Preserve control-word boundaries, escaped characters, and all non-space
    # source characters; ignore only comments and layout whitespace.
    return re.findall(r"\\(?:[A-Za-z@]+|[^\n])|[^\s]", active(text))


def structures(text):
    code = active(text)
    stack = []
    for match in re.finditer(r"\\(?:[A-Za-z@]+|[\s\S])|[{}]", code):
        if match[0] == "{":
            stack.append(match.start())
        elif match[0] == "}":
            assert stack, f"Unmatched closing brace at {match.start()}"
            stack.pop()
    assert not stack, f"Unclosed braces: {stack}"
    stack = []
    for kind, env in re.findall(r"\\(begin|end)\{([^{}]+)\}", code):
        if kind == "begin":
            stack.append(env)
        else:
            assert stack and stack.pop() == env, f"Environment mismatch at {env}"
    assert not stack, f"Unclosed environments: {stack}"


def source_hashes(root):
    return {str(p.relative_to(root)): digest(p.read_bytes()) for p in root.rglob("*")
            if p.is_file() and p.suffix.lower() in {".tex", ".bib", ".cls", ".sty", ".md"}}


def prepare():
    STAGE.mkdir(exist_ok=True)
    sources = [R2 / "Manuscript.tex", R2 / "SupportingInformation.tex", *sorted((R2 / "sections").glob("*.tex"))]
    report = {"r1_before": source_hashes(R1), "r2_before": source_hashes(R2), "changes": {},
              "baseline_differences": [], "counts": {}}
    for path in sources:
        relative = str(path.relative_to(R2))
        original = path.read_bytes()
        ref = R1 / relative
        if not ref.exists() or original != ref.read_bytes():
            report["baseline_differences"].append(relative)
        text = original.decode("utf-8-sig").replace("\r\n", "\n")
        counts = Counter()
        cleaned = clean(text, counts)
        reference_body = unwrap(body(text), Counter())
        assert signature(reference_body) == signature(body(cleaned)), f"Body changed: {relative}"
        assert not re.search(r"\\(?:ntqpoint|ntq|ntr|ntb|nto|ntg|ntp|ntt|ntc)\b|rev:|ntshowcolor", cleaned), relative
        structures(cleaned)
        report["counts"][relative] = dict(counts)
        if cleaned != text:
            staged = STAGE / relative
            staged.parent.mkdir(parents=True, exist_ok=True)
            newline = "\r\n" if b"\r\n" in original else "\n"
            staged.write_bytes(cleaned.replace("\n", newline).encode("utf-8"))
            report["changes"][relative] = digest(staged.read_bytes())
    # Keep the existing class and reviewer subfile workflow, with no old answers,
    # old manuscript ID, old revision links, or empty bibliography invocation.
    response = r"""\documentclass[en]{response}
\usepackage{subfiles}

\title{Response to Reviewers}

\begin{document}

\maketitle

% Replace the following placeholder when the new manuscript ID is available.
\noindent\textbf{Manuscript ID:} [To be added.]


\responsecontents[2]

\newpage
\subfile{sections/Reviewer1}
\newpage
\subfile{sections/Reviewer2}

\end{document}
"""
    reviewer = r"""% !TeX root = ../ResponsetoReviewers.tex
\documentclass[../ResponsetoReviewers.tex]{subfiles}
\begin{document}

\begin{reviewersection}

\begin{qa}
    [Reviewer comment to be added.]
\end{qa}
\begin{reply}
    [Response to be added.]
\end{reply}

\end{reviewersection}

\end{document}
"""
    for relative, text in {r"#1st\ResponsetoReviewers.tex": response,
                           r"#1st\sections\Reviewer1.tex": reviewer,
                           r"#1st\sections\Reviewer2.tex": reviewer}.items():
        structures(text)
        target = STAGE / relative
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_bytes(text.encode("utf-8"))
        report["changes"][relative] = digest(target.read_bytes())
    assert source_hashes(R1) == report["r1_before"]
    (STAGE / "manifest.json").write_text(json.dumps(report, indent=2), encoding="utf-8")
    print(json.dumps({key: report[key] for key in ("baseline_differences", "counts", "changes")}, indent=2))


def install():
    report = json.loads((STAGE / "manifest.json").read_text(encoding="utf-8"))
    assert source_hashes(R1) == report["r1_before"], "R1 changed since preparation"
    assert source_hashes(R2) == report["r2_before"], "R2 changed since preparation"
    # Validate every input before the first write, then install only the listed
    # R2 TeX sources. In particular, no path under R1 is ever a write target.
    for relative, expected in report["changes"].items():
        assert digest((STAGE / relative).read_bytes()) == expected
        assert (R2 / relative).resolve().is_relative_to(R2.resolve())
    for relative in report["changes"]:
        shutil.copyfile(STAGE / relative, R2 / relative)
    verify()


def verify():
    report = json.loads((STAGE / "manifest.json").read_text(encoding="utf-8"))
    assert source_hashes(R1) == report["r1_before"], "R1 was modified"
    current = source_hashes(R2)
    for relative, old in report["r2_before"].items():
        assert current[relative] == report["changes"].get(relative, old), relative
    for relative in report["changes"]:
        text = (R2 / relative).read_text(encoding="utf-8")
        structures(text)
        assert not re.search(r"\\(?:ntqpoint|ntq|ntr|ntb|nto|ntg|ntp|ntt|ntc)\b|rev:|ntshowcolor", text)
    print(f"PASS: {len(report['changes'])} R2 TeX files installed; R1 hashes unchanged; other R2 sources unchanged.")
    print("PASS: revision wrappers/anchors removed, body token equality, braces/environments checked. No compilation run.")


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("mode", choices=("prepare", "install", "verify"))
    globals()[parser.parse_args().mode]()
