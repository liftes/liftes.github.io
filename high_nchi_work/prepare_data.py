"""Prepare eight submission rows from read-only workbook evidence."""
from pathlib import Path
import hashlib
import json
import math
import re

HERE = Path(__file__).resolve().parent
ROOT = Path(r"Y:\2024-SCFT\pscfpp_Norfe\copolymer\triblock_slide")
inventory = json.loads((HERE / "inventory.json").read_text(encoding="utf-8"))
HEADERS = ["Points", "Name", "lattice", "N_cell_param", "GroupName", "phi_A",
           "chi", "phi_a", "init_crf", "isOK", "minF", "mu", "ds", "epsilon"]
rows, evidence = [], []
for name, lattice, ncell, group, phi in [("BCC", "cubic", 1, "I_m_-3_m", 0.85),
                                         ("L", "triclinic", 6, "P_1", 0.50)]:
    candidates = [r for r in inventory["matches"] if r["GroupName"] == group
                  and r["_exact_phi"] and str(r.get("isOK")).strip() == "Y"]
    seeds = [r for r in candidates if r["_points"] == r["_path_points"] == 4 and r["chi"] == 45]
    seeds.sort(key=lambda r: (r["_file"] != r"@phia_0.25\StepbyStep.xlsx", r["_row"]))
    assert seeds
    seed = seeds[0]
    for chi in (45, 90, 135, 180):
        reusable = [r for r in candidates if r["_points"] == r["_path_points"] == 16 and r["chi"] == chi]
        reusable.sort(key=lambda r: (r["_file"] != "Blocks.xlsx", r["_sheet"].endswith("-Pf")))
        source = reusable[0] if reusable else seed
        flag = "Y" if reusable else "N"
        source_path = ROOT / source["init_crf"]
        file_evidence = {}
        for filename in ("c.rf", "w.bf", "data.dat"):
            path = source_path / filename
            assert path.is_file() and path.stat().st_size > 0, str(path)
            file_evidence[filename] = path.stat().st_size
        thermo = (source_path / "data.dat").read_text(encoding="utf-8", errors="replace")
        free = float(re.search(r"fHelmholtz\s+(\S+)", thermo)[1])
        assert math.isfinite(free)
        assert abs(free - float(source["minF"])) < 1e-9
        result_path = ROOT / f"out/IPS_16/@Phase/{lattice}/{group}/pA_{phi:.4f}-pa_0.2500-NX_{chi:.4f}"
        if not reusable:
            assert not (result_path / "data.dat").exists(), f"Unindexed result exists: {result_path}"
        row = {"Points": 16, "Name": name, "lattice": lattice, "N_cell_param": ncell,
               "GroupName": group, "phi_A": phi, "chi": chi, "phi_a": 0.25,
               "init_crf": source["init_crf"], "isOK": flag,
               "minF": source["minF"] if reusable else None,
               "mu": source["mu"] if reusable else None,
               "ds": source.get("ds") or 0.002, "epsilon": source.get("epsilon") or 1e-6}
        rows.append([row[h] for h in HEADERS])
        evidence.append({"phase": name, "chi": chi, "isOK": flag,
                         "source_file": source["_file"], "source_sheet": source["_sheet"],
                         "source_row": source["_row"], "source_points": source["_points"],
                         "source_path": source["init_crf"], "files": file_evidence,
                         "data_dat_free_energy": free})
assert len(rows) == 8
assert sum(r[HEADERS.index("isOK")] == "Y" for r in rows) == 1
for path, expected in inventory["hashes"].items():
    assert hashlib.sha256(Path(path).read_bytes()).hexdigest() == expected, path
data = {"sheet": "HighNchi", "headers": HEADERS, "rows": rows, "evidence": evidence,
        "original_workbook_hashes": inventory["hashes"],
        "output_name": "BlocksForHighNchi.xlsx"}
(HERE / "build" / "data.json").write_text(json.dumps(data, indent=2), encoding="utf-8")
print(json.dumps({"rows": len(rows), "reuse_Y": 1, "submit_N": 7,
                  "seeds": [{"phase": e["phase"], "source": e["source_path"],
                             "workbook": e["source_file"], "sheet": e["source_sheet"],
                             "row": e["source_row"]} for e in evidence if e["chi"] == 90]}, indent=2))
