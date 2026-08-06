export interface CartItem {
  id: number | string;
  lab_id: string;
  lab_title?: string | null;
  lab_image?: string;
  price_inr?: number | null;
  quantity?: number | null; // Student Seats
  license_duration_months?: number | null;
}

export interface CartSummary {
  subtotal: number;
  discountAmount: number;
  tax: number;
  grandTotal: number;
  cartItems: CartItem[];
}
