import AsyncStorage from "@react-native-async-storage/async-storage";
import type { User, ChatMessage, Conversation, Provider } from "./types";

const KEYS = {
  USER: "skilladd_user",
  CHATS: "skilladd_chats_",
  CONVERSATIONS: "skilladd_conversations",
  LOCAL_PROVIDERS: "skilladd_local_providers",
};

export async function saveUser(user: User): Promise<void> {
  await AsyncStorage.setItem(KEYS.USER, JSON.stringify(user));
}

export async function getUser(): Promise<User | null> {
  try {
    const raw = await AsyncStorage.getItem(KEYS.USER);
    return raw ? (JSON.parse(raw) as User) : null;
  } catch {
    return null;
  }
}

export async function clearUser(): Promise<void> {
  await AsyncStorage.removeItem(KEYS.USER);
}

// Clears all user-specific local data on sign-out.
// Called instead of clearUser() so that a new user logging in on the
// same device doesn't inherit stale conversation caches from the previous user.
export async function clearAllLocalData(): Promise<void> {
  await AsyncStorage.multiRemove([
    KEYS.USER,
    KEYS.CONVERSATIONS,
    KEYS.LOCAL_PROVIDERS,
  ]);
}

export async function getChatMessages(conversationId: string): Promise<ChatMessage[]> {
  try {
    const raw = await AsyncStorage.getItem(KEYS.CHATS + conversationId);
    return raw ? (JSON.parse(raw) as ChatMessage[]) : [];
  } catch {
    return [];
  }
}

export async function saveChatMessages(conversationId: string, messages: ChatMessage[]): Promise<void> {
  await AsyncStorage.setItem(KEYS.CHATS + conversationId, JSON.stringify(messages));
}

export async function addChatMessage(conversationId: string, message: ChatMessage): Promise<ChatMessage[]> {
  const existing = await getChatMessages(conversationId);
  const updated = [message, ...existing];
  await saveChatMessages(conversationId, updated);
  return updated;
}

export async function getConversations(): Promise<Conversation[]> {
  try {
    const raw = await AsyncStorage.getItem(KEYS.CONVERSATIONS);
    return raw ? (JSON.parse(raw) as Conversation[]) : [];
  } catch {
    return [];
  }
}

export async function saveConversations(conversations: Conversation[]): Promise<void> {
  await AsyncStorage.setItem(KEYS.CONVERSATIONS, JSON.stringify(conversations));
}

export function generateId(): string {
  return Date.now().toString() + Math.random().toString(36).substring(2, 9);
}

// ─── Local Provider Store ─────────────────────────────────────────────────────

export async function getLocalProviders(): Promise<Provider[]> {
  try {
    const raw = await AsyncStorage.getItem(KEYS.LOCAL_PROVIDERS);
    return raw ? (JSON.parse(raw) as Provider[]) : [];
  } catch {
    return [];
  }
}

export async function saveLocalProvider(provider: Provider): Promise<void> {
  const existing = await getLocalProviders();
  const updated = [provider, ...existing.filter((p) => p.id !== provider.id)];
  await AsyncStorage.setItem(KEYS.LOCAL_PROVIDERS, JSON.stringify(updated));
}

export async function clearLocalProviders(): Promise<void> {
  await AsyncStorage.removeItem(KEYS.LOCAL_PROVIDERS);
}

// ─── Hidden Conversations ─────────────────────────────────────────────────────

const HIDDEN_CONVS_KEY = "skilladd_hidden_convs";

export async function getHiddenConversationIds(): Promise<Set<string>> {
  try {
    const raw = await AsyncStorage.getItem(HIDDEN_CONVS_KEY);
    const arr: string[] = raw ? (JSON.parse(raw) as string[]) : [];
    return new Set(arr);
  } catch {
    return new Set();
  }
}

export async function hideConversation(conversationId: string): Promise<void> {
  const existing = await getHiddenConversationIds();
  existing.add(conversationId);
  await AsyncStorage.setItem(HIDDEN_CONVS_KEY, JSON.stringify([...existing]));
}

export async function unhideConversation(conversationId: string): Promise<void> {
  const existing = await getHiddenConversationIds();
  existing.delete(conversationId);
  await AsyncStorage.setItem(HIDDEN_CONVS_KEY, JSON.stringify([...existing]));
}
