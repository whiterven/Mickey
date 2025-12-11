
import { Message, ChatSession, ChatMode } from '../types';

const KEYS = {
  SESSIONS: 'mikey_sessions',
  MESSAGES_PREFIX: 'mikey_messages_',
};

// --- API ---

export const getChatSessions = async (): Promise<ChatSession[]> => {
  try {
    const raw = localStorage.getItem(KEYS.SESSIONS);
    if (!raw) return [];
    // Sort desc by timestamp
    const sessions = (JSON.parse(raw) as ChatSession[]).sort((a, b) => b.timestamp - a.timestamp);
    return sessions;
  } catch (e) {
    console.error("Failed to load sessions", e);
    return [];
  }
};

export const loadChatMessages = async (sessionId: string): Promise<Message[]> => {
  try {
    const key = `${KEYS.MESSAGES_PREFIX}${sessionId}`;
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : [];
  } catch (e) {
    console.error("Failed to load messages", e);
    return [];
  }
};

export const deleteChat = async (sessionId: string) => {
  try {
    // 1. Remove from sessions list
    const sessions = await getChatSessions();
    const updatedSessions = sessions.filter(s => s.id !== sessionId);
    localStorage.setItem(KEYS.SESSIONS, JSON.stringify(updatedSessions));

    // 2. Remove messages
    localStorage.removeItem(`${KEYS.MESSAGES_PREFIX}${sessionId}`);
  } catch (e) {
    console.error("Failed to delete chat", e);
  }
};

export const clearAllData = async () => {
  try {
    localStorage.removeItem(KEYS.SESSIONS);
    
    // Find all message keys
    const keysToRemove: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith(KEYS.MESSAGES_PREFIX)) {
            keysToRemove.push(key);
        }
    }
    keysToRemove.forEach(k => localStorage.removeItem(k));
  } catch (e) {
    console.error("Failed to clear data", e);
  }
};

// --- Save Logic (Debounced) ---

const saveTimers: Record<string, ReturnType<typeof setTimeout>> = {};

const performSave = (sessionId: string, messages: Message[], mode: ChatMode) => {
  if (!sessionId) return;

  try {
    // 1. Get existing sessions
    const rawSessions = localStorage.getItem(KEYS.SESSIONS);
    let sessions: ChatSession[] = rawSessions ? JSON.parse(rawSessions) : [];

    // 2. Calculate Title
    let title = "New Chat";
    const firstUserMsg = messages.find(m => m.role === 'user');
    if (firstUserMsg) {
        let text = firstUserMsg.text.trim().replace(/[#*`_~]/g, '');
        if (text.length > 0) {
            title = text.substring(0, 50) + (text.length > 50 ? '...' : '');
        } else if (firstUserMsg.attachment) {
            title = firstUserMsg.attachment.type === 'image' ? "Image Analysis" : "Video Analysis";
        }
    } else if (messages.length > 0) {
        const lastMsg = messages[messages.length - 1];
        if (lastMsg.image) title = "Generated Image";
        else if (lastMsg.video) title = "Generated Video";
    }

    // 3. Update Session Data
    const existingIndex = sessions.findIndex(s => s.id === sessionId);
    const sessionData: ChatSession = {
        id: sessionId,
        title,
        timestamp: Date.now(),
        mode
    };

    if (existingIndex >= 0) {
        sessions[existingIndex] = sessionData;
    } else {
        sessions.push(sessionData);
    }

    // 4. Save to LocalStorage
    localStorage.setItem(KEYS.SESSIONS, JSON.stringify(sessions));
    localStorage.setItem(`${KEYS.MESSAGES_PREFIX}${sessionId}`, JSON.stringify(messages));

  } catch (e) {
    console.error("Failed to save chat", e);
    // Simple quota handling
    if (e instanceof DOMException && (e.name === 'QuotaExceededError' || e.name === 'NS_ERROR_DOM_QUOTA_REACHED')) {
        console.warn("LocalStorage quota reached. Consider clearing old chats.");
    }
  }
};

export const saveChat = (sessionId: string, messages: Message[], mode: ChatMode) => {
  if (messages.length === 0) return;

  if (saveTimers[sessionId]) {
    clearTimeout(saveTimers[sessionId]);
  }

  saveTimers[sessionId] = setTimeout(() => {
    performSave(sessionId, messages, mode);
    delete saveTimers[sessionId];
  }, 1000);
};

export const saveChatImmediately = async (sessionId: string, messages: Message[], mode: ChatMode) => {
  if (messages.length === 0) return;
  if (saveTimers[sessionId]) {
    clearTimeout(saveTimers[sessionId]);
    delete saveTimers[sessionId];
  }
  performSave(sessionId, messages, mode);
};

// --- Storage Stats ---

export const getStorageUsage = async (): Promise<{ usageBytes: number, itemCount: number }> => {
    try {
        let size = 0;
        let count = 0;
        
        for (const key in localStorage) {
            if (localStorage.hasOwnProperty(key)) {
                // Count our keys
                if (key === KEYS.SESSIONS || key.startsWith(KEYS.MESSAGES_PREFIX)) {
                    const value = localStorage.getItem(key);
                    if (value) {
                        size += value.length * 2; // Approx UTF-16 size
                        count++;
                    }
                }
            }
        }
        return { usageBytes: size, itemCount: count };
    } catch (e) {
        return { usageBytes: 0, itemCount: 0 };
    }
};
