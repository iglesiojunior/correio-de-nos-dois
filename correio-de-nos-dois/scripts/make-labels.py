"""
Gera o PDF das etiquetas (A4, 3 x 6 por folha, com linhas de corte).

    python scripts/make-labels.py

Lê secrets/paper-keys.json e secrets/labels-config.json (escrito por `npm run keys`)
e grava secrets/etiquetas.pdf. O PDF contém as chaves: trate como segredo.
"""
import json
import sys
from pathlib import Path

from reportlab.graphics import renderPDF
from reportlab.graphics.barcode.qr import QrCodeWidget
from reportlab.graphics.shapes import Drawing
from reportlab.lib.colors import HexColor
from reportlab.lib.pagesizes import A4
from reportlab.lib.units import mm
from reportlab.pdfgen import canvas

ROOT = Path(__file__).resolve().parent.parent
SECRETS = ROOT / "secrets"

INK = HexColor("#4e2d22")
SOFT = HexColor("#8a5a43")
ROSE = HexColor("#d9434f")
ROSE_LIGHT = HexColor("#ff9aa2")
CUT = HexColor("#b9a99f")

COLS, ROWS = 3, 6
MARGIN_X, MARGIN_Y = 8 * mm, 10 * mm
PAGE_W, PAGE_H = A4
CELL_W = (PAGE_W - 2 * MARGIN_X) / COLS
CELL_H = (PAGE_H - 2 * MARGIN_Y) / ROWS
QR_SIZE = 33 * mm

HEART = [
    ".OO...OO.",
    "OLRO.ORRO",
    "OLRRORRRO",
    "ORRRRRRRO",
    ".ORRRRRO.",
    "..ORRRO..",
    "...ORO...",
    "....O....",
]
HEART_COLORS = {"O": INK, "R": ROSE, "L": ROSE_LIGHT}


def pixel_heart(c: canvas.Canvas, x: float, y: float, px: float) -> None:
    for row, line in enumerate(HEART):
        for col, ch in enumerate(line):
            color = HEART_COLORS.get(ch)
            if color:
                c.setFillColor(color)
                c.rect(x + col * px, y + (len(HEART) - 1 - row) * px, px, px, stroke=0, fill=1)


def qr(c: canvas.Canvas, text: str, x: float, y: float, size: float) -> None:
    widget = QrCodeWidget(text, barLevel="M", barBorder=2)
    x0, y0, x1, y1 = widget.getBounds()
    w, h = x1 - x0, y1 - y0
    d = Drawing(size, size, transform=[size / w, 0, 0, size / h, 0, 0])
    widget.barFillColor = INK
    d.add(widget)
    renderPDF.draw(d, c, x, y)


def cut_lines(c: canvas.Canvas) -> None:
    c.setStrokeColor(CUT)
    c.setLineWidth(0.4)
    c.setDash(2, 2)
    for i in range(COLS + 1):
        x = MARGIN_X + i * CELL_W
        c.line(x, MARGIN_Y - 4 * mm, x, PAGE_H - MARGIN_Y + 4 * mm)
    for j in range(ROWS + 1):
        y = MARGIN_Y + j * CELL_H
        c.line(MARGIN_X - 4 * mm, y, PAGE_W - MARGIN_X + 4 * mm, y)
    c.setDash()


def label(c: canvas.Canvas, x: float, y: float, item: dict) -> None:
    pad = 4 * mm
    qr(c, item["url"], x + pad - 2 * mm, y + (CELL_H - QR_SIZE) / 2, QR_SIZE)

    tx = x + pad + QR_SIZE + 1 * mm
    right = x + CELL_W - pad
    cx = (tx + right) / 2

    c.setFillColor(SOFT)
    c.setFont("Helvetica", 7.5)
    c.drawCentredString(cx, y + CELL_H - 9 * mm, "envelope")

    c.setFillColor(INK)
    c.setFont("Helvetica-Bold", 30 if item["id"] < 10 else 26)
    c.drawCentredString(cx, y + CELL_H - 21 * mm, str(item["id"]))

    c.setFillColor(SOFT)
    c.setFont("Helvetica", 7.5)
    c.drawCentredString(cx, y + 15 * mm, item["hint"])
    c.setFillColor(INK)
    c.setFont("Helvetica-Bold", 9)
    c.drawCentredString(cx, y + 11 * mm, item["when"])

    pixel_heart(c, cx - 4.5 * 0.75 * mm, y + 4 * mm, 0.75 * mm)


def main() -> None:
    cfg_path = SECRETS / "labels-config.json"
    if not cfg_path.exists():
        sys.exit("Rode `npm run keys` antes: falta secrets/labels-config.json")
    items = json.loads(cfg_path.read_text(encoding="utf-8"))["labels"]

    out = SECRETS / "etiquetas.pdf"
    c = canvas.Canvas(str(out), pagesize=A4)
    c.setTitle("Correio de Nós Dois - etiquetas")
    per_page = COLS * ROWS
    for start in range(0, len(items), per_page):
        cut_lines(c)
        for i, item in enumerate(items[start : start + per_page]):
            col, row = i % COLS, i // COLS
            x = MARGIN_X + col * CELL_W
            y = PAGE_H - MARGIN_Y - (row + 1) * CELL_H
            label(c, x, y, item)
        c.setFillColor(SOFT)
        c.setFont("Helvetica", 7)
        c.drawCentredString(PAGE_W / 2, 4 * mm, "Corte nas linhas tracejadas e cole cada etiqueta no envelope com o mesmo número.")
        c.showPage()
    c.save()
    print(f"{len(items)} etiquetas em {out}")


if __name__ == "__main__":
    main()
