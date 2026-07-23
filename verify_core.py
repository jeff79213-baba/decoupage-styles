import sys

packages = [
    ("docx", "python-docx"),
    ("openpyxl", "openpyxl"),
    ("pptx", "python-pptx"),
    ("pypdf", "pypdf"),
    ("fitz", "PyMuPDF"),
    ("reportlab", "reportlab"),
    ("PIL", "pillow"),
    ("matplotlib", "matplotlib"),
    ("qrcode", "qrcode"),
    ("markitdown", "markitdown"),
]

ok = 0
fail = 0
for mod, name in packages:
    try:
        __import__(mod)
        print(f"  OK: {name}")
        ok += 1
    except ImportError as e:
        print(f"  FAIL: {name} - {e}")
        fail += 1

print(f"\nResult: {ok}/{ok+fail} packages OK")
sys.exit(0 if fail == 0 else 1)
