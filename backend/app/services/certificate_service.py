import io
import os
import json
import logging
from PIL import Image, ImageDraw, ImageFont

from app.services.storage_provider import storage_provider

logger = logging.getLogger("certificate_service")


class CertificateService:
    """
    CyberRange V3 — Dynamic Rule-Based Certificate Generation Engine.

    Dynamic rendering pipeline for the modern technical template:
      1. Load clean master PNG (with circuit patterns, icons, signatures)
      2. Read dynamic titles/subtitles mapping from certificate_rules.json
      3. Draw title, subtitle, certifying text, recipient name, action subtitle, and target name
      4. Draw the bottom completion date and certificate ID card values
      5. Export as PNG (lossless) and PDF (300 DPI) without any QR Code overlay
    """

    def __init__(self):
        self.base_dir       = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
        self.assets_dir     = os.path.join(self.base_dir, "assets", "certificates")
        self.master_png_path = os.path.join(self.assets_dir, "certificate_master.png")
        self.layout_json_path = os.path.join(self.assets_dir, "certificate_layout.json")
        self.fonts_dir      = os.path.join(self.assets_dir, "fonts")
        self.layout_cfg     = self._load_layout_config()

    def _load_layout_config(self) -> dict:
        if os.path.exists(self.layout_json_path):
            try:
                with open(self.layout_json_path, "r", encoding="utf-8") as f:
                    return json.load(f)
            except Exception as err:
                logger.error(f"Failed to load certificate_layout.json: {err}")
        return self._fallback_layout()

    def _fallback_layout(self) -> dict:
        return {
            "canvas": {"width": 1400, "height": 990},
            "fields": {
                "recipient_name": {"x": 700, "y": 412, "font": "GreatVibes-Regular.ttf", "size": 92, "color": "#0F172A", "align": "center"},
                "lab_title": {"x": 700, "y": 616, "font": "PlusJakartaSans-Bold.ttf", "size": 34, "color": "#0B1F3A", "align": "center"},
                "completion_date": {"x": 560, "y": 758, "font": "PlusJakartaSans-Bold.ttf", "size": 20, "color": "#0F172A", "align": "center"},
                "certificate_id": {"x": 950, "y": 758, "font": "PlusJakartaSans-Bold.ttf", "size": 20, "color": "#0F172A", "align": "center"}
            }
        }

    def _get_rule_by_lab_id(self, lab_id: str) -> dict:
        rules_path = os.path.join(self.base_dir, "core", "certificate_rules.json")
        if os.path.exists(rules_path):
            try:
                with open(rules_path, "r", encoding="utf-8") as f:
                    cfg = json.load(f)
                    rules = cfg.get("rules", {})
                    if lab_id in rules:
                        return rules[lab_id]
                    ach_key = f"ach-{lab_id}"
                    if ach_key in rules:
                        return rules[ach_key]
            except Exception as e:
                logger.error(f"Error loading certificate_rules.json for lab_id={lab_id}: {e}")
        return {}

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
                return ImageFont.truetype(fb_path, size)
        raise RuntimeError(f"No usable font found in: {self.fonts_dir}")

    def _draw_text(
        self,
        draw: ImageDraw.ImageDraw,
        val: str,
        f_cfg: dict,
        font: ImageFont.FreeTypeFont,
        max_width: int = 0,
    ):
        text = str(val)
        if max_width > 0:
            bb = font.getbbox(text)
            tw = bb[2] - bb[0]
            if tw > max_width:
                new_size = max(12, int(font.size * max_width / tw * 0.95))
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

    def render_png(
        self,
        lab_id: str,
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
                f"Run: python create_clean_master_v5.py"
            )

        base_img = Image.open(self.master_png_path).convert("RGBA")
        draw     = ImageDraw.Draw(base_img)

        W = self.layout_cfg.get("canvas", {}).get("width", 1400)
        cx = W // 2

        # 1. Resolve rule metadata dynamically
        rule = self._get_rule_by_lab_id(lab_id)
        cert_title = rule.get("cert_title", "CERTIFICATE").upper()
        cert_subtitle_header = rule.get("cert_subtitle_header", "OF COMPLETION").upper()
        cert_subtitle = rule.get("cert_subtitle", "HAS SUCCESSFULLY COMPLETED THE LAB").upper()
        cert_target_name = rule.get("cert_target_name", lab_title).upper()

        # 2. Draw Certificate Title dynamic texts
        f_cert = self._get_font("PlusJakartaSans-Bold.ttf", 50)
        self._draw_text(draw, cert_title, {"x": cx, "y": 250, "align": "center", "color": "#0B1F3A"}, f_cert)

        if cert_subtitle_header:
            f_comp = self._get_font("PlusJakartaSans-Bold.ttf", 15)
            self._draw_text(draw, cert_subtitle_header, {"x": cx, "y": 326, "align": "center", "color": "#D89B2B"}, f_comp)

        # 3. Draw Certify text
        f_certify = self._get_font("PlusJakartaSans-Regular.ttf", 14)
        self._draw_text(draw, "THIS IS TO CERTIFY THAT", {"x": cx, "y": 402, "align": "center", "color": "#94A3B8"}, f_certify)

        # 4. Draw Recipient Name — formal PlusJakartaSans Bold, large uppercase
        f_name = self._get_font("PlusJakartaSans-Bold.ttf", 72)
        self._draw_text(draw, recipient_name.upper(), {"x": cx, "y": 440, "align": "center", "color": "#0B1F3A", "font": "PlusJakartaSans-Bold.ttf"}, f_name, max_width=1100)

        # 5. Draw Subtitle completion action
        f_complete = self._get_font("PlusJakartaSans-Regular.ttf", 14)
        self._draw_text(draw, cert_subtitle, {"x": cx, "y": 561, "align": "center", "color": "#94A3B8"}, f_complete)

        # 6. Draw Target Name (with bold PlusJakartaSans font)
        f_target = self._get_font("PlusJakartaSans-Bold.ttf", 34)
        self._draw_text(draw, cert_target_name, {"x": cx, "y": 616, "align": "center", "color": "#0B1F3A"}, f_target, max_width=1200)

        # 7. Draw Completed On Card Details Label + Value
        lbl_date = "EARNED ON" if rule.get("trigger_type") == "profile_score" else "COMPLETED ON"
        f_lbl = self._get_font("PlusJakartaSans-Regular.ttf", 11)
        f_val = self._get_font("PlusJakartaSans-Bold.ttf", 20)
        
        self._draw_text(draw, lbl_date, {"x": 560, "y": 730, "align": "center", "color": "#94A3B8"}, f_lbl)
        self._draw_text(draw, date_str.upper(), {"x": 560, "y": 758, "align": "center", "color": "#0F172A"}, f_val)

        # 8. Draw Certificate ID Card Details Label + Value
        self._draw_text(draw, "CERTIFICATE ID", {"x": 950, "y": 730, "align": "center", "color": "#94A3B8"}, f_lbl)
        self._draw_text(draw, display_id.upper(), {"x": 950, "y": 758, "align": "center", "color": "#0F172A"}, f_val)

        buffer = io.BytesIO()
        rgb_img = Image.new("RGB", base_img.size, (255, 255, 255))
        rgb_img.paste(base_img, mask=base_img.split()[3])
        rgb_img.save(buffer, format="PNG")
        buffer.seek(0)
        return buffer.getvalue()

    def render_pdf(
        self,
        lab_id: str,
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
            lab_id, display_id, recipient_name, lab_title, category,
            score, percentage, points, date_str, duration_str, verify_url,
        )
        img        = Image.open(io.BytesIO(png_bytes))
        pdf_buffer = io.BytesIO()
        img.save(pdf_buffer, format="PDF", resolution=300.0)
        pdf_buffer.seek(0)
        return pdf_buffer.getvalue()

    def generate_and_save_certificate(
        self,
        lab_id: str,
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
            lab_id, display_id, recipient_name, lab_title, category,
            score, percentage, points, date_str, duration_str, verify_url,
        )
        pdf_bytes = self.render_pdf(
            lab_id, display_id, recipient_name, lab_title, category,
            score, percentage, points, date_str, duration_str, verify_url,
        )

        png_rel = f"png/{display_id}.png"
        pdf_rel = f"pdf/{display_id}.pdf"

        png_path = storage_provider.save(png_bytes, png_rel)
        pdf_path = storage_provider.save(pdf_bytes, pdf_rel)

        logger.info(f"New dynamic certificate template rendered & saved: {display_id}")
        return pdf_path, png_path


certificate_service = CertificateService()
