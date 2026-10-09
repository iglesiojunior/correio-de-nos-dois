"""
Gera os selos em pixel art (A4, 3 x 3 por folha) com o QR de cada envelope.

    python scripts/make-stamps.py

Lê secrets/labels-config.json (escrito por `npm run keys`) e grava secrets/selos.pdf.
O PDF contém as chaves: trate como segredo.
Para a gráfica: vinil FOSCO, impressão em 100%, corte reto nas marcas de canto.
"""
import json
import sys
from pathlib import Path

from reportlab.graphics import renderPDF
from reportlab.graphics.barcode.qr import QrCodeWidget
from reportlab.graphics.shapes import Drawing
from reportlab.lib.colors import HexColor, white
from reportlab.lib.pagesizes import A4
from reportlab.lib.units import mm
from reportlab.pdfgen import canvas

ROOT = Path(__file__).resolve().parent.parent
SECRETS = ROOT / "secrets"

INK = HexColor("#4e2d22")
PAPER = HexColor("#fff4e0")

# ------------------------------------------------------------------ fonte pixel 5x7
FONT = {
    "A": ".###.#...##...#######...##...##...#", "B": "####.#...##...#####.#...##...#####.",
    "C": ".###.#...##....#....#....#...#.###.", "D": "####.#...##...##...##...##...#####.",
    "E": "######....#....####.#....#....#####", "F": "######....#....####.#....#....#....",
    "G": ".###.#...##....#.####...##...#.####", "H": "#...##...##...#######...##...##...#",
    "I": ".###...#....#....#....#....#...###.", "J": "..###...#....#....#.#..#.#..#..##..",
    "K": "#...##..#.#.#..##...#.#..#..#.#...#", "L": "#....#....#....#....#....#....#####",
    "M": "#...###.###.#.##...##...##...##...#", "N": "#...###..##.#.##..###...##...##...#",
    "O": ".###.#...##...##...##...##...#.###.", "P": "####.#...##...#####.#....#....#....",
    "Q": ".###.#...##...##...##.#.##..#..##.#", "R": "####.#...##...#####.#.#..#..#.#...#",
    "S": ".#####....#.....###.....#....#####.",
    "T": "#####..#....#....#....#....#....#..", "U": "#...##...##...##...##...##...#.###.",
    "V": "#...##...##...##...##...#.#.#...#..", "W": "#...##...##...##.#.##.#.##.#..#.#..",
    "X": "#...##...#.#.#...#...#.#.#...##...#", "Y": "#...##...#.#.#...#....#....#....#..",
    "Z": "#####....#...#...#...#...#....#####",
    "0": ".###.#...##..###.#.###..##...#.###.", "1": "..#...##....#....#....#....#...###.",
    "2": ".###.#...#....#...#...#...#...#####", "3": "#####...#...#.....#.....##...#.###.",
    "4": "...#...##..#.#.#..#.#####...#....#.", "5": "######....####.....#....##...#.###.",
    "6": "..##..#...#....####.#...##...#.###.", "7": "#####....#...#...#...#....#....#...",
    "8": ".###.#...##...#.###.#...##...#.###.", "9": ".###.#...##...#.####....#...#..##..",
    "!": "..#....#....#....#....#.........#..", "?": ".###.#...#....#...#...#.........#..",
    ".": "..............................##...", ",": "......................##....#...#..",
    "-": "...............###...............".ljust(35, "."), " ": "." * 35, "/": "....#....#...#...#...#...#....#....",
    "º": ".###.#...#.###......#####..........", ":": "......##...##.........##...##......",
    "♥": ".#.#.##########.###...#............",
}
ACCENTS = {"Á": ("A", "´"), "É": ("E", "´"), "Í": ("I", "´"), "Ó": ("O", "´"), "Ú": ("U", "´"),
           "Ã": ("A", "~"), "Õ": ("O", "~"), "Ê": ("E", "^"), "Ô": ("O", "^"), "Â": ("A", "^"), "Ç": ("C", "¸")}
MARKS = {"´": [(3, -2), (2, -1)], "~": [(1, -2), (2, -1), (3, -2), (4, -1)], "^": [(2, -2), (1, -1), (3, -1)], "¸": [(2, 7), (1, 8)]}


def text_width(text: str, px: float) -> float:
    return len(text) * 6 * px - px


def pixel_text(c: canvas.Canvas, text: str, x: float, y_top: float, px: float, color) -> None:
    """Desenha texto em pixel; (x, y_top) é o canto superior esquerdo."""
    c.setFillColor(color)
    for i, ch in enumerate(text.upper()):
        base, mark = ACCENTS.get(ch, (ch, None))
        glyph = FONT.get(base, FONT["?"])
        ox = x + i * 6 * px
        for k, bit in enumerate(glyph[:35]):
            if bit == "#":
                gx, gy = k % 5, k // 5
                c.rect(ox + gx * px, y_top - (gy + 1) * px, px, px, stroke=0, fill=1)
        if mark:
            for gx, gy in MARKS[mark]:
                c.rect(ox + gx * px, y_top - (gy + 1) * px, px, px, stroke=0, fill=1)


def centered_text(c, text, cx, y_top, px, color):
    pixel_text(c, text, cx - text_width(text, px) / 2, y_top, px, color)


# ------------------------------------------------------------------ desenhos (originais)
PAL = {"O": "#4e2d22", "R": "#d9434f", "L": "#ff9aa2", "W": "#fff4e0", "C": "#fbe6c8", "Y": "#f2bf4b",
       "D": "#c98f2a", "T": "#a0643a", "t": "#d98a5a", "G": "#5e9a4c", "g": "#8cc06a", "B": "#5aa7c9",
       "b": "#9fd3e0", "P": "#b48ad8", "p": "#e0c8f2", "K": "#2b2b2b", "S": "#f4d3b0", "N": "#f7a8b8"}

ART = {
    "coracao": [
        "..OOO...OOO..", ".ORLLO.ORRRO.", "ORLLRROORRRRO", "ORLRRRRRRRRRO", "ORRRRRRRRRRRO",
        ".ORRRRRRRRRO.", "..ORRRRRRRO..", "...ORRRRRO...", "....ORRRO....", ".....ORO.....", "......O......"],
    "envelope": [
        "OOOOOOOOOOOOO", "OWOCCCCCCCOWO", "OWWOCCCCCOWWO", "OWWWOCCCOWWWO", "OWWWWOROWWWWO",
        "OWWWWORROWWWO", "OWWWWWOOWWWWO", "OWWWWWWWWWWWO", "OOOOOOOOOOOOO"],
    "cafe": [
        "...O..O..O...", "..O..O..O....", "...O..O..O...", ".............", "OOOOOOOOOOO..",
        "OWWWWWWWWWOOO", "OTTTTTTTTTO.O", "OTTTTTTTTTO.O", "OWWWWWWWWWOOO", ".OWWWWWWWO...",
        "..OOOOOOO....", "OOOOOOOOOOOOO"],
    "sol": [
        "......Y......", "..Y...Y...Y..", "...Y.....Y...", ".....OOO.....", "....OYYYO....",
        "YY.OYYYYYO.YY", "....OYOYO....", "....OYYYO....", ".....OOO.....", "...Y.....Y...",
        "..Y...Y...Y..", "......Y......"],
    "lua": [
        "....OOOO.....", "..OOYYO...Y..", ".OYYYO......Y", ".OYYO........", "OYYYO....Y...",
        "OYYYO........", "OYYYYO.......", ".OYYYYOO..OO.", ".OYYYYYYOOYO.", "..OOYYYYYYO..",
        "....OOOOOO..."],
    "gato": [
        ".O.........O.", "OSO.......OSO", "OSSOOOOOOOSSO", "OSSSSSSSSSSSO", "OSSKSSSSSKSSO",
        "OSSKSSSSSKSSO", "OSSSSSNSSSSSO", "OSLSSKSKSSLSO", ".OSSSSKSSSSO.", "..OOOOOOOOO.."],
    "carnauba": [
        "..GG..O..GG..", ".GGGGOGOGGGG.", "GGG.GGGGG.GGG", "G..GGGGGGG..G", "..G..OTO..G..",
        "......OTO....", "......OTO....", ".....OTO.....", ".....OTO.....", ".....OTO.....",
        "....OOTOO....", "..ggggggggg.."],
    "aviao": [
        "......O......", ".....OWO.....", ".....OWO.....", "..OOOOWOOOO..", "OOWWWWWWWWWOO",
        "..OOOWBWOOO..", ".....OWO.....", ".....OWO.....", "....OOWOO....", "...OWWWWWO...",
        "....OOOOO...."],
    "sorvete": [
        "....OOOOO....", "...ONLNNNO...", "..ONNNNLNNO..", "..ONNWNNNNO..", "..OOOOOOOOO..",
        "...OtTtTtO...", "...OTtTtTO...", "....OtTtO....", "....OTtTO....", ".....OtO.....",
        "......O......"],
    "flor": [
        "....OO.OO....", "...OPPOPPO...", "..OPPPOPPPO..", "...OPOYOPO...", "..OPPOYOPPO..",
        "...OPPOPPO...", "....OOGOO....", "..OO..G..OO..", ".OGGO.G.OGGO.", "..OGGOGOGGO..",
        "....OOGOO....", "......G......"],
    "pombo": [
        "....OOO......", "...OWWWO.....", "..OWKWWWOY...", "..OWWWWWOYY..", "...OWWWWO....",
        "..OWWWWWWOOO.", ".OWWbbbWWWWO.", "OWWWbbWWWWO..", ".OOWWWWWWO...", "...OOOOOO....",
        "....Y..Y....."],
    "casa": [
        "......O......", ".....ORO.....", "....ORRRO....", "...ORRRRRO...", "..ORRRRRRRO..",
        ".OOOOOOOOOOO.", "..OWWWWWWWO..", "..OWOOWOOWO..", "..OWOYWOTWO..", "..OWOOWOTWO..",
        "..OWWWWOTWO..", "..OOOOOOOOO.."],
    "cacto": [
        ".....OOO.....", "....OGGGO....", "..O.OGgGO....", ".OGOOGGGO.O..", ".OGGOGgGOOGO.",
        "..OGGGGGGGGO.", "...OOGgGOOO..", ".....OGGO....", "...OOOOOOO...", "...OTTTTTO...",
        "....OTTTO....", "....OOOOO...."],
}
ART_ORDER = ["envelope", "aviao", "sol", "cafe", "gato", "carnauba", "lua", "sorvete", "flor",
             "pombo", "coracao", "casa", "cacto"]

# fundo do selo e da moldura interna, em pares suaves
BACKS = [("#f6b8c4", "#fbd9e0"), ("#b7dfa0", "#d8efcb"), ("#a9d6ea", "#d2ebf5"), ("#f8dd8a", "#fcedc0"),
         ("#cdb6e6", "#e6daf3"), ("#f7c49e", "#fbe0cb")]

CAPTIONS = [
    "TESTE 1, 2, 3", "BOA VIAGEM!", "BOM DIA, AMOR", "TOMA UM CAFÉ", "MIAU TE AMO", "OI DE TERESINA",
    "BOA NOITE", "UM SORVETE?", "FLOR PRA VOCÊ", "PIU PIU ♥", "SAUDADE!", "LAR É VOCÊ", "ABRAÇO DE CACTO",
    "METADE JÁ!", "VOLTA LOGO", "BOM DIA DE NOVO", "PENSEI EM VOCÊ", "MIAU MIAU", "CALOR DAQUI",
    "SONHA COMIGO", "SORVETE DEPOIS", "FALTA POUCO", "TE ESPERO",
    "ÚLTIMOS DIAS", "QUASE LÁ!", "VEM PRA CASA",
]

# ------------------------------------------------------------------ geometria
STAMP_W, STAMP_H = 52 * mm, 74 * mm
COLS, ROWS = 3, 3
GAP = 8 * mm
PAGE_W, PAGE_H = A4
GRID_W = COLS * STAMP_W + (COLS - 1) * GAP
GRID_H = ROWS * STAMP_H + (ROWS - 1) * GAP
X0 = (PAGE_W - GRID_W) / 2
Y0 = (PAGE_H - GRID_H) / 2 + 4 * mm
QR_SIZE = 27 * mm


def draw_art(c, name, cx, cy, max_w, max_h):
    rows = ART[name]
    w = max(len(r) for r in rows)
    h = len(rows)
    px = min(max_w / w, max_h / h)
    x0, y0 = cx - w * px / 2, cy + h * px / 2
    for y, row in enumerate(rows):
        for x, ch in enumerate(row):
            if ch in PAL:
                c.setFillColor(HexColor(PAL[ch]))
                c.rect(x0 + x * px, y0 - (y + 1) * px, px * 1.01, px * 1.01, stroke=0, fill=1)


def qr(c, text, x, y, size):
    widget = QrCodeWidget(text, barLevel="M", barBorder=2)
    x0, y0, x1, y1 = widget.getBounds()
    d = Drawing(size, size, transform=[size / (x1 - x0), 0, 0, size / (y1 - y0), 0, 0])
    widget.barFillColor = INK
    d.add(widget)
    renderPDF.draw(d, c, x, y)


def perforated(c, x, y, w, h, fill):
    """Fundo do selo com borda picotada (furinhos brancos)."""
    c.setFillColor(fill)
    c.rect(x, y, w, h, stroke=0, fill=1)
    r = 1.5 * mm
    step = 4 * mm
    c.setFillColor(white)
    nx = int(w // step)
    ny = int(h // step)
    for i in range(nx + 1):
        px = x + (w - nx * step) / 2 + i * step
        c.circle(px, y, r, stroke=0, fill=1)
        c.circle(px, y + h, r, stroke=0, fill=1)
    for j in range(ny + 1):
        py = y + (h - ny * step) / 2 + j * step
        c.circle(x, py, r, stroke=0, fill=1)
        c.circle(x + w, py, r, stroke=0, fill=1)


def crop_marks(c, x, y, w, h):
    c.setStrokeColor(HexColor("#9a8a80"))
    c.setLineWidth(0.3)
    L, off = 3 * mm, 1.2 * mm
    for cx, sx in ((x, -1), (x + w, 1)):
        for cy, sy in ((y, -1), (y + h, 1)):
            c.line(cx + sx * off, cy, cx + sx * (off + L), cy)
            c.line(cx, cy + sy * off, cx, cy + sy * (off + L))


def stamp(c, x, y, item):
    i = item["id"]
    back, inner = BACKS[i % len(BACKS)]
    perforated(c, x, y, STAMP_W, STAMP_H, HexColor(back))

    m = 3.6 * mm
    ix, iy, iw, ih = x + m, y + m, STAMP_W - 2 * m, STAMP_H - 2 * m
    c.setFillColor(HexColor(inner))
    c.setStrokeColor(INK)
    c.setLineWidth(1.2)
    c.rect(ix, iy, iw, ih, stroke=1, fill=1)

    px = 0.42 * mm
    top = iy + ih - 2 * mm
    pixel_text(c, "25", ix + 2 * mm, top, px * 1.3, INK)
    pixel_text(c, "SAUDADES", ix + 2 * mm, top - 4.4 * mm, px * 0.8, INK)

    num = f"Nº {i}" if i else "TESTE"
    pixel_text(c, num, ix + iw - 2 * mm - text_width(num, px * 1.3), top, px * 1.3, HexColor("#d9434f"))
    when = "ABRA JÁ" if i == 0 else item["when"]
    pixel_text(c, when, ix + iw - 2 * mm - text_width(when, px * 0.8), top - 4.4 * mm, px * 0.8, INK)

    art_top = top - 8.5 * mm
    art_h = 20 * mm
    draw_art(c, ART_ORDER[i % len(ART_ORDER)], ix + iw / 2, art_top - art_h / 2, iw - 8 * mm, art_h)

    cap = CAPTIONS[i % len(CAPTIONS)]
    cap_px = px * 0.85 if text_width(cap, px * 0.85) < iw - 3 * mm else (iw - 3 * mm) / (len(cap) * 6 - 1)
    centered_text(c, cap, ix + iw / 2, art_top - art_h - 1.5 * mm, cap_px, INK)

    # QR com margem branca, como um código de rastreio
    qx = ix + (iw - QR_SIZE) / 2
    qy = iy + 2.2 * mm
    c.setFillColor(white)
    c.setStrokeColor(INK)
    c.setLineWidth(0.8)
    c.rect(qx - 0.8 * mm, qy - 0.8 * mm, QR_SIZE + 1.6 * mm, QR_SIZE + 1.6 * mm, stroke=1, fill=1)
    qr(c, item["url"], qx, qy, QR_SIZE)

    crop_marks(c, x, y, STAMP_W, STAMP_H)


def main() -> None:
    cfg_path = SECRETS / "labels-config.json"
    if not cfg_path.exists():
        sys.exit("Rode `npm run keys` antes: falta secrets/labels-config.json")
    items = json.loads(cfg_path.read_text(encoding="utf-8"))["labels"]
    out = Path(sys.argv[1]) if len(sys.argv) > 1 else SECRETS / "selos.pdf"
    c = canvas.Canvas(str(out), pagesize=A4)
    c.setTitle("Correio de Nós Dois - selos")
    per_page = COLS * ROWS
    for start in range(0, len(items), per_page):
        for k, item in enumerate(items[start : start + per_page]):
            col, row = k % COLS, k // COLS
            x = X0 + col * (STAMP_W + GAP)
            y = Y0 + (ROWS - 1 - row) * (STAMP_H + GAP)
            stamp(c, x, y, item)
        c.setFillColor(HexColor("#8a5a43"))
        c.setFont("Helvetica", 7)
        c.drawCentredString(PAGE_W / 2, 6 * mm, "Imprimir em 100% (tamanho real). Vinil fosco. Cortar nas marcas de canto: cada selo tem 52 x 74 mm.")
        c.showPage()
    c.save()
    print(f"{len(items)} selos em {out}")


if __name__ == "__main__":
    main()
