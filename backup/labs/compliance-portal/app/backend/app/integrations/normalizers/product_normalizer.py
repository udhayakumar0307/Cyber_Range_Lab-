class ProductNormalizer:
    def normalize(self, raw_product: dict) -> dict:
        return {
            "product_id": str(raw_product.get("id") or raw_product.get("product_id") or ""),
            "title": raw_product.get("title") or raw_product.get("name") or "Unknown",
            "price": float(raw_product.get("price") or 0.0)
        }

product_normalizer = ProductNormalizer()
