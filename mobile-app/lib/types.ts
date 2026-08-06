export interface Provider {
  id: string;
  userId?: string;
  name: string;
  category: string;
  subcategory?: string;
  rating: number;
  reviewCount: number;
  distance: number;
  available: boolean;
  experience: number;
  description: string;
  phone: string;
  location: string;
  serviceArea?: string;
  serviceRadius: number;
  serviceCharge?: string;
  workingHours: string;
  latitude: number;
  longitude: number;
  verified: boolean;
  initials: string;
  avatarColor: string;
  avatarUrl?: string | null;
  services: string[];
  reviews: Review[];
}

export interface Category {
  id: string;
  name: string;
  icon: string;
  color: string;
  showOnHome?: boolean;
  searchCount?: number;
  homeOrder?: number | null;
}

export interface Review {
  id: string;
  reviewerName: string;
  reviewerInitials: string;
  rating: number;
  comment: string;
  date: string;
  avatarUrl?: string | null;
}

export interface Conversation {
  id: string;
  providerId: string;
  /** Present only on provider-view rows (when the logged-in user is the provider).
   *  This is the other participant's (customer's) UUID. Use this — not providerId —
   *  when navigating to Chat from a provider-view conversation so the chat screen
   *  loads the customer's profile and avatar, not the provider's own. */
  customerId?: string;
  providerName: string;
  providerCategory: string;
  providerAvatarColor: string;
  providerInitials: string;
  providerAvatarUrl?: string | null;
  customerAvatarUrl?: string | null;
  lastMessage: string;
  lastMessageTime: string;
  unreadCount: number;
  phone: string;
}

export interface ChatMessage {
  id: string;
  senderId: string;
  text: string;
  timestamp: string;
  read: boolean;
  type: "text" | "booking" | "work_completed" | "review_request";
  booking?: BookingCard;
  /** Payload attached to `work_completed` token messages. Stored server-side in booking_data JSONB. */
  workCompleted?: {
    bookingMsgId: string;
    service: string;
    amount: string;
    amountValue?: number;
  };
  reviewRequest?: { providerId: string; providerName: string; reviewSubmitted?: boolean };
}

export interface BookingCard {
  service: string;
  date: string;
  time: string;
  amount: string;
  /** Structured numeric amount in ₹ — set at booking creation time.
   *  Always prefer this over parsing `amount` string. */
  amountValue?: number;
  status?: BookingStatus;
}

export interface Notification {
  id: string;
  title: string;
  body: string;
  time: string;
  read: boolean;
  type: "message" | "booking" | "review" | "system" | "subscription";
}

export interface User {
  id: string;
  name: string;
  phone: string;
  isProvider: boolean;
  avatarUrl?: string | null;
  providerProfile?: Partial<Provider>;
  providerId?: string;  // Provider record ID (from JSON or Supabase) — used to fetch conversations
}

export interface AdBanner {
  id: string;
  title: string;
  subtitle: string;
  bgColor: string;
  textColor: string;
  imageUri?: string;
  linkUrl?: string;
}

export type BookingStatus =
  | "pending"
  | "accepted"
  | "declined"
  /** Provider sent Work Completed token. Awaiting customer action. */
  | "provider_completed"
  /** Customer confirmed completion. Earnings recorded. */
  | "customer_confirmed_completed"
  /** Customer reported an issue. No earnings. */
  | "disputed";

export interface BookingRequest {
  id: string;
  conversationId: string;
  customerId: string;
  customerName: string;
  customerInitials: string;
  customerAvatarColor: string;
  customerAvatarUrl?: string | null;
  service: string;
  date: string;
  time: string;
  amount: string;
  status: BookingStatus;
  createdAt: string;
  note?: string;
}

export interface ProviderStats {
  pendingCount: number;
  acceptedCount: number;
  completedCount: number;
  weeklyEarnings: string;
  rating: number;
  reviewCount: number;
}

export interface EarningEntry {
  id: string;
  customerName: string;
  customerInitials: string;
  customerAvatarColor: string;
  customerAvatarUrl?: string | null;
  service: string;
  date: string;
  completedAt: string;
  amount: number;
}

export interface EarningBar {
  label: string;
  amount: number;
  jobCount: number;
}
