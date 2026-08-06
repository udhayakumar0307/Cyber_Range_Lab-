"""
CyberRange V3 — Programmatic Master Certificate Template Generator
==================================================================
Enterprise-grade certificate design inspired by Coursera / Microsoft Learn / HTB Academy.
Canvas: 1400 x 990 px landscape.

Run: python build_master_template.py
"""

import os
import math
from PIL import Image, ImageDraw, ImageFont

# ── Constants ────────────────────────────────────────────────────────────────
W, H = 1400, 990
ASSETS = "backend/app/assets/certificates"
FONTS  = os.path.join(ASSETS, "fonts")
OUT    = os.path.join(ASSETS, "certificate_master.png")

# ── Palette ───────────────────────────────────────────────────────────────────
NAVY       = (15,  23,  42)        # #0F172A
NAVY_MID   = (30,  58, 138)        # #1E3A8A
GOLD       = (212, 175,  55)       # #D4AF37
GOLD_LIGHT = (251, 216, 107)       # #FBD86B
WHITE      = (255, 255, 255)
OFF_WHITE  = (248, 250, 252)       # #F8FAFC
SLATE_200  = (226, 232, 240)
SLATE_400  = (148, 163, 184)
SLATE_600  = ( 71,  85, 105)

# ── Layout Constants ──────────────────────────────────────────────────────────
HEADER_H  = 130    # navy header bar height
FOOTER_Y  = 610    # where navy footer starts
BORDER    = 6      # outer navy border thickness
GOLD_INSET = 15    # inner gold frame inset from edge


def load_font(name, size):
    path = os.path.join(FONTS, name)
    if os.path.exists(path):
        return ImageFont.truetype(path, size)
    raise FileNotFoundError(f"Font not found: {path}")


def draw_cx(draw, text, font, cx, y, fill):
    bb = font.getbbox(text)
    tw = bb[2] - bb[0]
    draw.text((int(cx - tw / 2), y), text, fill=fill, font=font)


def build_master():
    img  = Image.new("RGB", (W, H), WHITE)
    draw = ImageDraw.Draw(img, "RGBA")

    # ── 1. Body background (off-white inside borders) ────────────────────────
    draw.rectangle([BORDER, BORDER, W - BORDER, H - BORDER], fill=OFF_WHITE)

    # ── 2. Outer navy border ──────────────────────────────────────────────────
    for i in range(BORDER):
        draw.rectangle([i, i, W - 1 - i, H - 1 - i], outline=NAVY)

    # ── 3. Gold inner frame (inset from body) ─────────────────────────────────
    gi = GOLD_INSET
    draw.rectangle([gi, gi, W - gi, H - gi], outline=GOLD, width=1)
    draw.rectangle([gi + 3, gi + 3, W - gi - 3, H - gi - 3], outline=(*GOLD, 60), width=1)

    # ── 4. NAVY HEADER BAR ────────────────────────────────────────────────────
    draw.rectangle([0, 0, W, HEADER_H], fill=NAVY)
    # Gold accent line at bottom of header
    draw.rectangle([0, HEADER_H - 4, W, HEADER_H], fill=GOLD)
    # Faint hairline below gold line
    draw.rectangle([0, HEADER_H, W, HEADER_H + 1], fill=(*GOLD, 40))

    # ── 5. LOGO — top left of header ─────────────────────────────────────────
    sx, sy = 36, 18

    # Outer shield outline
    shield_pts = [
        (sx + 32, sy + 2),
        (sx + 58, sy + 16),
        (sx + 58, sy + 42),
        (sx + 32, sy + 64),
        (sx + 6,  sy + 42),
        (sx + 6,  sy + 16),
    ]
    draw.polygon(shield_pts, fill=NAVY_MID, outline=GOLD)

    # Lock body
    lx, ly = sx + 20, sy + 34
    draw.rounded_rectangle([lx, ly, lx + 24, ly + 18], radius=3, fill=GOLD)
    # Lock shackle (arc)
    for t in range(10, 175, 10):
        r = t * math.pi / 180
        bx = sx + 32 + int(9 * math.cos(r))
        by = ly - int(10 * math.sin(r))
        draw.ellipse([bx - 2, by - 2, bx + 2, by + 2], fill=GOLD)

    # Brand text
    f_brand = load_font("PlusJakartaSans-Bold.ttf", 30)
    f_tag   = load_font("PlusJakartaSans-Bold.ttf", 10)
    draw.text((sx + 72, sy + 12), "CYBER RANGE",              fill=WHITE,      font=f_brand)
    draw.text((sx + 72, sy + 48), "LEARN.  PRACTICE.  DEFEND.", fill=GOLD_LIGHT, font=f_tag)

    # ── 6. CERTIFICATE HEADER ZONE — (text drawn dynamically) ───────────────────
    cx = W // 2

    # ── 7. BODY ZONE — (text drawn dynamically) ───────────────────────────────
    # ── Recipient name placeholder (y=180 to y=295) — blank zone ──
    draw.rectangle([100, 175, W - 100, 296], fill=OFF_WHITE)

    # Gold underline beneath name
    draw.rectangle([250, 297, W - 250, 300], fill=GOLD)
    # Gold diamond accent on underline center
    draw.polygon([
        (cx, 291), (cx + 8, 299),
        (cx, 307), (cx - 8, 299)
    ], fill=GOLD)

    # ── Lab title placeholder (y=358 to y=418) — blank zone ──
    draw.rectangle([60, 355, W - 60, 418], fill=OFF_WHITE)

    # Subtle gold underline below lab title
    draw.rectangle([150, 422, W - 150, 424], fill=(*GOLD, 80))

    # ── 8. METRICS ROW ZONE — (drawn dynamically based on config) ──────────────
    MX_TOP = 492
    MX_BOT = 580
    col_xs = [230, 540, 860, 1170]

    # ── 9. NAVY FOOTER BAR ────────────────────────────────────────────────────
    draw.rectangle([0, FOOTER_Y, W, H], fill=NAVY)
    draw.rectangle([0, FOOTER_Y, W, FOOTER_Y + 4], fill=GOLD)

    # ── 10. SIGNATURE BLOCK — footer left ────────────────────────────────────
    f_sig     = load_font("GreatVibes-Regular.ttf",    44)
    f_sig_nm  = load_font("PlusJakartaSans-Bold.ttf",  12)
    f_sig_sub = load_font("PlusJakartaSans-Regular.ttf", 11)

    sig_x, sig_y = 70, FOOTER_Y + 28
    draw.text((sig_x, sig_y), "CyberRange Team", fill=(*GOLD_LIGHT, 255), font=f_sig)
    sig_bb = f_sig.getbbox("CyberRange Team")
    sig_w  = sig_bb[2] - sig_bb[0]
    sig_h  = sig_bb[3] - sig_bb[1]
    # Underline
    draw.rectangle([sig_x, sig_y + sig_h + 4, sig_x + sig_w, sig_y + sig_h + 6], fill=(*GOLD, 140))
    # Name + role
    draw.text((sig_x, sig_y + sig_h + 14), "CyberRange Team",       fill=WHITE,     font=f_sig_nm)
    draw.text((sig_x, sig_y + sig_h + 30), "Training & Development", fill=SLATE_400, font=f_sig_sub)

    # ── 11. OFFICIAL SEAL — footer center ────────────────────────────────────
    seal_cx, seal_cy = W // 2, FOOTER_Y + 185
    seal_r  = 90

    # Outer spike ring (28 spikes)
    for i in range(28):
        angle = (i / 28) * 2 * math.pi
        x1 = seal_cx + int((seal_r - 2)  * math.cos(angle))
        y1 = seal_cy + int((seal_r - 2)  * math.sin(angle))
        x2 = seal_cx + int((seal_r + 10) * math.cos(angle))
        y2 = seal_cy + int((seal_r + 10) * math.sin(angle))
        draw.line([x1, y1, x2, y2], fill=GOLD, width=2)

    # Outer ring
    draw.ellipse(
        [seal_cx - seal_r, seal_cy - seal_r, seal_cx + seal_r, seal_cy + seal_r],
        outline=GOLD, width=3
    )
    # Inner ring
    draw.ellipse(
        [seal_cx - seal_r + 12, seal_cy - seal_r + 12,
         seal_cx + seal_r - 12, seal_cy + seal_r - 12],
        outline=(*GOLD, 80), width=1
    )

    # Shield inside seal
    s2 = [
        (seal_cx,      seal_cy - 50),
        (seal_cx + 32, seal_cy - 32),
        (seal_cx + 32, seal_cy + 12),
        (seal_cx,      seal_cy + 44),
        (seal_cx - 32, seal_cy + 12),
        (seal_cx - 32, seal_cy - 32),
    ]
    draw.polygon(s2, fill=NAVY_MID, outline=GOLD)

    # Lock on seal
    ll_x, ll_y = seal_cx - 11, seal_cy - 12
    draw.rounded_rectangle([ll_x, ll_y, ll_x + 22, ll_y + 16], radius=2, fill=GOLD)
    for t in range(15, 175, 15):
        r = t * math.pi / 180
        bx = seal_cx + int(8 * math.cos(r))
        by = ll_y - int(10 * math.sin(r))
        draw.ellipse([bx - 2, by - 2, bx + 2, by + 2], fill=GOLD)

    # Arc text "CYBER RANGE" around bottom of seal
    f_seal_lbl = load_font("PlusJakartaSans-Bold.ttf", 10)
    draw_cx(draw, "CYBER  RANGE", f_seal_lbl, seal_cx, seal_cy + 58, GOLD)

    # ── 12. QR CODE ZONE — footer right ──────────────────────────────────────
    QR_X    = 1078
    QR_Y    = FOOTER_Y + 22
    QR_SIZE = 148

    # White QR background with gold border
    draw.rectangle([QR_X - 3, QR_Y - 3, QR_X + QR_SIZE + 3, QR_Y + QR_SIZE + 3],
                   fill=WHITE, outline=(*GOLD, 60), width=1)
    draw.rectangle([QR_X, QR_Y, QR_X + QR_SIZE, QR_Y + QR_SIZE], fill=WHITE)

    f_qr_lbl = load_font("PlusJakartaSans-Bold.ttf",    10)
    f_qr_sub = load_font("PlusJakartaSans-Regular.ttf", 10)
    f_certid = load_font("PlusJakartaSans-Bold.ttf",    10)

    qr_cx = QR_X + QR_SIZE // 2
    draw_cx(draw, "VERIFY CERTIFICATE",         f_qr_lbl, qr_cx, QR_Y + QR_SIZE + 10, GOLD_LIGHT)
    draw_cx(draw, "Scan to verify authenticity", f_qr_sub, qr_cx, QR_Y + QR_SIZE + 26, SLATE_400)

    # Certificate ID zone — navy pill below QR scan text
    cid_y = QR_Y + QR_SIZE + 50
    draw.rectangle([QR_X - 8, cid_y, QR_X + QR_SIZE + 8, cid_y + 22], fill=(*NAVY, 255))
    # Placeholder (dynamic cert ID drawn here)

    # ── 13. SUBTLE WATERMARK — large shield outline at body center ────────────
    wm = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    wm_draw = ImageDraw.Draw(wm)
    wm_cx, wm_cy = W // 2, 380
    wm_r = 210
    wm_pts = [
        (wm_cx,        wm_cy - wm_r),
        (wm_cx + wm_r, wm_cy - wm_r // 2),
        (wm_cx + wm_r, wm_cy + wm_r // 3),
        (wm_cx,        wm_cy + wm_r),
        (wm_cx - wm_r, wm_cy + wm_r // 3),
        (wm_cx - wm_r, wm_cy - wm_r // 2),
    ]
    wm_draw.polygon(wm_pts, outline=(15, 23, 42, 10), width=4)
    img = img.convert("RGBA")
    img = Image.alpha_composite(img, wm)
    img = img.convert("RGB")

    # ── Save ──────────────────────────────────────────────────────────────────
    os.makedirs(ASSETS, exist_ok=True)
    img.save(OUT, format="PNG")
    print(f"[OK] Master template saved: {OUT}  ({W}x{H})")

    return {
        "QR_X": QR_X, "QR_Y": QR_Y, "QR_SIZE": QR_SIZE,
        "col_xs": col_xs,
        "MX_TOP": MX_TOP,
        "FOOTER_Y": FOOTER_Y,
    }


if __name__ == "__main__":
    coords = build_master()

    # Write layout JSON
    import json

    QR_X    = coords["QR_X"]
    QR_Y    = coords["QR_Y"]
    QR_SIZE = coords["QR_SIZE"]
    col_xs  = coords["col_xs"]
    MX_TOP  = coords["MX_TOP"]

    layout = {
        "canvas": {"width": W, "height": H},
        "fields": {
            "recipient_name": {
                "x": W // 2, "y": 183,
                "font": "GreatVibes-Regular.ttf", "size": 92,
                "color": "#0F172A", "align": "center"
            },
            "lab_title": {
                "x": W // 2, "y": 362,
                "font": "PlusJakartaSans-Bold.ttf", "size": 36,
                "color": "#1E3A8A", "align": "center"
            },
            "completion_date": {
                "x": col_xs[0], "y": MX_TOP + 34,
                "font": "PlusJakartaSans-Bold.ttf", "size": 20,
                "color": "#0F172A", "align": "center"
            },
            "duration": {
                "x": col_xs[1], "y": MX_TOP + 34,
                "font": "PlusJakartaSans-Bold.ttf", "size": 20,
                "color": "#0F172A", "align": "center"
            },
            "score": {
                "x": col_xs[2], "y": MX_TOP + 34,
                "font": "PlusJakartaSans-Bold.ttf", "size": 20,
                "color": "#0F172A", "align": "center"
            },
            "accuracy": {
                "x": col_xs[3], "y": MX_TOP + 34,
                "font": "PlusJakartaSans-Bold.ttf", "size": 20,
                "color": "#0F172A", "align": "center"
            },
            "certificate_id": {
                "x": QR_X + QR_SIZE // 2, "y": QR_Y + QR_SIZE + 54,
                "font": "PlusJakartaSans-Bold.ttf", "size": 10,
                "color": "#FBD86B", "align": "center"
            },
            "qr_code": {
                "x": QR_X, "y": QR_Y,
                "width": QR_SIZE, "height": QR_SIZE
            }
        }
    }

    layout_path = os.path.join(ASSETS, "certificate_layout.json")
    with open(layout_path, "w", encoding="utf-8") as f:
        json.dump(layout, f, indent=2)
    print(f"[OK] Layout JSON saved: {layout_path}")
    print(json.dumps(layout, indent=2))
