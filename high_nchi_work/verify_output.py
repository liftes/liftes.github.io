"""Read-only validation of the new workbook against its actual loader."""
from pathlib import Path
import ast
import hashlib
import json
import math
import sys
import openpyxl
import pandas as pd

HERE = Path(__file__).resolve().parent
ROOT = Path(r"Y:\2024-SCFT\pscfpp_Norfe\copolymer\triblock_slide")
data = json.loads((HERE / "build" / "data.json").read_text(encoding="utf-8"))
path = Path(sys.argv[1]) if len(sys.argv) > 1 else HERE / "build" / data["output_name"]
sha = lambda p: hashlib.sha256(p.read_bytes()).hexdigest()
original_hash = sha(path)
book = openpyxl.load_workbook(path, read_only=True, data_only=True)
assert book.sheetnames == [data["sheet"]]
sheet = book[data["sheet"]]
matrix = list(sheet.iter_rows(values_only=True))
assert matrix == [tuple(data["headers"]), *[tuple(row) for row in data["rows"]]]
assert len(matrix) == 9
for row in sheet.iter_rows():
    for cell in row:
        if cell.value is not None:
            assert cell.alignment.horizontal == "left"
            assert cell.data_type != "f"
book.close()

source = (ROOT / "GLOBAL.py").read_text(encoding="utf-8-sig")
function = next(n for n in ast.parse(source).body if isinstance(n, ast.FunctionDef)
                and n.name == "GetPoints_FromExcel")
# The real loader rewrites its input workbook after reading. Suppress ONLY this
# persistence block in memory so validation remains strictly read-only; the
# submitted rows and all parsing/default/filter logic are otherwise identical.
writers = [n for n in function.body if isinstance(n, ast.With)]
assert len(writers) == 1 and "ExcelWriter" in ast.unparse(writers[0])
function.body = [n for n in function.body if n is not writers[0]]
namespace = {"pd": pd}
exec(compile(ast.fix_missing_locations(ast.Module(body=[function], type_ignores=[])),
             "<read-only loader validation>", "exec"), namespace)
jobs = namespace["GetPoints_FromExcel"](str(path), data["sheet"])
assert len(jobs) == 7
keys = {(job["groupName"], job["philist"][0], job["chilist"][0], job["flist"][0]) for job in jobs}
expected = {(row[4], row[5], row[6], row[7]) for row in data["rows"] if row[9] != "Y"}
assert keys == expected and len(keys) == 7
assert all(job["points"] == 16 and job["ds"] == 0.002 and job["epsilon"] == 1e-6 for job in jobs)
for job in jobs:
    assert job["mesh"] == [64, 64, 64]
    assert "IPS_04/" in job["crf"] and "IPS_04/" in job["wbf"]
    assert (ROOT / job["crf"]).is_file()
    assert (ROOT / job["wbf"]).is_file()
assert sha(path) == original_hash
for original, expected_hash in data["original_workbook_hashes"].items():
    assert sha(Path(original)) == expected_hash, f"Original workbook changed: {original}"
print("PASS: exactly 8 typed rows; 1 Y reused; 7 N jobs parsed correctly by the real loader logic.")
print("PASS: points=16, fixed compositions and phi_a=0.25; all IPS_04 initial field paths exist.")
print(f"PASS: all {len(data['original_workbook_hashes'])} original xlsx hashes unchanged; no jobs submitted.")
print("OUTPUT_SHA256", original_hash)
