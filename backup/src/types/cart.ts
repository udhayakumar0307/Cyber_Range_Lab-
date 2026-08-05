export interface CartItem {
  id: number | string;
  lab_id: string;
  lab_title?: string | null;
  lab_image?: string;
  price_inr?: number | null;       // Per-hour rate (computed by difficulty)
  hours_purchased?: number | null; // Number of hours purchased
  item_total?: number | null;      // price_inr * hours_purchased
  quantity?: number | null;        // Legacy, kept for compat
  license_duration_months?: number | null; // Legacy, kept for compat
}

export interface CartSummary {
  subtotal: number;
  discountAmount: number;
  tax: number;
  grandTotal: number;
  cartItems: CartItem[];
}
