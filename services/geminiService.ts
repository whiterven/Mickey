
import { GoogleGenAI, LiveServerMessage, Modality } from '@google/genai';
import { Message, ChatMode, MessageRole, ImageResolution } from '../types';
import { createPcmBlob, base64ToUint8Array, decodeAudioData } from './audioUtils';

// Helper to initialize GenAI with the latest API key
const getAiClient = () => {
  const apiKey = process.env.API_KEY;
  if (!apiKey) {
    console.warn("API Key is missing or empty.");
  }
  return new GoogleGenAI({ apiKey: apiKey || '' });
};

// --- Audio Transcription (STT) ---
export const transcribeAudio = async (audioBase64: string): Promise<string> => {
    const ai = getAiClient();
    try {
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: {
                parts: [
                    { inlineData: { mimeType: 'audio/wav', data: audioBase64 } },
                    { text: "Transcribe the audio exactly as spoken." }
                ]
            }
        });
        return response.text || "";
    } catch (error) {
        console.error("Transcription error:", error);
        throw error;
    }
};

// --- Text to Speech (TTS) ---
export const generateSpeech = async (text: string): Promise<string> => {
    const ai = getAiClient();
    try {
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash-preview-tts',
            contents: {
                parts: [{ text: text }]
            },
            config: {
                responseModalities: [Modality.AUDIO],
                speechConfig: {
                    voiceConfig: {
                        prebuiltVoiceConfig: { voiceName: 'Kore' }
                    }
                }
            }
        });
        
        const audioData = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
        if (!audioData) throw new Error("No audio data generated");
        return audioData;
    } catch (error) {
        console.error("TTS error:", error);
        throw error;
    }
};

interface Attachment {
    base64: string;
    mimeType: string;
}

// --- Chat Service ---
export const sendMessageToGemini = async (
  history: Message[],
  newMessage: string,
  mode: ChatMode,
  language: string,
  modelId: string,
  onStreamUpdate?: (text: string) => void,
  attachment?: Attachment,
  imageResolution?: ImageResolution
): Promise<Message> => {
  const ai = getAiClient();
  
  // 1. Image Generation Mode
  if (mode === ChatMode.IMAGE_GEN) {
    const isPro = modelId === 'gemini-3-pro-image-preview';
    
    // Config setup
    const config: any = {
      imageConfig: {
        aspectRatio: '1:1',
      },
    };

    // Only Pro model supports explicit imageSize
    if (isPro && imageResolution) {
        config.imageConfig.imageSize = imageResolution;
    }

    // Build contents
    const parts: any[] = [];
    
    // If we have an attachment, add it first (Image Editing / Variation)
    // Both 2.5 Flash Image and 3 Pro Image support image input + text prompt
    if (attachment) {
        parts.push({
            inlineData: {
                data: attachment.base64,
                mimeType: attachment.mimeType
            }
        });
    }

    // Add text prompt
    parts.push({ text: newMessage });

    try {
        const response = await ai.models.generateContent({
            model: modelId, // Uses passed modelId (2.5 Flash Image or 3 Pro Image)
            contents: { parts },
            config
        });
        
        let imageUrl = '';
        let text = '';

        for (const part of response.candidates?.[0]?.content?.parts || []) {
            if (part.inlineData) {
                imageUrl = `data:image/png;base64,${part.inlineData.data}`;
            } else if (part.text) {
                text += part.text;
            }
        }
        
        return {
            id: crypto.randomUUID(),
            role: MessageRole.MODEL,
            text: text || "Here is your generated image.",
            image: imageUrl,
            timestamp: Date.now(),
        };

    } catch (e) {
        console.error(e);
        return {
            id: crypto.randomUUID(),
            role: MessageRole.MODEL,
            text: "Sorry, I encountered an error generating the image.",
            timestamp: Date.now(),
        };
    }
  } 
  
  // 2. Video Generation Mode (Veo)
  else if (mode === ChatMode.VIDEO_GEN) {
      try {
        // Prepare request parameters
        let requestParams: any = {
            model: 'veo-3.1-fast-generate-preview',
            config: {
                numberOfVideos: 1,
                resolution: '720p',
                aspectRatio: '16:9' // Default to landscape
            }
        };

        // If attachment is present (Image-to-Video)
        if (attachment && attachment.mimeType.startsWith('image/')) {
             requestParams.prompt = newMessage || "Animate this image"; // Prompt is required/recommended
             requestParams.image = {
                 imageBytes: attachment.base64,
                 mimeType: attachment.mimeType
             };
        } else {
            // Text-to-Video
            requestParams.prompt = newMessage;
        }

        let operation = await ai.models.generateVideos(requestParams);
        
        // Poll for completion
        while (!operation.done) {
            await new Promise(resolve => setTimeout(resolve, 5000));
            operation = await ai.operations.getVideosOperation({operation});
        }

        const videoUri = operation.response?.generatedVideos?.[0]?.video?.uri;
        if (videoUri) {
             const videoRes = await fetch(`${videoUri}&key=${process.env.API_KEY}`);
             const videoBlob = await videoRes.blob();
             const videoUrl = URL.createObjectURL(videoBlob);
             
             return {
                id: crypto.randomUUID(),
                role: MessageRole.MODEL,
                text: "Here is your video.",
                video: videoUrl,
                timestamp: Date.now(),
             }
        }
        throw new Error("No video URI returned");

      } catch (e) {
          console.error(e);
          return {
              id: crypto.randomUUID(),
              role: MessageRole.MODEL,
              text: "Sorry, I encountered an error generating the video.",
              timestamp: Date.now(),
          };
      }
  }

  // 3. Standard Text/Thinking Chat + Video Understanding
  const config: any = {
    // Only apply thinking budget if we are using the model that supports it (Gemini 3 Pro / 2.5)
    // For simplicity in this demo, we apply it if the model name suggests it or just standard generic config
    thinkingConfig: modelId.includes('gemini-3-pro') ? { thinkingBudget: 1024 } : undefined,
    systemInstruction: `You are Mike, a friendly, helpful, and intelligent AI assistant. You always refer to yourself as Mike. Your tone is warm and engaging. Please respond in ${language}.`,
  };

  const parts: any[] = [{ text: newMessage }];
  
  // Handle input attachment (Image or Video for understanding)
  if (attachment) {
      parts.push({
          inlineData: {
              mimeType: attachment.mimeType,
              data: attachment.base64
          }
      });
  }

  const chat = ai.chats.create({
    model: modelId, // Dynamic model selection
    config: config,
    history: history.filter(m => !m.image && !m.video).map(m => ({
      role: m.role,
      parts: [{ text: m.text }], 
    })),
  });

  const resultStream = await chat.sendMessageStream({ 
      message: parts 
  });
  
  let fullText = '';
  for await (const chunk of resultStream) {
      const text = chunk.text;
      if (text) {
          fullText += text;
          if (onStreamUpdate) {
              onStreamUpdate(fullText);
          }
      }
  }
  
  return {
    id: crypto.randomUUID(),
    role: MessageRole.MODEL,
    text: fullText,
    timestamp: Date.now(),
  };
};


// --- Live Service (Voice Mode) ---
export class LiveClient {
  private session: any = null;
  private inputAudioContext: AudioContext | null = null;
  private outputAudioContext: AudioContext | null = null;
  private nextStartTime = 0;
  private sources = new Set<AudioBufferSourceNode>();
  public isMuted = false;
  
  constructor(
    private onTranscript: (text: string, isUser: boolean, isFinal: boolean) => void,
    private onAudioActivity: (isActive: boolean) => void,
    private onVolumeUpdate: (volume: number) => void
  ) {}

  async connect(language: string = "English", voiceName: string = "Kore") {
    const ai = getAiClient();
    this.inputAudioContext = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 16000 });
    this.outputAudioContext = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
    
    // Setup Microphone Stream
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    const source = this.inputAudioContext.createMediaStreamSource(stream);
    const processor = this.inputAudioContext.createScriptProcessor(4096, 1, 1);
    
    processor.onaudioprocess = (e) => {
        // If muted, do not process or send audio
        if (this.isMuted) {
            this.onVolumeUpdate(0);
            return;
        }

        const inputData = e.inputBuffer.getChannelData(0);
        
        // Calculate Volume (RMS)
        let sum = 0;
        for (let i = 0; i < inputData.length; i++) {
            sum += inputData[i] * inputData[i];
        }
        const rms = Math.sqrt(sum / inputData.length);
        this.onVolumeUpdate(rms); // Emit volume

        const pcmBlob = createPcmBlob(inputData);
        if (this.session) {
            this.session.then((s: any) => s.sendRealtimeInput({ media: pcmBlob }));
        }
    };
    
    source.connect(processor);
    processor.connect(this.inputAudioContext.destination);

    // Connect to Live API
    this.session = ai.live.connect({
      model: 'gemini-2.5-flash-native-audio-preview-09-2025',
      callbacks: {
        onopen: () => {
          console.log("Live session connected");
          this.onAudioActivity(true);
        },
        onmessage: async (msg: LiveServerMessage) => {
            // Calculate current playback latency to sync text
            const currentTime = this.outputAudioContext?.currentTime || 0;
            const latency = Math.max(0, this.nextStartTime - currentTime);

            // Handle Transcriptions
             if (msg.serverContent?.outputTranscription) {
                const text = msg.serverContent.outputTranscription.text;
                // Schedule text update to match audio playback
                setTimeout(() => {
                    this.onTranscript(text, false, false);
                }, latency * 1000);
            } else if (msg.serverContent?.inputTranscription) {
                const text = msg.serverContent.inputTranscription.text;
                // Input transcription is immediate
                this.onTranscript(text, true, false);
            }
            
            // Handle Audio Output
            const audioData = msg.serverContent?.modelTurn?.parts?.[0]?.inlineData?.data;
            if (audioData && this.outputAudioContext) {
                const audioBuffer = await decodeAudioData(
                    base64ToUint8Array(audioData),
                    this.outputAudioContext
                );
                
                this.playAudio(audioBuffer);
            }
        },
        onclose: () => {
            console.log("Live session closed");
            this.onAudioActivity(false);
        },
        onerror: (err) => {
            console.error("Live session error", err);
            this.onAudioActivity(false);
        }
      },
      config: {
        responseModalities: [Modality.AUDIO],
        speechConfig: {
          voiceConfig: { prebuiltVoiceConfig: { voiceName: voiceName } },
        },
        inputAudioTranscription: {},
        outputAudioTranscription: {},
        systemInstruction: `You are Mike, a friendly, helpful, and intelligent AI assistant. You always refer to yourself as Mike. Keep responses concise and conversational. Please speak in ${language}.`
      }
    });
  }

  setMute(muted: boolean) {
      this.isMuted = muted;
  }

  private playAudio(buffer: AudioBuffer) {
    if (!this.outputAudioContext) return;

    // Basic scheduling
    this.nextStartTime = Math.max(this.outputAudioContext.currentTime, this.nextStartTime);
    
    const source = this.outputAudioContext.createBufferSource();
    source.buffer = buffer;
    source.connect(this.outputAudioContext.destination);
    source.start(this.nextStartTime);
    
    this.nextStartTime += buffer.duration;
    this.sources.add(source);
    
    source.onended = () => {
        this.sources.delete(source);
    };
  }

  disconnect() {
    this.sources.forEach(s => s.stop());
    this.inputAudioContext?.close();
    this.outputAudioContext?.close();
    if (this.session) {
        this.session.then((s: any) => s.close());
    }
  }
}
