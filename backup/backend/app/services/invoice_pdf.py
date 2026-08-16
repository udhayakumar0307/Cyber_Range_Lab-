"""
CyberRange Premium Invoice PDF Generator
=========================================
Certificate-inspired design language:
  - Navy (#0F172A) primary
  - Cyber Blue (#0057D9) accent
  - Gold (#F4B400) decorative accents & separators
  - Clean A4 layout, thin double border (navy + gold)
  - No corner triangles — clean and minimal
  - Hour-based billing columns: Lab Name | Hour Price | Hours Purchased | Total Price
"""

import io
from reportlab.pdfgen import canvas as rl_canvas
from reportlab.lib.pagesizes import A4


# ─── Brand palette ───────────────────────────────────────────────────────────
NAVY    = (0.059, 0.090, 0.165)   # #0F172A
BLUE    = (0.000, 0.341, 0.851)   # #0057D9
GOLD    = (0.957, 0.706, 0.000)   # #F4B400
WHITE   = (1.000, 1.000, 1.000)
LGRAY   = (0.969, 0.973, 0.980)   # #F7F8FA
SLATE   = (0.357, 0.420, 0.490)   # secondary text
GREEN   = (0.063, 0.631, 0.278)   # SUCCESS
BORDER  = (0.820, 0.839, 0.863)   # thin rule
RED_ERR = (0.800, 0.100, 0.100)

W, H = A4   # 595.27 x 841.89 pt


# ─── helpers ─────────────────────────────────────────────────────────────────
def _safe(v, maxlen=60):
    s = str(v if v is not None else "N/A").replace("\u20b9", "Rs.")
    if len(s) > maxlen:
        s = s[:maxlen - 1] + "\u2026"
    return s


def _info_row(c, x, y, label, value, maxlen=35):
    c.setFont("Helvetica-Bold", 8)
    c.setFillColorRGB(*SLATE)
    c.drawString(x, y, label)
    c.setFont("Helvetica", 8)
    c.setFillColorRGB(*NAVY)
    c.drawString(x + 58, y, ":")
    c.drawString(x + 66, y, _safe(value, maxlen))


def _cell(c, text, cx, cy, cw, align, font="Helvetica", size=8, color=NAVY):
    c.setFont(font, size)
    c.setFillColorRGB(*color)
    pad = 5
    if align == "right":
        c.drawRightString(cx + cw - pad, cy, text)
    elif align == "center":
        c.drawCentredString(cx + cw / 2, cy, text)
    else:
        c.drawString(cx + pad, cy, text)


# ─── Main builder ─────────────────────────────────────────────────────────────
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
    # items — list of dicts:
    #   { desc, hour_price, hours, total }
    items: list = None,
    # totals
    subtotal: float = 0.0,
    tax: float = 0.0,
    grand_total: float = 0.0,
) -> bytes:
    """Return PDF bytes for a premium CyberRange Tax Invoice (hour-based billing)."""

    if items is None:
        items = []

    buf = io.BytesIO()
    c = rl_canvas.Canvas(buf, pagesize=A4)
    c.setTitle(f"CyberRange Invoice {inv_number}")

    def rgb(t):  c.setFillColorRGB(*t)
    def srgb(t): c.setStrokeColorRGB(*t)

    margin = 20

    # ── outer navy border ─────────────────────────────────────
    srgb(NAVY); c.setLineWidth(1.2)
    c.rect(margin, margin, W - 2*margin, H - 2*margin, fill=0, stroke=1)

    # gold inner accent border (4 pt inset)
    inset = margin + 4
    srgb(GOLD); c.setLineWidth(0.45)
    c.rect(inset, inset, W - 2*inset, H - 2*inset, fill=0, stroke=1)

    # ── HEADER ────────────────────────────────────────────────
    # Left — brand
    c.setFont("Helvetica-Bold", 26)
    rgb(NAVY)
    c.drawString(36, H - 60, "CYBER RANGE")

    c.setFont("Helvetica", 9)
    rgb(SLATE)
    c.drawString(36, H - 74, "Cybersecurity Virtual Lab Platform")

    # gold underline under brand
    srgb(GOLD); c.setLineWidth(1.4)
    c.line(36, H - 80, 210, H - 80)

    # Right — TAX INVOICE + meta
    c.setFont("Helvetica-Bold", 22)
    rgb(NAVY)
    c.drawRightString(W - 36, H - 52, "TAX INVOICE")

    c.setFont("Helvetica", 8.5)
    rgb(SLATE)
    c.drawRightString(W - 36, H - 67, "Invoice #:  " + _safe(inv_number, 40))
    c.drawRightString(W - 36, H - 80, "Date:          " + _safe(inv_date, 30))

    # ── double separator after header ─────────────────────────
    sep_y = H - 96
    srgb(GOLD); c.setLineWidth(1.0)
    c.line(margin + 8, sep_y, W - margin - 8, sep_y)
    srgb(NAVY); c.setLineWidth(0.3)
    c.line(margin + 8, sep_y - 2.5, W - margin - 8, sep_y - 2.5)

    # ── INFO PANELS ───────────────────────────────────────────
    panel_top = sep_y - 12
    panel_h   = 104
    panel_y   = panel_top - panel_h
    mid       = W / 2 - 4
    p_lx      = margin + 12
    p_rx      = mid + 12

    # panel boxes
    rgb(LGRAY); srgb(BORDER); c.setLineWidth(0.4)
    c.rect(p_lx - 5, panel_y - 4, mid - p_lx + 5, panel_h, fill=1, stroke=1)
    c.rect(p_rx - 5, panel_y - 4, W - margin - p_rx - 8, panel_h, fill=1, stroke=1)

    # BILLED TO
    c.setFont("Helvetica-Bold", 7.5); rgb(BLUE)
    c.drawString(p_lx, panel_top - 14, "BILLED TO")
    srgb(GOLD); c.setLineWidth(0.7)
    c.line(p_lx, panel_top - 17, p_lx + 58, panel_top - 17)

    ty = panel_top - 32
    _info_row(c, p_lx, ty,      "Name",  cust_name)
    _info_row(c, p_lx, ty - 15, "Email", cust_email)
    if org_name and org_name not in ("Enterprise Client", "N/A", ""):
        _info_row(c, p_lx, ty - 30, "Org", org_name)

    # PAYMENT DETAILS
    c.setFont("Helvetica-Bold", 7.5); rgb(BLUE)
    c.drawString(p_rx, panel_top - 14, "PAYMENT DETAILS")
    srgb(GOLD); c.setLineWidth(0.7)
    c.line(p_rx, panel_top - 17, p_rx + 96, panel_top - 17)

    ty2 = panel_top - 32
    _info_row(c, p_rx, ty2,        "Order ID",   order_id,    maxlen=28)
    _info_row(c, p_rx, ty2 - 15,   "RZP Order",  rzp_order,   maxlen=28)
    _info_row(c, p_rx, ty2 - 30,   "RZP Pay",    rzp_payment, maxlen=28)
    _info_row(c, p_rx, ty2 - 45,   "Method",     pay_method,  maxlen=22)

    # status row with dot
    sy = ty2 - 60
    c.setFont("Helvetica-Bold", 8); rgb(SLATE)
    c.drawString(p_rx, sy, "Status")
    rgb(NAVY); c.drawString(p_rx + 58, sy, ":")
    sc = GREEN if pay_status.upper() == "SUCCESS" else RED_ERR
    rgb(sc); c.setFont("Helvetica-Bold", 8)
    c.drawString(p_rx + 66, sy, "\u25cf  " + _safe(pay_status, 12))

    # ── separator before table ────────────────────────────────
    tbl_sep_y = panel_y - 16
    srgb(GOLD); c.setLineWidth(0.8)
    c.line(margin + 8, tbl_sep_y, W - margin - 8, tbl_sep_y)
    srgb(NAVY); c.setLineWidth(0.25)
    c.line(margin + 8, tbl_sep_y - 2.5, W - margin - 8, tbl_sep_y - 2.5)

    # ── ITEMS TABLE (hour-based) ───────────────────────────────
    TL = margin + 12
    TR = W - margin - 12
    TW = TR - TL
    ROW_H = 18

    # 4 columns: Lab Name | Hour Price | Hours Purchased | Total Price
    col_w = [TW * 0.46, TW * 0.18, TW * 0.18, TW * 0.18]
    col_x = [TL]
    for cw in col_w[:-1]:
        col_x.append(col_x[-1] + cw)
    aligns = ["left", "right", "right", "right"]

    # Table header row
    hdr_y = tbl_sep_y - ROW_H - 6
    rgb(NAVY); srgb(NAVY); c.setLineWidth(0)
    c.rect(TL, hdr_y, TW, ROW_H, fill=1, stroke=0)

    hdr_labels = ["Lab / Item Description", "Hour Price (Rs.)", "Hours Purchased", "Total Price (Rs.)"]
    for hdr, cx, cw, al in zip(hdr_labels, col_x, col_w, aligns):
        _cell(c, hdr, cx, hdr_y + 5, cw, al, "Helvetica-Bold", 7.5, WHITE)

    # Data rows
    row_y = hdr_y
    for ri, item in enumerate(items):
        row_y -= ROW_H
        fill = LGRAY if ri % 2 == 0 else WHITE
        rgb(fill); srgb(BORDER); c.setLineWidth(0.3)
        c.rect(TL, row_y, TW, ROW_H, fill=1, stroke=1)

        vals = [
            _safe(item.get("desc", "Lab Subscription"), 48),
            _safe(item.get("hour_price", "Rs. 0.00"), 15),
            _safe(item.get("hours", "0"), 10),
            _safe(item.get("total", "Rs. 0.00"), 15),
        ]
        for val, cx, cw, al in zip(vals, col_x, col_w, aligns):
            _cell(c, val, cx, row_y + 5, cw, al)

    if not items:
        row_y -= ROW_H
        rgb(LGRAY); srgb(BORDER); c.setLineWidth(0.3)
        c.rect(TL, row_y, TW, ROW_H, fill=1, stroke=1)
        c.setFont("Helvetica", 8); rgb(SLATE)
        c.drawString(TL + 5, row_y + 5, "No items")

    # ── TOTALS ────────────────────────────────────────────────
    tot_y = row_y - 18
    lx_tot = TL + TW * 0.58
    rx_tot = TR

    # light separator line above totals
    srgb(BORDER); c.setLineWidth(0.4)
    c.line(lx_tot, tot_y + 14, rx_tot, tot_y + 14)

    c.setFont("Helvetica", 9); rgb(SLATE)
    c.drawString(lx_tot, tot_y, "Subtotal (excl. GST):")
    c.setFont("Helvetica", 9); rgb(NAVY)
    c.drawRightString(rx_tot, tot_y, f"Rs. {subtotal:,.2f}")

    tot_y -= 15
    c.setFont("Helvetica", 9); rgb(SLATE)
    c.drawString(lx_tot, tot_y, "GST @ 18%:")
    c.setFont("Helvetica", 9); rgb(NAVY)
    c.drawRightString(rx_tot, tot_y, f"Rs. {tax:,.2f}")

    # gold + navy double rule
    tot_y -= 7
    srgb(GOLD); c.setLineWidth(1.3)
    c.line(lx_tot, tot_y, rx_tot, tot_y)
    srgb(NAVY); c.setLineWidth(0.3)
    c.line(lx_tot, tot_y - 3, rx_tot, tot_y - 3)

    tot_y -= 20
    c.setFont("Helvetica-Bold", 13); rgb(NAVY)
    c.drawString(lx_tot, tot_y, "GRAND TOTAL")
    c.setFont("Helvetica-Bold", 14); rgb(BLUE)
    c.drawRightString(rx_tot, tot_y - 1, f"Rs. {grand_total:,.2f}")

    # ── FOOTER ───────────────────────────────────────────────
    foot_y = margin + 32

    srgb(GOLD); c.setLineWidth(0.8)
    c.line(margin + 8, foot_y + 20, W - margin - 8, foot_y + 20)
    srgb(NAVY); c.setLineWidth(0.3)
    c.line(margin + 8, foot_y + 22.5, W - margin - 8, foot_y + 22.5)

    c.setFont("Helvetica-Bold", 8.5); rgb(NAVY)
    c.drawString(margin + 12, foot_y + 8, "CYBER RANGE")
    c.setFont("Helvetica", 7.5); rgb(SLATE)
    c.drawString(margin + 12, foot_y - 4, "Cybersecurity Virtual Lab Platform")

    c.setFont("Helvetica", 7.5); rgb(SLATE)
    c.drawRightString(W - margin - 12, foot_y + 8, "Thank you for using CyberRange.")
    c.drawRightString(W - margin - 12, foot_y - 4, "This is a system-generated invoice.")

    c.save()
    buf.seek(0)
    return buf.getvalue()
