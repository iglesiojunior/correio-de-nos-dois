"""
Gera os cartões que vão DENTRO de cada envelope: 1/4 de A4 (A6, 105 x 148 mm), 4 por folha.
Cada cartão tem o número, a data, o mesmo desenho e a mesma frase do selo e o QR grande.

    python scripts/make-cards.py

Lê secrets/labels-config.json e grava secrets/cartoes.pdf. O PDF contém as chaves: trate como segredo.
Para a gráfica: papel fosco de 180 a 240 g (couché fosco ou color plus), 100%, cortar nas linhas do meio.
"""
import importlib.util
import json
import sys
from pathlib import Path

from reportlab.lib.colors import HexColor, white
from reportlab.lib.pagesizes import A4
from reportlab.lib.units import mm
from reportlab.pdfgen import canvas

HERE = Path(__file__).resolve().parent
_spec = importlib.util.spec_from_file_location("stamps", HERE / "make-stamps.py")
kit = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(kit)

SECRETS = HERE.parent / "secrets"
INK, ROSE, SOFT = kit.INK, HexColor("#d9434f"), HexColor("#8a5a43")
PAPER = HexColor("#fff4e0")
PAGE_W, PAGE_H = A4
CARD_W, CARD_H = PAGE_W / 2, PAGE_H / 2
QR_SIZE = 58 * mm


def pixel_border(c, x, y, w, h, i):
    """Moldura de quadradinhos alternando duas cores do selo daquele envelope."""
    back, inner = kit.BACKS[i % len(kit.BACKS)]
    s = 2.4 * mm
    nx, ny = int(w // s), int(h // s)
    ox, oy = x + (w - nx * s) / 2, y + (h - ny * s) / 2
    for k in range(nx):
        for yy in (oy, oy + (ny - 1) * s):
            c.setFillColor(HexColor(back if k % 2 == 0 else inner))
            c.rect(ox + k * s, yy, s, s, stroke=0, fill=1)
    for k in range(ny):
        for xx in (ox, ox + (nx - 1) * s):
            c.setFillColor(HexColor(back if k % 2 == 0 else inner))
            c.rect(xx, oy + k * s, s, s, stroke=0, fill=1)
    c.setStrokeColor(INK)
    c.setLineWidth(1)
    c.rect(ox + s, oy + s, (nx - 2) * s, (ny - 2) * s, stroke=1, fill=0)
    return ox + s, oy + s, (nx - 2) * s, (ny - 2) * s


def card(c, x, y, item):
    i = item["id"]
    c.setFillColor(PAPER)
    c.rect(x, y, CARD_W, CARD_H, stroke=0, fill=1)
    ix, iy, iw, ih = pixel_border(c, x + 5 * mm, y + 5 * mm, CARD_W - 10 * mm, CARD_H - 10 * mm, i)
    cx = ix + iw / 2
    top = iy + ih - 5 * mm

    kit.centered_text(c, "CORREIO DE NÓS DOIS", cx, top, 0.42 * mm, SOFT)

    # número grande com o desenho do selo ao lado
    num = f"Nº {i}" if i else "TESTE"
    npx = 1.25 * mm
    nw = kit.text_width(num, npx)
    art = 13 * mm
    gap = 3 * mm
    start = cx - (art + gap + nw) / 2
    kit.draw_art(c, kit.ART_ORDER[i % len(kit.ART_ORDER)], start + art / 2, top - 6 * mm - art / 2, art, art)
    kit.pixel_text(c, num, start + art + gap, top - 8 * mm, npx, ROSE)

    when = "ABRA ASSIM QUE RECEBER" if i == 0 else f"{item['hint'].upper()}, {item['when']}, ÀS 8H"
    kit.centered_text(c, when, cx, top - 21 * mm, 0.42 * mm, INK)

    # QR grande com margem branca, centralizado no espaço que sobra
    qy = top - 31 * mm - QR_SIZE
    qx = cx - QR_SIZE / 2
    c.setFillColor(white)
    c.setStrokeColor(INK)
    c.setLineWidth(1)
    c.rect(qx - 2 * mm, qy - 2 * mm, QR_SIZE + 4 * mm, QR_SIZE + 4 * mm, stroke=1, fill=1)
    kit.qr(c, item["url"], qx, qy, QR_SIZE)
    kit.centered_text(c, "APONTE A CÂMERA AQUI", cx, qy - 5 * mm, 0.42 * mm, SOFT)

    # a frase do selo daquele envelope, fechando o cartão
    cap = kit.CAPTIONS[i % len(kit.CAPTIONS)]
    kit.centered_text(c, cap, cx, iy + 13 * mm, 0.62 * mm, ROSE)
    heart_y = iy + 6.5 * mm
    kit.pixel_text(c, "♥", cx - 1.5 * mm, heart_y, 0.6 * mm, ROSE)


def cut_guides(c):
    c.setStrokeColor(HexColor("#b9a99f"))
    c.setLineWidth(0.3)
    c.setDash(2, 2)
    c.line(PAGE_W / 2, 0, PAGE_W / 2, PAGE_H)
    c.line(0, PAGE_H / 2, PAGE_W, PAGE_H / 2)
    c.setDash()


def main() -> None:
    cfg_path = SECRETS / "labels-config.json"
    if not cfg_path.exists():
        sys.exit("Rode `npm run keys` antes: falta secrets/labels-config.json")
    items = json.loads(cfg_path.read_text(encoding="utf-8"))["labels"]
    out = Path(sys.argv[1]) if len(sys.argv) > 1 else SECRETS / "cartoes.pdf"
    c = canvas.Canvas(str(out), pagesize=A4)
    c.setTitle("Correio de Nós Dois - cartões")
    for start in range(0, len(items), 4):
        for k, item in enumerate(items[start : start + 4]):
            col, row = k % 2, k // 2
            card(c, col * CARD_W, PAGE_H - (row + 1) * CARD_H, item)
        cut_guides(c)
        c.showPage()
    c.save()
    print(f"{len(items)} cartões em {out}")


if __name__ == "__main__":
    main()
