class OrderNormalizer:
    def normalize(self, raw_order: dict) -> dict:
        return {
            "order_id": str(raw_order.get("id") or raw_order.get("order_id") or ""),
            "customer_id": str(raw_order.get("customer_id") or ""),
            "total": float(raw_order.get("total") or 0.0),
            "status": raw_order.get("status") or "Pending"
        }

order_normalizer = OrderNormalizer()
