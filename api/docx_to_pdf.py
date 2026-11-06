from __future__ import annotations

import io
import os
import tempfile
import hmac
from http.server import BaseHTTPRequestHandler

from docx import Document
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.oxml.ns import qn
from docx.table import Table
from docx.text.paragraph import Paragraph as DocxParagraph
from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER, TA_JUSTIFY, TA_LEFT, TA_RIGHT
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import inch
from reportlab.platypus import Image, PageBreak, Paragraph, SimpleDocTemplate, Spacer, Table as RLTable, TableStyle
from xml.sax.saxutils import escape

ALIGN = {WD_ALIGN_PARAGRAPH.LEFT: TA_LEFT, WD_ALIGN_PARAGRAPH.CENTER: TA_CENTER,
         WD_ALIGN_PARAGRAPH.RIGHT: TA_RIGHT, WD_ALIGN_PARAGRAPH.JUSTIFY: TA_JUSTIFY}
TITLE_SIZES = {"title": 24, "heading 1": 20, "heading 2": 16, "heading 3": 14,
               "heading 4": 12, "heading 5": 11, "heading 6": 10}

def iter_blocks(doc):
    for child in doc.element.body.iterchildren():
        if child.tag == qn("w:p"):
            yield DocxParagraph(child, doc)
        elif child.tag == qn("w:tbl"):
            yield Table(child, doc)

def run_markup(run, part):
    images = []
    for blip in run._r.iter(qn("a:blip")):
        rid = blip.get(qn("r:embed"))
        if rid and rid in part.related_parts:
            images.append(part.related_parts[rid].blob)
    pieces = []
    for el in run._r:
        if el.tag == qn("w:t"):
            pieces.append(escape(el.text or ""))
        elif el.tag == qn("w:tab"):
            pieces.append("&nbsp;" * 8)
        elif el.tag in (qn("w:br"), qn("w:cr")):
            if el.get(qn("w:type")) != "page":
                pieces.append("<br/>")
    text = "".join(pieces)
    if not text:
        return "", images
    f = run.font
    if f.bold: text = f"<b>{text}</b>"
    if f.italic: text = f"<i>{text}</i>"
    if f.underline: text = f"<u>{text}</u>"
    if f.strike: text = f"<strike>{text}</strike>"
    if f.superscript: text = f"<super>{text}</super>"
    if f.subscript: text = f"<sub>{text}</sub>"
    attrs = []
    try:
        if f.color is not None and f.color.rgb is not None:
            attrs.append(f'color="#{f.color.rgb}"')
    except Exception:
        pass
    if f.size: attrs.append(f'size="{f.size.pt:.1f}"')
    if attrs: text = f"<font {' '.join(attrs)}>{text}</font>"
    return text, images

def image_flowable(blob, max_width):
    try:
        img = Image(io.BytesIO(blob))
        scale = min(1.0, max_width / float(img.imageWidth))
        img.drawWidth, img.drawHeight = img.imageWidth * scale, img.imageHeight * scale
        return img
    except Exception:
        return None

def paragraph_style(par, base):
    name = (par.style.name or "").lower() if par.style is not None else ""
    size = TITLE_SIZES.get(name, base.fontSize)
    heading = name in TITLE_SIZES
    style = ParagraphStyle(f"p_{id(par)}", parent=base, fontSize=size, leading=size*1.25,
        fontName="Helvetica-Bold" if heading else base.fontName,
        spaceBefore=10 if heading else 0, spaceAfter=6 if heading else 4)
    align = par.alignment
    if align is None and par.style is not None:
        align = par.style.paragraph_format.alignment
    if align in ALIGN: style.alignment = ALIGN[align]
    pf = par.paragraph_format
    if pf.left_indent: style.leftIndent = pf.left_indent.pt
    if pf.first_line_indent: style.firstLineIndent = pf.first_line_indent.pt
    return style, name

def list_prefix(par, counters):
    ppr = par._p.pPr
    num = ppr.numPr if ppr is not None else None
    name = (par.style.name or "").lower() if par.style is not None else ""
    if num is None and "list" not in name: return ""
    numbered = "number" in name
    level = int(num.ilvl.val) if num is not None and num.ilvl is not None else 0
    if numbered:
        counters[level] = counters.get(level, 0) + 1
        return f"{counters[level]}.&nbsp;"
    return "•&nbsp;"

def convert_paragraph(par, doc, base, width, counters):
    flows = []
    if any(br.get(qn("w:type")) == "page" for br in par._p.iter(qn("w:br"))):
        flows.append(PageBreak())
    style, _ = paragraph_style(par, base)
    prefix = list_prefix(par, counters)
    if prefix:
        style.leftIndent = max(style.leftIndent, 18)
        style.firstLineIndent = -12
    else:
        counters.clear()
    markup, images = [], []
    for run in par.runs:
        text, imgs = run_markup(run, doc.part)
        markup.append(text); images.extend(imgs)
    text = "".join(markup).strip()
    if text: flows.append(Paragraph(prefix + text, style))
    elif not images and not flows: flows.append(Spacer(1, base.fontSize * .8))
    for blob in images:
        img = image_flowable(blob, width)
        if img: flows.append(img)
    return flows

def convert_table(table, doc, base, width):
    data = []
    cell_style = ParagraphStyle("cell", parent=base, fontSize=base.fontSize-1,
                                leading=(base.fontSize-1)*1.2, spaceAfter=0)
    for row in table.rows:
        line, seen = [], set()
        for cell in row.cells:
            if id(cell._tc) in seen:
                line.append(""); continue
            seen.add(id(cell._tc))
            content = []
            for p in cell.paragraphs:
                markup = "".join(run_markup(r, doc.part)[0] for r in p.runs).strip()
                if markup: content.append(Paragraph(markup, cell_style))
            line.append(content or "")
        data.append(line)
    if not data: return []
    cols = max(len(row) for row in data)
    for row in data: row.extend([""] * (cols-len(row)))
    table_obj = RLTable(data, colWidths=[width/cols]*cols, repeatRows=1)
    table_obj.setStyle(TableStyle([
        ("GRID",(0,0),(-1,-1),.5,colors.grey),("VALIGN",(0,0),(-1,-1),"TOP"),
        ("LEFTPADDING",(0,0),(-1,-1),4),("RIGHTPADDING",(0,0),(-1,-1),4),
        ("TOPPADDING",(0,0),(-1,-1),3),("BOTTOMPADDING",(0,0),(-1,-1),3)]))
    return [table_obj, Spacer(1,8)]

def docx_to_pdf_bytes(docx_bytes):
    doc = Document(io.BytesIO(docx_bytes))
    section = doc.sections[0]
    try:
        page_size = (section.page_width.pt, section.page_height.pt)
        margins = dict(leftMargin=section.left_margin.pt, rightMargin=section.right_margin.pt,
                       topMargin=section.top_margin.pt, bottomMargin=section.bottom_margin.pt)
    except Exception:
        page_size, margins = A4, dict(leftMargin=inch,rightMargin=inch,topMargin=inch,bottomMargin=inch)
    width = page_size[0] - margins["leftMargin"] - margins["rightMargin"]
    base = getSampleStyleSheet()["Normal"]
    base.fontName, base.fontSize, base.leading = "Helvetica", 11, 14
    story, counters = [], {}
    for block in iter_blocks(doc):
        if isinstance(block, Table):
            counters.clear(); story.extend(convert_table(block, doc, base, width))
        else:
            story.extend(convert_paragraph(block, doc, base, width, counters))
    if not story: story.append(Spacer(1,12))
    output = io.BytesIO()
    pdf = SimpleDocTemplate(output, pagesize=page_size,
        title=doc.core_properties.title or "Contrato Brindare",
        author=doc.core_properties.author or "", **margins)
    pdf.build(story)
    return output.getvalue()

class handler(BaseHTTPRequestHandler):
    def do_POST(self):
        expected = os.environ.get("CONVERTER_SECRET", "")
        supplied = self.headers.get("x-converter-secret", "")
        if not expected or not hmac.compare_digest(expected, supplied):
            self.send_error(401, "Não autorizado"); return
        length = int(self.headers.get("content-length", "0"))
        if length <= 0 or length > 4_300_000:
            self.send_error(413, "DOCX vazio ou maior que o limite de 4,3 MB"); return
        try:
            pdf = docx_to_pdf_bytes(self.rfile.read(length))
        except Exception as exc:
            self.send_error(422, f"Falha ao converter DOCX: {str(exc)[:300]}"); return
        self.send_response(200)
        self.send_header("Content-Type", "application/pdf")
        self.send_header("Content-Length", str(len(pdf)))
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        self.wfile.write(pdf)
