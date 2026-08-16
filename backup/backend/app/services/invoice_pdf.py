"""
CyberRange Premium Invoice PDF Generator
=========================================
Certificate-inspired design language:
  - Navy (#0F172A) primary
  - Cyber Blue (#0057D9) accent
  - Gold (#F4B400) decorative
  - Clean A4 layout, thin border, geometric corners
  - Professional enterprise typography
"""

import io
from reportlab.pdfgen import canvas as rl_canvas
from reportlab.lib.pagesizes import A4
from reportlab.lib.units import mm


# ─── Brand palette ───────────────────────────────────────────────────────────
NAVY    = (0.059, 0.090, 0.165)   # #0F172A
BLUE    = (0.000, 0.341, 0.851)   # #0057D9
GOLD    = (0.957, 0.706, 0.000)   # #F4B400
WHITE   = (1.000, 1.000, 1.000)
LGRAY   = (0.969, 0.973, 0.980)   # #F7F8FA panels
SLATE   = (0.357, 0.420, 0.490)   # secondary text
GREEN   = (0.063, 0.631, 0.278)   # SUCCESS
BORDER  = (0.820, 0.839, 0.863)   # thin rule color
RED_ERR = (0.800, 0.100, 0.100)

W, H = A4   # 595.27 x 841.89 pt


# ─── helpers ─────────────────────────────────────────────────────────────────
def _safe(v, maxlen=60):
    s = str(v if v is not None else "N/A").replace("\u20b9", "Rs.")
    if len(s) > maxlen:
        s = s[:maxlen - 1] + "\u2026"
    return s


def build_premium_invoice(
    *,
    inv_number: str,
    inv_date: str,
    # customer
    cust_name: str,
    cust_email: str,
    org_name: str = "",
    # payment
    order_id: str = "N/A",
    rzp_order: str = "N/A",
    rzp_payment: str = "N/A",
    pay_method: str = "Razorpay Online",
    pay_status: str = "SUCCESS",
    # items  list of dicts {desc, qty, duration, unit_price, subtotal}
    items: list = None,
    # totals
    subtotal: float = 0.0,
    tax: float = 0.0,
    grand_total: float = 0.0,
) -> bytes:
    """Return PDF bytes for a premium CyberRange Tax Invoice."""

    if items is None:
        items = []

    buf = io.BytesIO()
    c = rl_canvas.Canvas(buf, pagesize=A4)
    c.setTitle(f"CyberRange Invoice {inv_number}")

    def rgb(triple):
        c.setFillColorRGB(*triple)

    def srgb(triple):
        c.setStrokeColorRGB(*triple)

    # ── outer border ─────────────────────────────────────────
    margin = 18
    srgb(NAVY); c.setLineWidth(1.0)
    c.rect(margin, margin, W - 2*margin, H - 2*margin, fill=0, stroke=1)

    # gold inner accent line (3 pt inset)
    inset = margin + 3
    srgb(GOLD); c.setLineWidth(0.4)
    c.rect(inset, inset, W - 2*inset, H - 2*inset, fill=0, stroke=1)

    # ── TOP-RIGHT corner decoration ───────────────────────────
    _draw_corner_tr(c, W - margin, H - margin)

    # ── BOTTOM-LEFT corner decoration ─────────────────────────
    _draw_corner_bl(c, margin, margin)

    # ── HEADER (white bg) ─────────────────────────────────────
    header_top    = H - margin
    header_bottom = H - 110
    header_h      = header_top - header_bottom

    # left: brand
    c.setFont("Helvetica-Bold", 24)
    rgb(NAVY)
    c.drawString(36, H - 58, "CYBER RANGE")

    c.setFont("Helvetica", 9)
    rgb(SLATE)
    c.drawString(36, H - 72, "Cybersecurity Virtual Lab Platform")

    # gold underline under brand
    srgb(GOLD); c.setLineWidth(1.2)
    c.line(36, H - 78, 200, H - 78)

    # right: TAX INVOICE
    c.setFont("Helvetica-Bold", 20)
    rgb(NAVY)
    c.drawRightString(W - 36, H - 50, "TAX INVOICE")

    c.setFont("Helvetica", 8)
    rgb(SLATE)
    c.drawRightString(W - 36, H - 65, "Invoice #:  " + _safe(inv_number, 40))
    c.drawRightString(W - 36, H - 77, "Date:       " + _safe(inv_date, 30))

    # full-width gold separator after header
    y_sep = H - 95
    srgb(GOLD); c.setLineWidth(0.8)
    c.line(margin + 6, y_sep, W - margin - 6, y_sep)

    # thin navy line just below gold
    srgb(NAVY); c.setLineWidth(0.3)
    c.line(margin + 6, y_sep - 2, W - margin - 6, y_sep - 2)

    # ── INFO PANELS ───────────────────────────────────────────
    panel_top = y_sep - 10
    panel_h   = 100
    panel_y   = panel_top - panel_h
    mid       = W / 2 - 5
    p_left_x  = margin + 10
    p_right_x = mid + 10

    # panel backgrounds
    rgb(LGRAY); srgb(BORDER); c.setLineWidth(0.4)
    c.rect(p_left_x - 4, panel_y - 4, mid - p_left_x + 4, panel_h, fill=1, stroke=1)
    c.rect(p_right_x - 4, panel_y - 4, W - margin - p_right_x - 6, panel_h, fill=1, stroke=1)

    # BILLED TO heading
    c.setFont("Helvetica-Bold", 7.5)
    rgb(BLUE)
    c.drawString(p_left_x, panel_top - 14, "BILLED TO")
    # gold accent under heading
    srgb(GOLD); c.setLineWidth(0.6)
    c.line(p_left_x, panel_top - 17, p_left_x + 55, panel_top - 17)

    c.setFont("Helvetica", 8.5)
    ty = panel_top - 30
    _info_row(c, p_left_x, ty,       "Name",  cust_name)
    _info_row(c, p_left_x, ty - 14,  "Email", cust_email)
    if org_name and org_name not in ("Enterprise Client", "N/A"):
        _info_row(c, p_left_x, ty - 28, "Org",   org_name)

    # PAYMENT DETAILS heading
    c.setFont("Helvetica-Bold", 7.5)
    rgb(BLUE)
    c.drawString(p_right_x, panel_top - 14, "PAYMENT DETAILS")
    srgb(GOLD); c.setLineWidth(0.6)
    c.line(p_right_x, panel_top - 17, p_right_x + 90, panel_top - 17)

    c.setFont("Helvetica", 8.5)
    ty2 = panel_top - 30
    _info_row(c, p_right_x, ty2,       "Order ID",   order_id,   maxlen=30)
    _info_row(c, p_right_x, ty2 - 14,  "RZP Order",  rzp_order,  maxlen=30)
    _info_row(c, p_right_x, ty2 - 28,  "RZP Pay",    rzp_payment,maxlen=30)
    _info_row(c, p_right_x, ty2 - 42,  "Method",     pay_method, maxlen=25)

    # Status with dot indicator
    status_y = ty2 - 56
    c.setFont("Helvetica-Bold", 8)
    rgb(SLATE)
    c.drawString(p_right_x, status_y, "Status")
    rgb(NAVY)
    c.drawString(p_right_x + 52, status_y, ":")
    status_col = GREEN if pay_status.upper() == "SUCCESS" else RED_ERR
    rgb(status_col)
    c.setFont("Helvetica-Bold", 8)
    c.drawString(p_right_x + 60, status_y, "\u25cf  " + _safe(pay_status, 12))

    # ── gold separator before table ───────────────────────────
    table_top = panel_y - 18
    srgb(GOLD); c.setLineWidth(0.7)
    c.line(margin + 6, table_top, W - margin - 6, table_top)

    # ── ITEMS TABLE ───────────────────────────────────────────
    TL = margin + 10            # table left x
    TR = W - margin - 10        # table right x
    TW = TR - TL
    col_w = [TW * 0.42, TW * 0.07, TW * 0.14, TW * 0.18, TW * 0.19]
    col_x = [TL]
    for w in col_w[:-1]:
        col_x.append(col_x[-1] + w)

    ROW_H = 17
    header_y = table_top - ROW_H

    # Table header background
    rgb(NAVY); srgb(NAVY); c.setLineWidth(0)
    c.rect(TL, header_y, TW, ROW_H, fill=1, stroke=0)

    headers = ["Item Description", "Qty", "Duration", "Unit Price", "Subtotal"]
    aligns  = ["left", "center", "center", "right", "right"]
    c.setFont("Helvetica-Bold", 7.5)
    rgb(WHITE)
    for i, (hdr, cx, cw, al) in enumerate(zip(headers, col_x, col_w, aligns)):
        _cell_text(c, hdr, cx, header_y + 5, cw, al, "Helvetica-Bold", 7.5, WHITE)

    # Item rows
    row_y = header_y
    for ri, item in enumerate(items):
        row_y -= ROW_H
        fill = LGRAY if ri % 2 == 0 else WHITE
        rgb(fill); srgb(BORDER); c.setLineWidth(0.3)
        c.rect(TL, row_y, TW, ROW_H, fill=1, stroke=1)

        vals = [
            _safe(item.get("desc", "Lab Subscription"), 50),
            _safe(item.get("qty", "1"), 5),
            _safe(item.get("duration", "12 Months"), 15),
            _safe(item.get("unit_price", "Rs. 0.00"), 15),
            _safe(item.get("subtotal", "Rs. 0.00"), 15),
        ]
        for i, (val, cx, cw, al) in enumerate(zip(vals, col_x, col_w, aligns)):
            _cell_text(c, val, cx, row_y + 5, cw, al, "Helvetica", 8, NAVY)

    # fallback if no items
    if not items:
        row_y -= ROW_H
        rgb(LGRAY); srgb(BORDER); c.setLineWidth(0.3)
        c.rect(TL, row_y, TW, ROW_H, fill=1, stroke=1)
        c.setFont("Helvetica", 8); rgb(SLATE)
        c.drawString(TL + 4, row_y + 5, "No items")

    # ── TOTALS ────────────────────────────────────────────────
    totals_y = row_y - 16
    totals_x_label = TL + TW * 0.60
    totals_x_value = TR

    srgb(BORDER); c.setLineWidth(0.4)
    c.line(totals_x_label, totals_y + 12, TR, totals_y + 12)

    c.setFont("Helvetica", 9); rgb(SLATE)
    c.drawString(totals_x_label, totals_y, "Subtotal:")
    c.setFont("Helvetica", 9); rgb(NAVY)
    c.drawRightString(totals_x_value, totals_y, f"Rs. {subtotal:,.2f}")

    totals_y -= 14
    c.setFont("Helvetica", 9); rgb(SLATE)
    c.drawString(totals_x_label, totals_y, "GST (18%):")
    c.setFont("Helvetica", 9); rgb(NAVY)
    c.drawRightString(totals_x_value, totals_y, f"Rs. {tax:,.2f}")

    # gold + navy double rule before grand total
    totals_y -= 6
    srgb(GOLD); c.setLineWidth(1.2)
    c.line(totals_x_label, totals_y, TR, totals_y)
    srgb(NAVY); c.setLineWidth(0.3)
    c.line(totals_x_label, totals_y - 2.5, TR, totals_y - 2.5)

    totals_y -= 18
    c.setFont("Helvetica-Bold", 12); rgb(NAVY)
    c.drawString(totals_x_label, totals_y, "GRAND TOTAL")
    c.setFont("Helvetica-Bold", 13); rgb(BLUE)
    c.drawRightString(totals_x_value, totals_y - 1, f"Rs. {grand_total:,.2f}")

    # ── FOOTER ───────────────────────────────────────────────
    footer_y = margin + 30

    srgb(GOLD); c.setLineWidth(0.7)
    c.line(margin + 6, footer_y + 18, W - margin - 6, footer_y + 18)
    srgb(NAVY); c.setLineWidth(0.3)
    c.line(margin + 6, footer_y + 20, W - margin - 6, footer_y + 20)

    c.setFont("Helvetica-Bold", 8); rgb(NAVY)
    c.drawString(margin + 10, footer_y + 6, "CYBER RANGE")
    c.setFont("Helvetica", 7.5); rgb(SLATE)
    c.drawString(margin + 10, footer_y - 5, "Cybersecurity Virtual Lab Platform")

    c.setFont("Helvetica", 7.5); rgb(SLATE)
    c.drawRightString(W - margin - 10, footer_y + 6, "Thank you for using CyberRange.")
    c.drawRightString(W - margin - 10, footer_y - 5, "This is a computer-generated invoice.")

    c.save()
    buf.seek(0)
    return buf.getvalue()


# ─── internal draw helpers ────────────────────────────────────────────────────

def _info_row(c, x, y, label, value, maxlen=35):
    c.setFont("Helvetica-Bold", 8); c.setFillColorRGB(*SLATE)
    c.drawString(x, y, label)
    c.setFont("Helvetica", 8); c.setFillColorRGB(*NAVY)
    c.drawString(x + 52, y, ":")
    c.drawString(x + 60, y, _safe(value, maxlen))


def _cell_text(c, text, cx, cy, cw, align, font, size, color):
    c.setFont(font, size)
    c.setFillColorRGB(*color)
    pad = 4
    if align == "right":
        c.drawRightString(cx + cw - pad, cy, text)
    elif align == "center":
        c.drawCentredString(cx + cw / 2, cy, text)
    else:
        c.drawString(cx + pad, cy, text)


def _draw_corner_tr(c, rx, ry):
    """Top-right navy+gold geometric corner decoration."""
    size = 55
    # navy triangle
    p = c.beginPath()
    p.moveTo(rx, ry)
    p.lineTo(rx - size, ry)
    p.lineTo(rx, ry - size)
    p.close()
    c.setFillColorRGB(*NAVY)
    c.setStrokeColorRGB(*NAVY)
    c.setLineWidth(0)
    c.drawPath(p, fill=1, stroke=0)

    # gold accent line inside corner
    c.setStrokeColorRGB(*GOLD)
    c.setLineWidth(1.2)
    c.line(rx - size + 8, ry, rx, ry - size + 8)

    # small white dot at apex
    c.setFillColorRGB(*WHITE)
    cx2 = rx - 10; cy2 = ry - 10
    c.circle(cx2, cy2, 2.5, fill=1, stroke=0)


def _draw_corner_bl(c, lx, ly):
    """Bottom-left navy+gold geometric corner decoration."""
    size = 55
    p = c.beginPath()
    p.moveTo(lx, ly)
    p.lineTo(lx + size, ly)
    p.lineTo(lx, ly + size)
    p.close()
    c.setFillColorRGB(*NAVY)
    c.setStrokeColorRGB(*NAVY)
    c.setLineWidth(0)
    c.drawPath(p, fill=1, stroke=0)

    c.setStrokeColorRGB(*GOLD)
    c.setLineWidth(1.2)
    c.line(lx + size - 8, ly, lx, ly + size - 8)

    c.setFillColorRGB(*WHITE)
    c.circle(lx + 10, ly + 10, 2.5, fill=1, stroke=0)
