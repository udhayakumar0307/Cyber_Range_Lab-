import io
import os
import json
import logging
import textwrap
from PIL import Image, ImageDraw, ImageFont
import qrcode

from app.services.storage_provider import storage_provider

logger = logging.getLogger("certificate_service")


class CertificateService:
    """
    CyberRange V3 — Backend-Driven Certificate Generation Engine.

    Single authoritative rendering pipeline:
      1. Load clean master PNG (all static elements baked in)
      2. Read dynamic field coordinates from certificate_layout.json
      3. Generate high-res QR code (ERROR_CORRECT_H)
      4. Overlay dynamic DB data (name, lab, date, duration, score, accuracy, cert ID)
      5. Export as PNG (lossless) and PDF (300 DPI)

    No browser. No HTML. No canvas. No screenshots.
    """

    def __init__(self):
        self.base_dir       = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
        self.assets_dir     = os.path.join(self.base_dir, "assets", "certificates")
        self.master_png_path = os.path.join(self.assets_dir, "certificate_master.png")
        self.layout_json_path = os.path.join(self.assets_dir, "certificate_layout.json")
        self.fonts_dir      = os.path.join(self.assets_dir, "fonts")
        self.layout_cfg     = self._load_layout_config()

    # ── Configuration ──────────────────────────────────────────────────────────

    def _load_layout_config(self) -> dict:
        if os.path.exists(self.layout_json_path):
            try:
                with open(self.layout_json_path, "r", encoding="utf-8") as f:
                    return json.load(f)
            except Exception as err:
                logger.error(f"Failed to load certificate_layout.json: {err}")
        logger.warning("Using hardcoded fallback layout config — rebuild master template!")
        return self._fallback_layout()

    def _fallback_layout(self) -> dict:
        return {
            "canvas": {"width": 1400, "height": 990},
            "fields": {
                "recipient_name":  {"x": 700,  "y": 183, "font": "GreatVibes-Regular.ttf",    "size": 92, "color": "#0F172A", "align": "center"},
                "lab_title":       {"x": 700,  "y": 362, "font": "PlusJakartaSans-Bold.ttf",   "size": 36, "color": "#1E3A8A", "align": "center"},
                "completion_date": {"x": 230,  "y": 526, "font": "PlusJakartaSans-Bold.ttf",   "size": 20, "color": "#0F172A", "align": "center"},
                "duration":        {"x": 540,  "y": 526, "font": "PlusJakartaSans-Bold.ttf",   "size": 20, "color": "#0F172A", "align": "center"},
                "score":           {"x": 860,  "y": 526, "font": "PlusJakartaSans-Bold.ttf",   "size": 20, "color": "#0F172A", "align": "center"},
                "accuracy":        {"x": 1170, "y": 526, "font": "PlusJakartaSans-Bold.ttf",   "size": 20, "color": "#0F172A", "align": "center"},
                "certificate_id":  {"x": 1152, "y": 834, "font": "PlusJakartaSans-Bold.ttf",   "size": 10, "color": "#FBD86B", "align": "center"},
                "qr_code":         {"x": 1078, "y": 632, "width": 148, "height": 148}
            }
        }

    # ── Font Loading ────────────────────────────────────────────────────────────

    def _get_font(self, font_name: str, size: int) -> ImageFont.FreeTypeFont:
        path = os.path.join(self.fonts_dir, font_name)
        if os.path.exists(path):
            try:
                return ImageFont.truetype(path, size)
            except Exception as err:
                logger.error(f"Failed loading font '{font_name}': {err}")
        # Fallback chain
        for fallback in ["PlusJakartaSans-Bold.ttf", "PlusJakartaSans-Regular.ttf"]:
            fb_path = os.path.join(self.fonts_dir, fallback)
            if os.path.exists(fb_path):
                logger.warning(f"Falling back to {fallback} for {font_name}")
                return ImageFont.truetype(fb_path, size)
        raise RuntimeError(f"No usable font found in: {self.fonts_dir}")

    # ── Text Drawing ────────────────────────────────────────────────────────────

    def _draw_text(
        self,
        draw: ImageDraw.ImageDraw,
        val: str,
        f_cfg: dict,
        font: ImageFont.FreeTypeFont,
        max_width: int = 0,
    ):
        """
        Draw text with center / right / left alignment.
        If max_width > 0 and text is wider, auto-scales font down (up to 30% reduction).
        """
        text = str(val)
        if max_width > 0:
            bb = font.getbbox(text)
            tw = bb[2] - bb[0]
            if tw > max_width:
                # Scale font size to fit
                new_size = max(12, int(f_cfg["size"] * max_width / tw * 0.95))
                font = self._get_font(f_cfg.get("font", "PlusJakartaSans-Bold.ttf"), new_size)

        bb = font.getbbox(text)
        tw = bb[2] - bb[0]
        x  = f_cfg["x"]
        align = f_cfg.get("align", "left")
        if align == "center":
            x = f_cfg["x"] - tw // 2
        elif align == "right":
            x = f_cfg["x"] - tw
        draw.text((int(x), f_cfg["y"]), text, fill=f_cfg.get("color", "#0F172A"), font=font)

    # ── QR Generation ──────────────────────────────────────────────────────────

    def generate_qr_image(self, verify_url: str, size: tuple[int, int]) -> Image.Image:
        """High-res ERROR_CORRECT_H QR — never upscaled after native generation."""
        qr = qrcode.QRCode(
            version=1,
            error_correction=qrcode.constants.ERROR_CORRECT_H,
            box_size=14,
            border=4,
        )
        qr.add_data(verify_url)
        qr.make(fit=True)
        qr_img = qr.make_image(fill_color="#0F172A", back_color="white").convert("RGBA")
        return qr_img.resize(size, Image.Resampling.LANCZOS)

    # ── Core Renderer ───────────────────────────────────────────────────────────

    def render_png(
        self,
        display_id: str,
        recipient_name: str,
        lab_title: str,
        category: str,
        score: int,
        percentage: int,
        points: int,
        date_str: str,
        duration_str: str,
        verify_url: str,
    ) -> bytes:
        if not os.path.exists(self.master_png_path):
            raise FileNotFoundError(
                f"Master certificate template missing: {self.master_png_path}\n"
                f"Run: python build_master_template.py"
            )

        base_img = Image.open(self.master_png_path).convert("RGBA")
        draw     = ImageDraw.Draw(base_img)
        fields   = self.layout_cfg.get("fields", {})

        # 2. Dynamic text fields from DB
        W = self.layout_cfg.get("canvas", {}).get("width", 1400)

        field_values = {
            "recipient_name":  recipient_name,
            "lab_title":       lab_title,
            "completion_date": date_str,
            "certificate_id":  display_id,
        }

        # Max widths per field to prevent overflow
        max_widths = {
            "recipient_name": W - 300,   # 1100px wide zone
            "lab_title":      W - 200,   # 1200px wide zone
            "completion_date": 300,
            "certificate_id":  300,
        }

        for key, val in field_values.items():
            if key in fields:
                f_cfg = fields[key]
                font  = self._get_font(f_cfg.get("font", "PlusJakartaSans-Bold.ttf"), f_cfg.get("size", 18))
                self._draw_text(draw, val, f_cfg, font, max_width=max_widths.get(key, 0))

        buffer = io.BytesIO()
        # Create a solid white background to blend RGBA channels properly (prevent black backgrounds)
        rgb_img = Image.new("RGB", base_img.size, (255, 255, 255))
        rgb_img.paste(base_img, mask=base_img.split()[3]) # paste using alpha channel mask
        rgb_img.save(buffer, format="PNG")
        buffer.seek(0)
        return buffer.getvalue()

    # ── PDF Export ──────────────────────────────────────────────────────────────

    def render_pdf(
        self,
        display_id: str,
        recipient_name: str,
        lab_title: str,
        category: str,
        score: int,
        percentage: int,
        points: int,
        date_str: str,
        duration_str: str,
        verify_url: str,
    ) -> bytes:
        """Converts rendered PNG to 300 DPI landscape PDF via Pillow."""
        png_bytes = self.render_png(
            display_id, recipient_name, lab_title, category,
            score, percentage, points, date_str, duration_str, verify_url,
        )
        img        = Image.open(io.BytesIO(png_bytes))
        pdf_buffer = io.BytesIO()
        img.save(pdf_buffer, format="PDF", resolution=300.0)
        pdf_buffer.seek(0)
        return pdf_buffer.getvalue()

    # ── Orchestration ────────────────────────────────────────────────────────────

    def generate_and_save_certificate(
        self,
        display_id: str,
        recipient_name: str,
        lab_title: str,
        category: str,
        score: int,
        percentage: int,
        points: int,
        date_str: str,
        duration_str: str,
        verify_url: str,
    ) -> tuple[str, str]:
        png_bytes = self.render_png(
            display_id, recipient_name, lab_title, category,
            score, percentage, points, date_str, duration_str, verify_url,
        )
        pdf_bytes = self.render_pdf(
            display_id, recipient_name, lab_title, category,
            score, percentage, points, date_str, duration_str, verify_url,
        )

        png_rel = f"png/{display_id}.png"
        pdf_rel = f"pdf/{display_id}.pdf"

        png_path = storage_provider.save(png_bytes, png_rel)
        pdf_path = storage_provider.save(pdf_bytes, pdf_rel)

        logger.info(f"V3 certificate rendered & saved: {display_id}")
        return pdf_path, png_path


certificate_service = CertificateService()
