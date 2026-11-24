"""Read-only inventory of SCFT workbooks; write only local JSON evidence."""
from pathlib import Path
from collections import Counter
import hashlib
import json
import re
import openpyxl

ROOT = Path(r"Y:\2024-SCFT\pscfpp_Norfe\copolymer\triblock_slide")
EXCELS = ROOT / "Excels"
OUT = Path(__file__).resolve().parent / "high_nchi_work"
OUT.mkdir(exist_ok=True)
TARGETS = {"I_m_-3_m": 0.85, "P_1": 0.50}


def sha(p):
    return hashlib.sha256(p.read_bytes()).hexdigest()


def number(value):
    try:
        return float(value)
    except (TypeError, ValueError):
        return None


paths = sorted(p for p in EXCELS.rglob("*.xlsx") if not p.name.startswith("~$"))
record = {"hashes": {str(p): sha(p) for p in paths}, "files": [], "matches": [], "errors": []}
for p in paths:
    try:
        book = openpyxl.load_workbook(p, read_only=True, data_only=True)
        info = {"file": str(p.relative_to(EXCELS)), "sheets": []}
        for sheet in book:
            header = None
            count = 0
            for rownum, row in enumerate(sheet.iter_rows(values_only=True), start=1):
                if header is None:
                    candidate = [str(v).strip() if v is not None else "" for v in row]
                    if "GroupName" in candidate and "phi_A" in candidate and "chi" in candidate:
                        header = candidate
                    elif rownum >= 15:
                        break
                    continue
                data = {k: v for k, v in zip(header, row) if k}
                group = str(data.get("GroupName", "")).strip()
                if group not in TARGETS or number(data.get("phi_a")) != 0.25:
                    continue
                phi = number(data.get("phi_A"))
                if phi is None:
                    continue
                same_phi = abs(phi - TARGETS[group]) < 1e-8
                # Keep exact-composition candidates plus nearby rows as fallback.
                if not same_phi and abs(phi - TARGETS[group]) > 0.03:
                    continue
                path = str(data.get("init_crf", ""))
                match = re.search(r"IPS_(\d+)", path)
                inferred = int(match[1]) if match else None
                point_value = number(data.get("Points"))
                points = int(point_value) if point_value is not None else inferred
                data.update({"_file": str(p.relative_to(EXCELS)), "_sheet": sheet.title,
                             "_row": rownum, "_points": points, "_path_points": inferred,
                             "_exact_phi": same_phi})
                record["matches"].append(data)
                count += 1
            info["sheets"].append({"name": sheet.title, "rows": sheet.max_row,
                                   "headers": header, "matches": count})
        record["files"].append(info)
        book.close()
    except Exception as error:
        record["errors"].append({"file": str(p), "error": str(error)})
assert all(sha(Path(p)) == expected for p, expected in record["hashes"].items())
(OUT / "inventory.json").write_text(json.dumps(record, indent=2, ensure_ascii=False), encoding="utf-8")
print(json.dumps({"workbooks": len(paths), "sheets": sum(len(f['sheets']) for f in record['files']),
                  "errors": record["errors"], "matching_rows": len(record['matches'])}, ensure_ascii=True))
for group in TARGETS:
    rows = [r for r in record["matches"] if r["GroupName"] == group and r["_exact_phi"]]
    counts = Counter((r["_points"], str(r.get("isOK")), r.get("chi")) for r in rows)
    print(group, json.dumps([{ "points": k[0], "isOK": k[1], "chi": k[2], "count": v}
                            for k, v in sorted(counts.items(), key=lambda x: str(x[0]))], ensure_ascii=True))
    relevant = [r for r in rows if number(r.get("chi")) in (45, 90, 135, 180)
                or (r["_points"] == 4 and str(r.get("isOK")) == "Y" and number(r.get("chi")) >= 40)]
    print(json.dumps(relevant[:40], ensure_ascii=True, default=str))
