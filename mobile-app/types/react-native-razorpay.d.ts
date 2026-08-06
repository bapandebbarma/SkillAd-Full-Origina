declare module "react-native-razorpay" {
  export interface RazorpayCheckoutOptions {
    key: string;
    amount: number | string;
    currency: string;
    name?: string;
    description?: string;
    image?: string;
    order_id: string;
    prefill?: {
      name?: string;
      email?: string;
      contact?: string;
    };
    theme?: { color?: string };
    notes?: Record<string, string>;
  }

  export interface RazorpaySuccessData {
    razorpay_payment_id: string;
    razorpay_order_id: string;
    razorpay_signature: string;
  }

  export interface RazorpayErrorData {
    code?: number | string;
    description?: string;
    error?: {
      code?: string;
      description?: string;
      reason?: string;
      step?: string;
      source?: string;
    };
  }

  const RazorpayCheckout: {
    open: (options: RazorpayCheckoutOptions) => Promise<RazorpaySuccessData>;
  };

  export default RazorpayCheckout;
}
