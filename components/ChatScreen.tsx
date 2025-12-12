
import React, { useState, useRef, useEffect, useContext, createContext } from 'react';
import { ArrowLeft, ArrowUp, Image as ImageIcon, Video, Mic, Copy, Check, Square, Volume2, Loader2, Paperclip, X, Download, SquarePen, Maximize2, ZoomIn, ZoomOut, Play, Share2, StopCircle, ChevronDown, ChevronUp, AudioLines } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { oneDark } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { motion, AnimatePresence } from 'framer-motion';
import { Message, ChatMode, MessageRole, COLORS, GeminiModelId, MODEL_OPTIONS, GeminiImageModelId, IMAGE_MODEL_OPTIONS, ImageResolution } from '../types';
import { sendMessageToGemini, generateSpeech } from '../services/geminiService';
import { loadChatMessages, saveChat, saveChatImmediately } from '../services/storageService';
import Layout from './Layout';
import { base64ToUint8Array, decodeAudioData } from '../services/audioUtils';

interface ChatScreenProps {
  onBack: () => void;
  onNewChat: () => void;
  onOpenVoiceMode: () => void;
  sessionId: string;
  initialMode?: ChatMode;
  initialPrompt?: string;
  language: string;
}

// --- Vercel-style Code Block Implementation ---

type CodeBlockContextType = {
  code: string;
};

const CodeBlockContext = createContext<CodeBlockContextType>({
  code: '',
});

const CodeBlockCopyButton = () => {
  const [isCopied, setIsCopied] = useState(false);
  const { code } = useContext(CodeBlockContext);

  const copyToClipboard = async () => {
    if (!navigator.clipboard.writeText) return;
    try {
      await navigator.clipboard.writeText(code);
      setIsCopied(true);
      setTimeout(() => setIsCopied(false), 2000);
    } catch (error) {
      console.error('Failed to copy text: ', error);
    }
  };

  return (
    <button
      onClick={copyToClipboard}
      className="flex items-center justify-center h-8 w-8 rounded-md transition-colors hover:bg-white/10 text-gray-400 hover:text-white"
      title="Copy code"
    >
      {isCopied ? <Check size={14} className="text-green-400" /> : <Copy size={14} />}
    </button>
  );
};

interface CodeBlockProps {
  code: string;
  language: string;
  className?: string;
}

const CodeBlock: React.FC<CodeBlockProps> = ({ code, language, className }) => {
  return (
    <CodeBlockContext.Provider value={{ code }}>
      <div className={`relative w-full overflow-hidden rounded-xl border border-white/10 bg-[#1e1e1e] text-white my-4 shadow-sm ${className}`}>
        {/* Header / Actions */}
        <div className="absolute top-3 right-3 z-10 flex items-center gap-2">
            <span className="text-[10px] uppercase font-mono text-gray-500 select-none bg-black/20 px-1.5 py-0.5 rounded">{language}</span>
            <CodeBlockCopyButton />
        </div>

        <SyntaxHighlighter
          language={language}
          style={oneDark}
          customStyle={{
            margin: 0,
            padding: '1.5rem',
            fontSize: '0.875rem',
            background: '#1e1e1e', // Matches container background
            fontFamily: 'monospace',
          }}
          codeTagProps={{
            className: 'font-mono text-sm',
          }}
          lineNumberStyle={{
            color: '#6e6e6e',
            paddingRight: '1rem',
            minWidth: '2rem',
            textAlign: 'right',
            userSelect: 'none',
          }}
          showLineNumbers={true}
        >
          {code}
        </SyntaxHighlighter>
      </div>
    </CodeBlockContext.Provider>
  );
};

// --- End Code Block Implementation ---

interface AttachmentData {
    file?: File;
    previewUrl: string;
    base64: string;
    type: 'image' | 'video';
    mimeType?: string;
}

const ChatScreen: React.FC<ChatScreenProps> = ({ onBack, onNewChat, onOpenVoiceMode, sessionId, initialMode = ChatMode.DEFAULT, initialPrompt, language }) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const messagesRef = useRef<Message[]>([]);
  const [inputText, setInputText] = useState(initialPrompt || '');
  const [isLoading, setIsLoading] = useState(false);
  const [mode, setMode] = useState<ChatMode>(initialMode);
  
  // Model Selection State
  const [selectedModel, setSelectedModel] = useState<GeminiModelId>('gemini-flash-latest');
  const [selectedImageModel, setSelectedImageModel] = useState<GeminiImageModelId>('gemini-2.5-flash-image');
  const [imageResolution, setImageResolution] = useState<ImageResolution>('1K');

  const [isModelDropdownOpen, setIsModelDropdownOpen] = useState(false);
  const [isResDropdownOpen, setIsResDropdownOpen] = useState(false);
  
  // Keep ref updated
  useEffect(() => {
      messagesRef.current = messages;
  }, [messages]);
  
  // Attachment State
  const [attachment, setAttachment] = useState<AttachmentData | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Preview Modal State
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [previewMedia, setPreviewMedia] = useState<{url: string, type: 'image' | 'video'} | null>(null);
  const [isZoomed, setIsZoomed] = useState(false);
  
  // Textarea Ref for auto-resize
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  
  // TTS State
  const [playingMessageId, setPlayingMessageId] = useState<string | null>(null);
  const audioSourceRef = useRef<AudioBufferSourceNode | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);

  // Copy State
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Initialize: Load messages OR handle initial prompt
  useEffect(() => {
    const init = async () => {
        const savedMessages = await loadChatMessages(sessionId);
        setMessages(savedMessages);

        if (savedMessages.length === 0) {
            // New session
            if (initialPrompt) {
                setInputText(""); 
                handleSend(initialPrompt);
            } else {
                setInputText("");
            }
        } else {
            setInputText("");
        }
    };
    init();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId]); 
  
  // Persistence
  useEffect(() => {
    if (messages.length > 0) {
        saveChat(sessionId, messages, mode);
    }
  }, [messages, sessionId, mode]);

  // Cleanup
  useEffect(() => {
    return () => {
        if (audioSourceRef.current) {
            try { audioSourceRef.current.stop(); } catch(e) {}
        }
        if (audioContextRef.current) {
            audioContextRef.current.close();
        }
        if (messagesRef.current.length > 0) {
            saveChatImmediately(sessionId, messagesRef.current, mode);
        }
    };
  }, [sessionId, mode]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
        textareaRef.current.style.height = 'auto';
        textareaRef.current.style.height = Math.min(textareaRef.current.scrollHeight, 180) + 'px';
    }
  }, [inputText]);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
      if (e.target.files && e.target.files[0]) {
          const file = e.target.files[0];
          const isImage = file.type.startsWith('image/');
          const isVideo = file.type.startsWith('video/');

          if (!isImage && !isVideo) return;

          const reader = new FileReader();
          reader.onload = () => {
              setAttachment({
                  file,
                  previewUrl: URL.createObjectURL(file),
                  base64: (reader.result as string).split(',')[1],
                  type: isImage ? 'image' : 'video',
                  mimeType: file.type
              });
          };
          reader.readAsDataURL(file);
      }
  };

  const clearAttachment = () => {
      if (attachment) {
          URL.revokeObjectURL(attachment.previewUrl);
          setAttachment(null);
      }
      if (fileInputRef.current) {
          fileInputRef.current.value = '';
      }
  };

  const downloadMedia = (url: string, filename: string) => {
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const handleSend = async (manualText?: string) => {
    const textToSend = manualText ?? inputText;
    
    if ((!textToSend.trim() && !attachment) && !manualText) return;
    
    const currentAttachment = attachment; 
    
    if (!manualText) {
        setInputText('');
    }
    setAttachment(null); 
    if (fileInputRef.current) fileInputRef.current.value = '';

    const userMsg: Message = {
      id: crypto.randomUUID(),
      role: MessageRole.USER,
      text: textToSend,
      timestamp: Date.now(),
      attachment: currentAttachment ? {
          type: currentAttachment.type,
          url: currentAttachment.previewUrl,
          data: currentAttachment.base64,
          mimeType: currentAttachment.mimeType || 'image/jpeg'
      } : undefined
    };

    setMessages(prev => [...prev, userMsg]);
    setIsLoading(true);

    const streamMsgId = crypto.randomUUID();
    let isStreaming = false;

    // Determine effective model ID based on mode
    let effectiveModelId = '';
    if (mode === ChatMode.IMAGE_GEN) {
        effectiveModelId = selectedImageModel;
    } else {
        effectiveModelId = selectedModel;
    }

    try {
      const finalResponse = await sendMessageToGemini(
          messages, 
          textToSend, 
          mode, 
          language, 
          effectiveModelId, 
          (streamText) => {
              if (!isStreaming) {
                  isStreaming = true;
                  setIsLoading(false);
                  setMessages(prev => [...prev, {
                      id: streamMsgId,
                      role: MessageRole.MODEL,
                      text: streamText,
                      timestamp: Date.now()
                  }]);
              } else {
                  setMessages(prev => prev.map(msg => 
                      msg.id === streamMsgId ? { ...msg, text: streamText } : msg
                  ));
              }
          },
          currentAttachment ? { base64: currentAttachment.base64, mimeType: currentAttachment.mimeType || 'image/jpeg' } : undefined,
          imageResolution 
      );

      if (!isStreaming) {
          setMessages(prev => [...prev, finalResponse]);
      } else {
          setMessages(prev => prev.map(msg => 
              msg.id === streamMsgId ? { ...msg, text: finalResponse.text } : msg
          ));
      }
    } catch (error) {
      console.error("Chat error:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleTTS = async (text: string, id: string) => {
      if (playingMessageId === id) {
          if (audioSourceRef.current) {
              try { audioSourceRef.current.stop(); } catch(e) {}
              audioSourceRef.current = null;
          }
          setPlayingMessageId(null);
          return;
      }
      
      if (audioSourceRef.current) {
          try { audioSourceRef.current.stop(); } catch(e) {}
          audioSourceRef.current = null;
      }

      try {
          setPlayingMessageId(id);
          const base64Audio = await generateSpeech(text);
          const audioBytes = base64ToUint8Array(base64Audio);
          const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
          audioContextRef.current = audioCtx;
          const audioBuffer = await decodeAudioData(audioBytes, audioCtx, 24000, 1);
          
          const source = audioCtx.createBufferSource();
          source.buffer = audioBuffer;
          source.connect(audioCtx.destination);
          
          audioSourceRef.current = source;
          
          source.onended = () => {
              if (playingMessageId === id) {
                  setPlayingMessageId(null);
              }
              audioCtx.close();
              audioSourceRef.current = null;
          };
          
          source.start(0);
      } catch (e) {
          console.error("TTS play failed", e);
          setPlayingMessageId(null);
      }
  };

  const handleCopy = async (text: string, id: string) => {
      try {
          await navigator.clipboard.writeText(text);
          setCopiedId(id);
          setTimeout(() => setCopiedId(null), 2000);
      } catch (err) {
          console.error("Failed to copy", err);
      }
  };

  const handleShare = async (text: string) => {
      if (navigator.share) {
          try {
              await navigator.share({ text });
          } catch (err: any) {
              if (err.name !== 'AbortError') {
                  console.error("Share failed", err);
              }
          }
      }
  };

  const getHeaderTitle = () => {
      switch(mode) {
          case ChatMode.IMAGE_GEN: return "Image Generator";
          case ChatMode.VIDEO_GEN: return "Video Studio";
          default: return "Assistant";
      }
  };

  const activePreview = previewMedia ? previewMedia : (attachment ? { url: attachment.previewUrl, type: attachment.type } : null);

  const getModelLabel = () => {
      if (mode === ChatMode.IMAGE_GEN) {
          return IMAGE_MODEL_OPTIONS.find(m => m.id === selectedImageModel)?.label || selectedImageModel;
      }
      return MODEL_OPTIONS.find(m => m.id === selectedModel)?.label || selectedModel;
  };

  const hasContent = inputText.trim().length > 0 || attachment !== null;

  return (
    <Layout className="flex flex-col h-[100dvh] bg-appBackground">
      {/* Header - Fixed Height */}
      <div className="flex-shrink-0 flex items-center justify-between px-6 pt-4 pb-4 bg-appBackground z-10 pt-safe mt-2">
        <button onClick={onBack} className="p-2 rounded-full hover:bg-gray-200 transition">
          <ArrowLeft size={24} color={COLORS.deepBlack} />
        </button>
        <h1 className="text-xl font-bold tracking-tight">{getHeaderTitle()}</h1>
        <button 
            onClick={onNewChat} 
            className="p-2 rounded-full border border-gray-200 bg-surfaceWhite hover:bg-gray-50 transition-colors shadow-sm active:scale-95"
            title="New Chat"
        >
          <SquarePen size={20} color={COLORS.deepBlack} />
        </button>
      </div>

      {/* Mode Switcher - Fixed Height */}
      <div className="flex-shrink-0 px-6 pb-2 flex gap-2 overflow-x-auto no-scrollbar">
           <button 
             onClick={() => setMode(ChatMode.DEFAULT)} 
             className={`px-3 py-1 rounded-full text-xs font-bold flex-shrink-0 ${mode === ChatMode.DEFAULT ? 'bg-deepBlack text-surfaceWhite' : 'bg-surfaceWhite text-deepBlack'}`}
           >
             Chat
           </button>
           <button 
             onClick={() => setMode(ChatMode.IMAGE_GEN)} 
             className={`px-3 py-1 rounded-full text-xs font-bold flex-shrink-0 ${mode === ChatMode.IMAGE_GEN ? 'bg-deepBlack text-surfaceWhite' : 'bg-surfaceWhite text-deepBlack'}`}
           >
             Image
           </button>
           <button 
             onClick={() => setMode(ChatMode.VIDEO_GEN)} 
             className={`px-3 py-1 rounded-full text-xs font-bold flex-shrink-0 ${mode === ChatMode.VIDEO_GEN ? 'bg-deepBlack text-surfaceWhite' : 'bg-surfaceWhite text-deepBlack'}`}
           >
             Veo
           </button>
      </div>

      {/* Messages - Flexible Area */}
      <div className="flex-1 overflow-y-auto px-6 pt-4 pb-4 space-y-6 w-full max-w-2xl mx-auto min-h-0">
        {messages.map((msg) => (
          <motion.div
            key={msg.id}
            initial={{ opacity: 0, y: 10, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ duration: 0.3, ease: "easeOut" }}
            className={`flex flex-col ${msg.role === MessageRole.USER ? 'items-end' : 'items-start'}`}
          >
            {/* Header for Bot */}
            {msg.role === MessageRole.MODEL && (
                <div className="flex items-center gap-2 mb-1 pl-1">
                    <span className="text-xs font-bold text-gray-500">Mike</span>
                </div>
            )}
            
            <div
              className={`
                relative max-w-[90%] px-5 py-3 text-[15px] leading-relaxed shadow-sm w-fit flex flex-col gap-2
                ${msg.role === MessageRole.USER
                  ? 'bg-primaryBlue text-deepBlack rounded-3xl rounded-br-lg'
                  : 'bg-surfaceWhite text-deepBlack rounded-3xl rounded-bl-lg'
                }
              `}
            >
              {/* User Attachment Display */}
              {msg.attachment && (
                  <div 
                      className="mb-2 rounded-lg overflow-hidden border border-black/10 cursor-pointer"
                      onClick={() => {
                          setPreviewMedia({ url: msg.attachment!.url || `data:${msg.attachment!.mimeType};base64,${msg.attachment!.data}`, type: msg.attachment!.type });
                          setIsPreviewOpen(true);
                      }}
                  >
                      {msg.attachment.type === 'image' ? (
                          <img 
                            src={msg.attachment.url || (msg.attachment.data ? `data:${msg.attachment.mimeType};base64,${msg.attachment.data}` : '')} 
                            alt="Attached" 
                            className="max-w-full h-auto max-h-48 object-cover" 
                          />
                      ) : (
                          <video 
                            src={msg.attachment.url || (msg.attachment.data ? `data:${msg.attachment.mimeType};base64,${msg.attachment.data}` : '')}
                            controls={false}
                            className="max-w-full h-auto max-h-48" 
                          />
                      )}
                  </div>
              )}

              {msg.image ? (
                  <div className="flex flex-col gap-2 relative group">
                      <div className="relative">
                          <img 
                            src={msg.image} 
                            alt="Generated" 
                            className="rounded-lg w-full h-auto object-cover cursor-pointer hover:brightness-95 transition-all" 
                            onClick={() => {
                                setPreviewMedia({ url: msg.image!, type: 'image' });
                                setIsPreviewOpen(true);
                            }}
                          />
                      </div>
                      <p className="mt-2">{msg.text}</p>
                  </div>
              ) : msg.video ? (
                   <div className="flex flex-col gap-2 relative group">
                      <div className="relative">
                          <video src={msg.video} controls className="rounded-lg w-full h-auto" />
                      </div>
                      <p className="mt-2">{msg.text}</p>
                   </div>
              ) : (
                <div className="markdown-body">
                    <ReactMarkdown
                        components={{
                            code(props) {
                                const {children, className, node, ...rest} = props
                                const match = /language-(\w+)/.exec(className || '')
                                const codeContent = String(children).replace(/\n$/, '');
                                
                                return match ? (
                                    <CodeBlock 
                                        code={codeContent} 
                                        language={match[1]} 
                                        className={className} 
                                    />
                                ) : (
                                    <code className="bg-black/5 px-1.5 py-0.5 rounded text-sm font-mono text-pink-600 font-medium" {...rest}>
                                        {children}
                                    </code>
                                )
                            },
                            h1: ({children}) => <h1 className="text-xl font-bold mb-3 mt-4">{children}</h1>,
                            h2: ({children}) => <h2 className="text-lg font-bold mb-2 mt-3">{children}</h2>,
                            h3: ({children}) => <h3 className="text-base font-bold mb-2 mt-2">{children}</h3>,
                            p: ({children}) => <p className="mb-2 last:mb-0">{children}</p>,
                            ul: ({children}) => <ul className="list-disc pl-4 mb-2">{children}</ul>,
                            ol: ({children}) => <ol className="list-decimal pl-4 mb-2">{children}</ol>,
                            li: ({children}) => <li className="mb-1">{children}</li>,
                            blockquote: ({children}) => <blockquote className="border-l-4 border-primaryPink pl-3 italic my-2 text-gray-600">{children}</blockquote>
                        }}
                    >
                        {msg.text}
                    </ReactMarkdown>
                </div>
              )}
            </div>
            
            {/* Message Actions */}
            <div className={`flex items-center gap-2 mt-1 px-1 ${msg.role === MessageRole.USER ? 'justify-end pr-1' : 'justify-start pl-1'}`}>
                {msg.role === MessageRole.MODEL && !msg.image && !msg.video && (
                    <button 
                        onClick={() => handleTTS(msg.text, msg.id)}
                        className={`p-1.5 rounded-full transition-colors ${playingMessageId === msg.id ? 'bg-pink-100 text-pink-600' : 'hover:bg-gray-100 text-gray-400 hover:text-gray-600'}`}
                        title={playingMessageId === msg.id ? "Stop" : "Read Aloud"}
                    >
                        {playingMessageId === msg.id ? <StopCircle size={14} /> : <Volume2 size={14} />}
                    </button>
                )}

                {(msg.image || msg.video) && (
                    <button 
                        onClick={() => downloadMedia(msg.image || msg.video!, `generated-media-${Date.now()}.${msg.image ? 'png' : 'mp4'}`)}
                        className="p-1.5 rounded-full hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors"
                        title="Download"
                    >
                        <Download size={14} />
                    </button>
                )}
                
                <button 
                    onClick={() => handleCopy(msg.text, msg.id)}
                    className="p-1.5 rounded-full hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors"
                    title="Copy"
                >
                    {copiedId === msg.id ? <Check size={14} className="text-green-500" /> : <Copy size={14} />}
                </button>
                
                <button 
                    onClick={() => handleShare(msg.text)}
                    className="p-1.5 rounded-full hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors"
                    title="Share"
                >
                    <Share2 size={14} />
                </button>
            </div>

          </motion.div>
        ))}
        {isLoading && (
           <motion.div 
             initial={{ opacity: 0, y: 10 }}
             animate={{ opacity: 1, y: 0 }}
             className="flex flex-col items-start"
           >
               <span className="text-xs font-bold mb-1 text-gray-500">Mike</span>
               <div className="bg-surfaceWhite px-5 py-4 rounded-3xl rounded-bl-sm shadow-sm flex items-center gap-3">
                   <span className="text-sm font-medium text-gray-500">
                      {mode === ChatMode.IMAGE_GEN ? "Generating image..." : 
                       mode === ChatMode.VIDEO_GEN ? "Generating video..." : "Thinking"}
                   </span>
                   <div className="flex space-x-1">
                       <div className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
                       <div className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
                       <div className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
                   </div>
               </div>
           </motion.div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Expanded Attachment/Media Modal */}
      <AnimatePresence>
        {isPreviewOpen && activePreview && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/95 flex flex-col items-center justify-center p-4 backdrop-blur-sm"
            onClick={() => { setIsPreviewOpen(false); setPreviewMedia(null); }}
          >
             {/* Header Actions */}
             <div className="absolute top-4 right-4 flex items-center gap-4 z-50">
                {activePreview.type === 'image' && (
                  <button 
                    onClick={(e) => { e.stopPropagation(); setIsZoomed(!isZoomed); }}
                    className="p-3 bg-white/10 rounded-full text-white hover:bg-white/20 transition-colors backdrop-blur-md"
                    title={isZoomed ? "Zoom Out" : "Zoom In"}
                  >
                    {isZoomed ? <ZoomOut size={24} /> : <ZoomIn size={24} />}
                  </button>
                )}
                <button 
                  onClick={() => { setIsPreviewOpen(false); setPreviewMedia(null); }}
                  className="p-3 bg-white/10 rounded-full text-white hover:bg-white/20 transition-colors backdrop-blur-md"
                >
                  <X size={24} />
                </button>
             </div>

             {/* Content */}
             <div 
               className="w-full h-full flex items-center justify-center overflow-hidden" 
               onClick={(e) => e.stopPropagation()}
             >
                {activePreview.type === 'image' ? (
                    <motion.div
                      className="relative cursor-grab active:cursor-grabbing"
                      drag={isZoomed}
                      dragConstraints={{ left: -500, right: 500, top: -500, bottom: 500 }}
                    >
                      <motion.img 
                        src={activePreview.url} 
                        alt="Preview Fullscreen" 
                        animate={{ scale: isZoomed ? 2.5 : 1 }}
                        transition={{ type: "spring", stiffness: 200, damping: 20 }}
                        className="max-w-full max-h-[90vh] object-contain rounded-lg shadow-2xl"
                        onClick={() => setIsZoomed(!isZoomed)}
                      />
                    </motion.div>
                ) : (
                    <video 
                        src={activePreview.url} 
                        controls 
                        autoPlay 
                        className="max-w-full max-h-[90vh] rounded-lg shadow-2xl bg-black" 
                    />
                )}
             </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* NEW: Vercel-inspired Prompt Input Area */}
      <div className="flex-shrink-0 w-full px-4 pb-safe pt-2 bg-appBackground z-20">
         <div className="w-full max-w-3xl mx-auto rounded-2xl border border-gray-200 bg-surfaceWhite shadow-sm overflow-visible transition-colors focus-within:border-gray-300 focus-within:ring-1 focus-within:ring-gray-100 relative">
             
             {/* Attachment Preview (Inside the box or floating above) */}
             {attachment && (
                 <div className="mx-3 mt-3 flex items-center gap-2 bg-gray-50 p-2 rounded-xl border border-gray-100 w-fit animate-fade-in">
                     <div className="w-10 h-10 rounded-lg overflow-hidden bg-gray-200">
                        {attachment.type === 'image' ? (
                            <img src={attachment.previewUrl} className="w-full h-full object-cover" />
                        ) : (
                            <video src={attachment.previewUrl} className="w-full h-full object-cover opacity-70" />
                        )}
                     </div>
                     <span className="text-xs text-gray-500 max-w-[100px] truncate">{attachment.file?.name}</span>
                     <button onClick={clearAttachment} className="p-1 hover:bg-gray-200 rounded-full text-gray-500">
                         <X size={14} />
                     </button>
                 </div>
             )}

             <textarea
                ref={textareaRef}
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                placeholder={
                    mode === ChatMode.IMAGE_GEN ? "Describe the image you want to generate..." : 
                    mode === ChatMode.VIDEO_GEN ? "Describe the video you want to generate..." : "What would you like to know?"
                }
                rows={1}
                className="w-full bg-transparent border-none outline-none text-base placeholder-gray-400 resize-none py-4 px-4 min-h-[60px] max-h-[200px]"
                onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        handleSend();
                    }
                }}
            />

            {/* Toolbar */}
            <div className="flex items-center justify-between p-2 pl-3 bg-gray-50/30 border-t border-gray-100">
                <div className="flex items-center gap-1">
                     {/* Attachment Button */}
                     <input 
                        type="file" 
                        ref={fileInputRef} 
                        onChange={handleFileSelect} 
                        className="hidden" 
                        accept={mode === ChatMode.VIDEO_GEN ? "image/*" : "image/*,video/*"}
                    />
                     <button 
                        onClick={() => fileInputRef.current?.click()}
                        className="p-2 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors"
                        title="Attach file"
                    >
                        <Paperclip size={18} />
                    </button>

                    {/* Model Selector (Chat Mode) */}
                    {mode === ChatMode.DEFAULT && (
                        <div className="relative">
                            <button
                                onClick={() => setIsModelDropdownOpen(!isModelDropdownOpen)}
                                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-gray-100 hover:bg-gray-200 text-gray-700 transition-colors"
                            >
                                {getModelLabel()}
                                {isModelDropdownOpen ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                            </button>
                            
                            {/* Dropdown Menu */}
                            {isModelDropdownOpen && (
                                <>
                                    <div className="fixed inset-0 z-10" onClick={() => setIsModelDropdownOpen(false)} />
                                    <div className="absolute bottom-full left-0 mb-2 w-48 bg-white rounded-xl shadow-xl border border-gray-100 overflow-hidden z-20 animate-fade-in">
                                        {MODEL_OPTIONS.map((opt) => (
                                            <button
                                                key={opt.id}
                                                onClick={() => {
                                                    setSelectedModel(opt.id);
                                                    setIsModelDropdownOpen(false);
                                                }}
                                                className={`w-full text-left px-4 py-3 text-sm hover:bg-gray-50 flex items-center justify-between ${selectedModel === opt.id ? 'bg-blue-50/50 text-blue-600 font-medium' : 'text-gray-700'}`}
                                            >
                                                {opt.label}
                                                {selectedModel === opt.id && <Check size={14} />}
                                            </button>
                                        ))}
                                    </div>
                                </>
                            )}
                        </div>
                    )}

                    {/* Model Selector (Image Mode) */}
                    {mode === ChatMode.IMAGE_GEN && (
                        <div className="flex gap-2">
                             <div className="relative">
                                <button
                                    onClick={() => setIsModelDropdownOpen(!isModelDropdownOpen)}
                                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-gray-100 hover:bg-gray-200 text-gray-700 transition-colors"
                                >
                                    {getModelLabel()}
                                    {isModelDropdownOpen ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                                </button>
                                
                                {/* Dropdown Menu */}
                                {isModelDropdownOpen && (
                                    <>
                                        <div className="fixed inset-0 z-10" onClick={() => setIsModelDropdownOpen(false)} />
                                        <div className="absolute bottom-full left-0 mb-2 w-52 bg-white rounded-xl shadow-xl border border-gray-100 overflow-hidden z-20 animate-fade-in">
                                            {IMAGE_MODEL_OPTIONS.map((opt) => (
                                                <button
                                                    key={opt.id}
                                                    onClick={() => {
                                                        setSelectedImageModel(opt.id);
                                                        setIsModelDropdownOpen(false);
                                                    }}
                                                    className={`w-full text-left px-4 py-3 text-sm hover:bg-gray-50 flex items-center justify-between ${selectedImageModel === opt.id ? 'bg-blue-50/50 text-blue-600 font-medium' : 'text-gray-700'}`}
                                                >
                                                    {opt.label}
                                                    {selectedImageModel === opt.id && <Check size={14} />}
                                                </button>
                                            ))}
                                        </div>
                                    </>
                                )}
                            </div>

                            {/* Resolution Selector (Only for Gemini 3 Pro) */}
                            {selectedImageModel === 'gemini-3-pro-image-preview' && (
                                <div className="relative">
                                    <button
                                        onClick={() => setIsResDropdownOpen(!isResDropdownOpen)}
                                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-gray-100 hover:bg-gray-200 text-gray-700 transition-colors"
                                    >
                                        {imageResolution}
                                        {isResDropdownOpen ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                                    </button>

                                    {isResDropdownOpen && (
                                        <>
                                            <div className="fixed inset-0 z-10" onClick={() => setIsResDropdownOpen(false)} />
                                            <div className="absolute bottom-full left-0 mb-2 w-24 bg-white rounded-xl shadow-xl border border-gray-100 overflow-hidden z-20 animate-fade-in">
                                                {['1K', '2K', '4K'].map((res) => (
                                                    <button
                                                        key={res}
                                                        onClick={() => {
                                                            setImageResolution(res as ImageResolution);
                                                            setIsResDropdownOpen(false);
                                                        }}
                                                        className={`w-full text-left px-4 py-2 text-sm hover:bg-gray-50 flex items-center justify-between ${imageResolution === res ? 'bg-blue-50/50 text-blue-600 font-medium' : 'text-gray-700'}`}
                                                    >
                                                        {res}
                                                    </button>
                                                ))}
                                            </div>
                                        </>
                                    )}
                                </div>
                            )}
                        </div>
                    )}
                </div>

                <div className="flex items-center gap-2">
                    {/* Action Button: Toggles between Voice Mode (AudioLines) and Send (ArrowUp) */}
                    { hasContent ? (
                        <button
                            onClick={() => handleSend()}
                            disabled={isLoading}
                            className={`
                                p-2 rounded-lg transition-all flex items-center justify-center
                                ${isLoading ? 'bg-gray-200 text-gray-400 cursor-not-allowed' : 'bg-deepBlack text-white hover:bg-black/90 shadow-sm'}
                            `}
                        >
                             {isLoading ? <Loader2 size={18} className="animate-spin" /> : <ArrowUp size={18} strokeWidth={2.5} />}
                        </button>
                    ) : (
                        <button 
                            onClick={onOpenVoiceMode}
                            className="p-2 rounded-lg bg-deepBlack text-white hover:bg-black/90 shadow-sm transition-all flex items-center justify-center"
                            title="Start Voice Mode"
                        >
                            <AudioLines size={20} />
                        </button>
                    )}
                </div>
            </div>
         </div>
         <div className="text-center mt-2 pb-1">
             <span className="text-[10px] text-gray-400">
                Mikey can make mistakes, including about people, so double-check it.
             </span>
         </div>
      </div>
    </Layout>
  );
};

export default ChatScreen;
