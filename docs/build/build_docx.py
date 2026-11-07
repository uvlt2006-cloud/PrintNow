"""Собирает Word-версию работы из docs/work.html. Только стандартная библиотека Python."""
import json
import pathlib
import re
import struct
import zipfile
from html.parser import HTMLParser
from xml.sax.saxutils import escape

DOCS = pathlib.Path(__file__).resolve().parents[1]
OUT = DOCS.parents[1] / "PrintNow_Проектная_работа.docx"
FIG = DOCS / "docx_figures"
WIDTH = 9355  # 165 мм в твипах
VOID = {"img", "br", "col", "meta", "link", "hr", "input"}


class Node:
    def __init__(self, tag, attrs=None, parent=None):
        self.tag, self.attrs, self.parent, self.kids = tag, dict(attrs or []), parent, []

    def cls(self):
        return self.attrs.get("class", "").split()

    def text(self):
        return "".join(k if isinstance(k, str) else k.text() for k in self.kids)

    def find(self, tag):
        for k in self.kids:
            if isinstance(k, Node):
                if k.tag == tag:
                    return k
                r = k.find(tag)
                if r:
                    return r
        return None

    def all(self, tag):
        out = []
        for k in self.kids:
            if isinstance(k, Node):
                if k.tag == tag:
                    out.append(k)
                out += k.all(tag)
        return out


class P(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.root = Node("root")
        self.cur = self.root

    def handle_starttag(self, tag, attrs):
        n = Node(tag, attrs, self.cur)
        self.cur.kids.append(n)
        if tag not in VOID:
            self.cur = n

    def handle_endtag(self, tag):
        c = self.cur
        while c is not self.root and c.tag != tag:
            c = c.parent
        if c is not self.root:
            self.cur = c.parent

    def handle_data(self, d):
        self.cur.kids.append(d)


raw = (DOCS / "work.html").read_text(encoding="utf8")
raw = re.sub(r"<svg.*?</svg>", "", raw, flags=re.S)
raw = re.sub(r"<style.*?</style>", "", raw, flags=re.S)
raw = re.sub(r"<head>.*?</head>", "", raw, flags=re.S)
parser = P()
parser.feed(raw)
body = parser.root.find("body") or parser.root

rels, images, bookmark_id = [], [], [100]


def rel(target, kind="hyperlink", external=True):
    rid = f"rId{len(rels) + 10}"
    rels.append((rid, kind, target, external))
    return rid


def run(text, f):
    if not text:
        return ""
    rp = ""
    if f.get("font"):
        rp += f'<w:rFonts w:ascii="{f["font"]}" w:hAnsi="{f["font"]}" w:cs="{f["font"]}"/>'
    if f.get("b"):
        rp += "<w:b/>"
    if f.get("i"):
        rp += "<w:i/>"
    if f.get("color"):
        rp += f'<w:color w:val="{f["color"]}"/>'
    if f.get("sz"):
        rp += f'<w:sz w:val="{f["sz"]}"/><w:szCs w:val="{f["sz"]}"/>'
    if f.get("hl"):
        rp += '<w:highlight w:val="yellow"/>'
    if f.get("u"):
        rp += '<w:u w:val="single"/>'
    rp = f"<w:rPr>{rp}</w:rPr>" if rp else ""
    parts = text.split("­")
    inner = "<w:softHyphen/>".join(f'<w:t xml:space="preserve">{escape(p)}</w:t>' if p else "" for p in parts)
    return f"<w:r>{rp}{inner}</w:r>"


def inline(node, f=None):
    f = dict(f or {})
    out = ""
    for k in node.kids:
        if isinstance(k, str):
            out += run(re.sub(r"[\n\r\t]+", " ", k), f)
        elif k.tag == "br":
            out += "<w:r><w:br/></w:r>"
        elif k.tag == "b":
            out += inline(k, {**f, "b": True})
        elif k.tag == "i":
            out += inline(k, {**f, "i": True})
        elif k.tag == "u":
            out += inline(k, {**f, "u": True})
        elif k.tag == "span" and "fill" in k.cls():
            out += inline(k, {**f, "hl": True})
        elif k.tag == "a":
            href = k.attrs.get("href", "")
            if href.startswith("http"):
                out += f'<w:hyperlink r:id="{rel(href)}" w:history="1">{inline(k, {**f, "color": "8E4217", "u": True})}</w:hyperlink>'
            else:
                out += inline(k, f)
        else:
            out += inline(k, f)
    return out


def para(content, style=None, ppr=""):
    st = f'<w:pStyle w:val="{style}"/>' if style else ""
    pp = f"<w:pPr>{st}{ppr}</w:pPr>" if st or ppr else ""
    return f"<w:p>{pp}{content}</w:p>"


def heading(node, level):
    a = node.attrs.get("id")
    txt = inline(node)
    if a:
        bookmark_id[0] += 1
        i = bookmark_id[0]
        txt = f'<w:bookmarkStart w:id="{i}" w:name="_Toc_{a}"/>{txt}<w:bookmarkEnd w:id="{i}"/>'
    return para(txt, f"Heading{level}")


def table(node):
    cols = [float(re.search(r"width:([\d.]+)%", c.attrs.get("style", ""))[1]) for c in node.all("col")]
    rows = node.all("tr")
    n = max(len([k for k in r.kids if isinstance(k, Node) and k.tag in ("td", "th")]) for r in rows)
    if not cols:
        cols = [100 / n] * n
    scale = 100 / sum(cols)
    widths = [round(c * scale * WIDTH / 100) for c in cols]
    widths[-1] += WIDTH - sum(widths)
    small = "small" in node.cls()
    sz = 18 if small else 19
    grid = "".join(f'<w:gridCol w:w="{w}"/>' for w in widths)
    x = (f'<w:tbl><w:tblPr><w:tblW w:w="{WIDTH}" w:type="dxa"/><w:tblBorders>'
         + "".join(f'<w:{s} w:val="single" w:sz="4" w:space="0" w:color="8A8F8C"/>' for s in ("top", "left", "bottom", "right", "insideH", "insideV"))
         + '</w:tblBorders><w:tblLayout w:type="fixed"/><w:tblCellMar><w:top w:w="40" w:type="dxa"/><w:left w:w="70" w:type="dxa"/><w:bottom w:w="40" w:type="dxa"/><w:right w:w="70" w:type="dxa"/></w:tblCellMar></w:tblPr>'
         + f"<w:tblGrid>{grid}</w:tblGrid>")
    for r in rows:
        cells = [k for k in r.kids if isinstance(k, Node) and k.tag in ("td", "th")]
        head = any(c.tag == "th" for c in cells)
        x += "<w:tr><w:trPr><w:cantSplit/>" + ("<w:tblHeader/>" if head else "") + "</w:trPr>"
        for i, c in enumerate(cells):
            shd = '<w:shd w:val="clear" w:color="auto" w:fill="F2EEE6"/>' if head else ""
            jc = '<w:jc w:val="right"/>' if "r" in c.cls() else ""
            f = {"font": "Arial", "sz": sz}
            if head:
                f["b"] = True
            x += f'<w:tc><w:tcPr><w:tcW w:w="{widths[i]}" w:type="dxa"/>{shd}</w:tcPr>' + para(inline(c, f), "TableText", jc) + "</w:tc>"
        x += "</w:tr>"
    return x + "</w:tbl>" + para("", "AfterTable")


def png_size(p):
    b = p.read_bytes()[:24]
    return struct.unpack(">II", b[16:24])


meta = json.loads((FIG / "meta.json").read_text(encoding="utf8"))


def figure(node, idx):
    m = meta[idx]
    w, h = m["w"], m["h"]
    limit_h = 880
    if h > limit_h:
        w, h = w * limit_h / h, limit_h
    cx, cy = round(w * 9525), round(h * 9525)
    rid = rel(f'media/{m["file"]}', "image", False)
    images.append(m["file"])
    alt = escape(m["cap"], {'"': "&quot;"})
    pid = idx + 1
    d = (f'<w:r><w:drawing><wp:inline distT="0" distB="0" distL="0" distR="0"><wp:extent cx="{cx}" cy="{cy}"/>'
         f'<wp:docPr id="{pid}" name="Рисунок {pid}" descr="{alt}"/><a:graphic xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main">'
         '<a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/picture"><pic:pic xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture">'
         f'<pic:nvPicPr><pic:cNvPr id="{pid}" name="{m["file"]}" descr="{alt}"/><pic:cNvPicPr/></pic:nvPicPr><pic:blipFill><a:blip r:embed="{rid}"/><a:stretch><a:fillRect/></a:stretch></pic:blipFill>'
         f'<pic:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="{cx}" cy="{cy}"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></pic:spPr></pic:pic></a:graphicData></a:graphic></wp:inline></w:drawing></w:r>')
    return para(d, "Figure") + para(run(m["cap"], {}), "FigureCaption")


def title_page():
    c = lambda t, sz, b=False, before=0, after=0, color=None: para(run(t, {"font": "Arial", "sz": sz, "b": b, "color": color}), None, f'<w:spacing w:before="{before}" w:after="{after}" w:line="276" w:lineRule="auto"/><w:jc w:val="center"/>')
    l = lambda t, after=40, before=0: para(run(t, {"font": "Arial", "sz": 23}), None, f'<w:spacing w:before="{before}" w:after="{after}"/><w:jc w:val="left"/>')
    return (c("УНИВЕРСИТЕТ ПУЧОН В ГОРОДЕ ТАШКЕНТЕ", 24) + c("Кафедра e-Business", 24) + c("ПРОГРАММНАЯ ИНЖЕНЕРИЯ", 24, after=2600)
            + c("ПРОЕКТНАЯ РАБОТА", 26, after=120) + c("PrintNow", 80, True, after=120) + c("Заказ печати, копирования и переплёта:", 26) + c("оплатил онлайн, забрал без очереди", 26, after=200)
            + c("Главы 1–3 · промежуточный контроль · этапы 1–3", 24, color="596469", after=2200)
            + l("Команда Core3:") + l("A · У Виолетта (капитан)") + l("B · Ли Светлана") + l("C · Шарипова Лиана", 240)
            + l("3 курс · 5 семестр · направление e-Business") + l("Преподаватель: Ботиров С. Р.", 900) + c("Ташкент — 2026", 23))


toc_entries = []
for sec in body.all("section"):
    if "toc" in sec.cls():
        for row in sec.kids:
            if isinstance(row, Node) and "row" in row.cls():
                a = row.find("a")
                spans = row.all("span")
                toc_entries.append((1 if "l1" in row.cls() else 2, a.attrs["href"][1:], a.text(), spans[-1].text()))


def toc():
    out = para(run("Содержание", {}), "TOCHeading")
    for i, (lvl, a, label, page) in enumerate(toc_entries):
        begin = ""
        if i == 0:
            begin = ('<w:r><w:fldChar w:fldCharType="begin"/></w:r><w:r><w:instrText xml:space="preserve"> TOC \\o "1-2" \\h \\z \\u </w:instrText></w:r><w:r><w:fldChar w:fldCharType="separate"/></w:r>')
        link = f'<w:hyperlink w:anchor="_Toc_{a}" w:history="1">{run(label, {})}<w:r><w:tab/></w:r>{run(page, {})}</w:hyperlink>'
        end = '<w:r><w:fldChar w:fldCharType="end"/></w:r>' if i == len(toc_entries) - 1 else ""
        out += para(begin + link + end, f"TOC{lvl}")
    return out


blocks = []
fig_i = 0
started = False
for k in body.kids:
    if not isinstance(k, Node) or k.tag == "section":
        continue
    t = k.tag
    if t in ("h1", "h2", "h3"):
        blocks.append(heading(k, int(t[1])))
    elif t == "p" and "cap" in k.cls():
        blocks.append(para(inline(k), "TableCaption"))
    elif t == "p":
        blocks.append(para(inline(k)))
    elif t == "table":
        blocks.append(table(k))
    elif t == "figure":
        blocks.append(figure(k, fig_i))
        fig_i += 1
    elif t == "pre":
        lines = k.text().strip("\n").split("\n")
        blocks.append("".join(para(run(l, {}) if l else "", "Code") for l in lines))
    elif t == "ol":
        for li in k.all("li"):
            blocks.append(para(inline(li), "SourceItem", '<w:numPr><w:ilvl w:val="0"/><w:numId w:val="1"/></w:numPr>'))
assert fig_i == len(meta), (fig_i, len(meta))

NS = ('xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" '
      'xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing"')
sect = ('<w:sectPr><w:footerReference w:type="default" r:id="rId3"/><w:footerReference w:type="first" r:id="rId4"/>'
        '<w:pgSz w:w="11906" w:h="16838"/><w:pgMar w:top="1247" w:right="850" w:bottom="1134" w:left="1701" w:header="567" w:footer="510" w:gutter="0"/><w:titlePg/></w:sectPr>')
document = f'<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:document {NS}><w:body>{title_page()}{toc()}{"".join(blocks)}{sect}</w:body></w:document>'


def pstyle(sid, name, ppr="", rpr="", based="Normal", nxt=None, q=False):
    return (f'<w:style w:type="paragraph" w:styleId="{sid}"><w:name w:val="{name}"/>' + (f'<w:basedOn w:val="{based}"/>' if based else "") + (f'<w:next w:val="{nxt}"/>' if nxt else "") + ("<w:qFormat/>" if q else "")
            + (f"<w:pPr>{ppr}</w:pPr>" if ppr else "") + (f"<w:rPr>{rpr}</w:rPr>" if rpr else "") + "</w:style>")


AR = '<w:rFonts w:ascii="Arial" w:hAnsi="Arial" w:cs="Arial"/>'
styles = ('<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:docDefaults><w:rPrDefault><w:rPr>'
          '<w:rFonts w:ascii="Times New Roman" w:hAnsi="Times New Roman" w:eastAsia="Times New Roman" w:cs="Times New Roman"/><w:color w:val="1F2A30"/><w:sz w:val="26"/><w:szCs w:val="26"/><w:lang w:val="ru-RU" w:eastAsia="ru-RU" w:bidi="ar-SA"/></w:rPr></w:rPrDefault></w:docDefaults>'
          '<w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/><w:qFormat/><w:pPr><w:widowControl/><w:spacing w:after="140" w:line="317" w:lineRule="auto"/><w:jc w:val="both"/></w:pPr></w:style>'
          + pstyle("Heading1", "heading 1", '<w:keepNext/><w:pageBreakBefore/><w:spacing w:before="0" w:after="240" w:line="240" w:lineRule="auto"/><w:jc w:val="left"/><w:outlineLvl w:val="0"/>', AR + '<w:b/><w:sz w:val="36"/><w:szCs w:val="36"/>', nxt="Normal", q=True)
          + pstyle("Heading2", "heading 2", '<w:keepNext/><w:spacing w:before="320" w:after="160" w:line="240" w:lineRule="auto"/><w:jc w:val="left"/><w:outlineLvl w:val="1"/>', AR + '<w:b/><w:sz w:val="28"/><w:szCs w:val="28"/>', nxt="Normal", q=True)
          + pstyle("Heading3", "heading 3", '<w:keepNext/><w:spacing w:before="240" w:after="120" w:line="240" w:lineRule="auto"/><w:jc w:val="left"/><w:outlineLvl w:val="2"/>', AR + '<w:b/><w:sz w:val="24"/><w:szCs w:val="24"/>', nxt="Normal", q=True)
          + pstyle("TOCHeading", "Заголовок содержания", '<w:keepNext/><w:pageBreakBefore/><w:spacing w:after="240"/><w:jc w:val="left"/>', AR + '<w:b/><w:sz w:val="36"/>')
          + pstyle("TOC1", "toc 1", f'<w:tabs><w:tab w:val="right" w:leader="dot" w:pos="{WIDTH}"/></w:tabs><w:spacing w:before="100" w:after="20" w:line="240" w:lineRule="auto"/><w:jc w:val="left"/>', AR + '<w:b/><w:sz w:val="22"/>')
          + pstyle("TOC2", "toc 2", f'<w:tabs><w:tab w:val="right" w:leader="dot" w:pos="{WIDTH}"/></w:tabs><w:spacing w:after="20" w:line="240" w:lineRule="auto"/><w:ind w:left="240"/><w:jc w:val="left"/>', AR + '<w:sz w:val="21"/>')
          + pstyle("TableCaption", "Подпись таблицы", '<w:keepNext/><w:spacing w:before="200" w:after="80" w:line="240" w:lineRule="auto"/><w:jc w:val="left"/>', AR + '<w:b/><w:sz w:val="20"/><w:szCs w:val="20"/>')
          + pstyle("TableText", "Текст таблицы", '<w:spacing w:after="0" w:line="240" w:lineRule="auto"/><w:jc w:val="left"/>', AR + '<w:sz w:val="19"/>')
          + pstyle("AfterTable", "После таблицы", '<w:spacing w:after="120" w:line="120" w:lineRule="exact"/>', '<w:sz w:val="8"/>')
          + pstyle("Figure", "Рисунок", '<w:keepNext/><w:spacing w:before="160" w:after="80" w:line="240" w:lineRule="auto"/><w:jc w:val="center"/>')
          + pstyle("FigureCaption", "Подпись рисунка", '<w:spacing w:after="220" w:line="240" w:lineRule="auto"/><w:jc w:val="center"/>', AR + '<w:b/><w:sz w:val="20"/><w:szCs w:val="20"/>')
          + pstyle("Code", "Скрипт", '<w:shd w:val="clear" w:color="auto" w:fill="FAF9F6"/><w:spacing w:after="0" w:line="220" w:lineRule="auto"/><w:jc w:val="left"/>', '<w:rFonts w:ascii="Courier New" w:hAnsi="Courier New" w:cs="Courier New"/><w:sz w:val="15"/><w:szCs w:val="15"/>')
          + pstyle("SourceItem", "Источник", '<w:spacing w:after="80" w:line="264" w:lineRule="auto"/><w:jc w:val="left"/>', '<w:sz w:val="23"/>')
          + pstyle("Footer", "footer", f'<w:tabs><w:tab w:val="right" w:pos="{WIDTH}"/></w:tabs><w:spacing w:after="0" w:line="240" w:lineRule="auto"/><w:jc w:val="left"/>', AR + '<w:color w:val="596469"/><w:sz w:val="18"/>')
          + "</w:styles>")
W = 'xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"'
footer = (f'<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:ftr {W}><w:p><w:pPr><w:pStyle w:val="Footer"/></w:pPr><w:r><w:t>PrintNow · команда Core3</w:t></w:r><w:r><w:tab/></w:r>'
          '<w:r><w:fldChar w:fldCharType="begin"/></w:r><w:r><w:instrText xml:space="preserve"> PAGE </w:instrText></w:r><w:r><w:fldChar w:fldCharType="separate"/></w:r><w:r><w:t>2</w:t></w:r><w:r><w:fldChar w:fldCharType="end"/></w:r></w:p></w:ftr>')
footer_first = f'<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:ftr {W}><w:p><w:pPr><w:pStyle w:val="Footer"/></w:pPr></w:p></w:ftr>'
settings = (f'<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:settings {W}><w:defaultTabStop w:val="708"/><w:autoHyphenation w:val="true"/><w:updateFields w:val="true"/><w:compat><w:compatSetting w:name="compatibilityMode" w:uri="http://schemas.microsoft.com/office/word" w:val="15"/></w:compat></w:settings>')
numbering = (f'<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:numbering {W}><w:abstractNum w:abstractNumId="0"><w:multiLevelType w:val="singleLevel"/><w:lvl w:ilvl="0"><w:start w:val="1"/><w:numFmt w:val="decimal"/><w:lvlText w:val="%1."/><w:lvlJc w:val="left"/><w:pPr><w:ind w:left="400" w:hanging="400"/></w:pPr></w:lvl></w:abstractNum><w:num w:numId="1"><w:abstractNumId w:val="0"/></w:num></w:numbering>')
RT = "http://schemas.openxmlformats.org/officeDocument/2006/relationships"
doc_rels = (f'<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'
            f'<Relationship Id="rId1" Type="{RT}/styles" Target="styles.xml"/><Relationship Id="rId2" Type="{RT}/settings" Target="settings.xml"/><Relationship Id="rId3" Type="{RT}/footer" Target="footer1.xml"/><Relationship Id="rId4" Type="{RT}/footer" Target="footer2.xml"/><Relationship Id="rId5" Type="{RT}/numbering" Target="numbering.xml"/>'
            + "".join(f'<Relationship Id="{i}" Type="{RT}/{k}" Target="{escape(t, {chr(34): "&quot;"})}"' + (' TargetMode="External"' if e else "") + "/>" for i, k, t, e in rels) + "</Relationships>")
ctypes = ('<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Default Extension="png" ContentType="image/png"/>'
          '<Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/><Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/><Override PartName="/word/settings.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.settings+xml"/><Override PartName="/word/numbering.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.numbering+xml"/>'
          '<Override PartName="/word/footer1.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.footer+xml"/><Override PartName="/word/footer2.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.footer+xml"/><Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/></Types>')
root_rels = (f'<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="{RT}/officeDocument" Target="word/document.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/></Relationships>')
core = ('<?xml version="1.0" encoding="UTF-8" standalone="yes"?><cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/"><dc:title>PrintNow: проектная работа</dc:title><dc:creator>Команда Core3</dc:creator></cp:coreProperties>')
with zipfile.ZipFile(OUT, "w", zipfile.ZIP_DEFLATED) as z:
    z.writestr("[Content_Types].xml", ctypes)
    z.writestr("_rels/.rels", root_rels)
    z.writestr("docProps/core.xml", core)
    z.writestr("word/document.xml", document)
    z.writestr("word/styles.xml", styles)
    z.writestr("word/settings.xml", settings)
    z.writestr("word/numbering.xml", numbering)
    z.writestr("word/footer1.xml", footer)
    z.writestr("word/footer2.xml", footer_first)
    z.writestr("word/_rels/document.xml.rels", doc_rels)
    for f in images:
        z.write(FIG / f, f"word/media/{f}")
print("Word:", OUT, "рисунков", len(images), "ссылок", sum(1 for r in rels if r[3]), "заголовков", len(toc_entries), "блоков", len(blocks), "размер МБ", round(OUT.stat().st_size / 1048576, 1))
