

export enum ScreenName {
  HOME = 'HOME',
  VOICE = 'VOICE',
  CHAT = 'CHAT',
  PROFILE = 'PROFILE',
}

export enum MessageRole {
  USER = 'user',
  MODEL = 'model',
}

export interface Message {
  id: string;
  role: MessageRole;
  text: string;
  image?: string; // Base64 or URL (Model output)
  video?: string; // URL (Model output)
  attachment?: { // User input attachment
    type: 'image' | 'video';
    url?: string; // Blob URL for temporary display
    data?: string; // Base64 for persistence
    mimeType: string;
  };
  timestamp: number;
  isThinking?: boolean;
}

export interface UserState {
  hasApiKey: boolean;
}

export enum ChatMode {
  DEFAULT = 'default', // Text Chat
  IMAGE_GEN = 'image_gen', // Gemini 3 Pro / 2.5 Flash Image
  VIDEO_GEN = 'video_gen', // Veo
}

export interface ChatSession {
  id: string;
  title: string; // Preview of the conversation
  timestamp: number; // Last updated
  mode: ChatMode;
}

// Colors from design system
export const COLORS = {
  primaryBlue: '#abd5ff',
  primaryPink: '#eec7f4',
  lightBlue: '#e4f5ff',
  surfaceWhite: '#ffffff',
  deepBlack: '#000000',
  appBackground: '#f8f9fa',
};

export const SUPPORTED_LANGUAGES = [
  "English",
  "Spanish",
  "French",
  "German",
  "Italian",
  "Portuguese",
  "Chinese",
  "Japanese",
  "Korean",
  "Russian",
  "Hindi",
  "Arabic"
];

export const SUPPORTED_VOICES = [
  { id: 'Puck', label: 'Billy', description: 'Soft & Gentle' },
  { id: 'Charon', label: 'Marcus', description: 'Deep & Authoritative' },
  { id: 'Kore', label: 'Sarah', description: 'Calm & Soothing' },
  { id: 'Fenrir', label: 'Leo', description: 'Energetic & Fast' },
  { id: 'Zephyr', label: 'Emily', description: 'Warm & Friendly' },
];

export type GeminiModelId = 'gemini-flash-lite-latest' | 'gemini-flash-latest' | 'gemini-3-pro-preview';

export const MODEL_OPTIONS: {id: GeminiModelId, label: string}[] = [
    { id: 'gemini-flash-lite-latest', label: 'Gemini 2.5 Flash Lite' },
    { id: 'gemini-flash-latest', label: 'Gemini 2.5 Flash' },
    { id: 'gemini-3-pro-preview', label: 'Gemini 3.0 Preview' },
];

export type GeminiImageModelId = 'gemini-2.5-flash-image' | 'gemini-3-pro-image-preview';
export type ImageResolution = '1K' | '2K' | '4K';

export const IMAGE_MODEL_OPTIONS: {id: GeminiImageModelId, label: string}[] = [
    { id: 'gemini-2.5-flash-image', label: 'Gemini 2.5 Flash Image' },
    { id: 'gemini-3-pro-image-preview', label: 'Gemini 3.0 Pro Image' },
];
