
import React, { useEffect, useState, useRef } from 'react';
import { X, Keyboard, Mic, Check, MicOff, ArrowLeft } from 'lucide-react';
import { LiveClient } from '../services/geminiService';
import { motion, AnimatePresence } from 'framer-motion';
import { Message, MessageRole, ChatMode, SUPPORTED_VOICES } from '../types';
import { saveChat } from '../services/storageService';

interface VoiceModeProps {
  onClose: () => void;
  language: string;
  sessionId: string;
}

const VoiceMode: React.FC<VoiceModeProps> = ({ onClose, language, sessionId }) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [isActive, setIsActive] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [volume, setVolume] = useState(0);
  const [selectedVoice, setSelectedVoice] = useState("Kore");
  const [showVoiceMenu, setShowVoiceMenu] = useState(false);
  
  const clientRef = useRef<LiveClient | null>(null);

  // Persistence Effect
  useEffect(() => {
    if (messages.length > 0 && sessionId) {
      saveChat(sessionId, messages, ChatMode.DEFAULT);
    }
  }, [messages, sessionId]);

  // Connect Effect
  useEffect(() => {
    clientRef.current = new LiveClient(
      (text, isUser) => {
          setMessages(prev => {
              const role = isUser ? MessageRole.USER : MessageRole.MODEL;
              const lastMsg = prev[prev.length - 1];
              
              let newMsgs = [...prev];

              // If the last message belongs to the same role, append the text chunks
              if (lastMsg && lastMsg.role === role) {
                  newMsgs[newMsgs.length - 1] = {
                      ...lastMsg,
                      text: lastMsg.text + text,
                      timestamp: Date.now() // Update timestamp on modification
                  };
              } else {
                  // Otherwise, start a new message turn
                  newMsgs.push({
                      id: crypto.randomUUID(),
                      role,
                      text,
                      timestamp: Date.now()
                  });
              }
              
              return newMsgs;
          });
      },
      (active) => setIsActive(active),
      (vol) => {
          // Smooth out volume
          setVolume(prev => prev * 0.8 + vol * 0.2);
      }
    );

    clientRef.current.connect(language, selectedVoice);

    return () => {
      clientRef.current?.disconnect();
    };
  }, [language, selectedVoice]);

  const handleVoiceChange = (voiceId: string) => {
      setSelectedVoice(voiceId);
      setShowVoiceMenu(false);
      // The useEffect will trigger a reconnect with new voice
  };

  const toggleMute = () => {
      if (clientRef.current) {
          const newMuteState = !isMuted;
          clientRef.current.setMute(newMuteState);
          setIsMuted(newMuteState);
          if (newMuteState) setVolume(0);
      }
  };

  // For display, we only want the last 2-3 messages to keep UI clean
  const displayMessages = messages.slice(-2);

  // Helper to get friendly name
  const selectedVoiceLabel = SUPPORTED_VOICES.find(v => v.id === selectedVoice)?.label || selectedVoice;

  return (
    <motion.div 
      initial={{ opacity: 0, y: '100%' }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: '100%' }}
      transition={{ type: 'spring', damping: 25, stiffness: 200 }}
      className="fixed inset-0 z-50 flex flex-col h-[100dvh] bg-[#f8f9fa] overflow-hidden"
    >
      {/* Dynamic Background Visualization - Light Mode */}
      <div className="absolute inset-0 z-0 overflow-hidden pointer-events-none bg-[#e8f4fc]">
          {/* Main Fluid Shape (Pink) */}
          <motion.div 
             className="absolute top-[-10%] left-[-20%] w-[120%] h-[80%] rounded-full opacity-60 blur-[80px]"
             style={{
                 background: 'linear-gradient(135deg, #eec7f4 0%, #ffffff 100%)'
             }}
             animate={{
                 scale: 1 + volume * 0.5,
                 rotate: [0, 5, -5, 0],
             }}
             transition={{ type: "tween", ease: "linear", duration: 0.2 }}
          />
          
          {/* Secondary Fluid Shape (Blue) */}
          <motion.div 
             className="absolute bottom-[-10%] right-[-10%] w-[100%] h-[70%] rounded-full opacity-60 blur-[90px]"
             style={{
                 background: 'linear-gradient(135deg, #abd5ff 0%, #ffffff 100%)'
             }}
             animate={{
                 scale: 1 + volume * 0.3,
                 rotate: [0, -5, 5, 0],
             }}
             transition={{ type: "tween", ease: "linear", duration: 0.3 }}
          />

           {/* Accent Swirl */}
           <motion.div 
             className="absolute top-[40%] right-[10%] w-[60%] h-[60%] rounded-full opacity-30 blur-[60px]"
             style={{
                 background: 'radial-gradient(circle, #ffdee9 0%, transparent 70%)'
             }}
          />
      </div>

      {/* Header with Safe Area - Fixed */}
      <div className="flex-shrink-0 flex justify-between items-center p-6 pt-safe mt-2 relative z-10">
        <button onClick={onClose} className="p-3 rounded-full hover:bg-black/5 transition-colors">
           <ArrowLeft size={24} className="text-black" />
        </button>
        <div className="flex flex-col items-center">
             <span className="font-bold text-black text-lg">Conversation</span>
             <span className="text-xs text-black/50 font-medium">with {selectedVoiceLabel}</span>
        </div>
        <button 
            onClick={() => setShowVoiceMenu(true)}
            className="p-3 rounded-full hover:bg-black/5 transition-colors border border-black/5 bg-white/40"
        >
            <MenuIcon />
        </button>
      </div>

      {/* Live Conversation Area - Flexible & Scrollable */}
      <div className="flex-1 w-full max-w-2xl mx-auto px-6 flex flex-col justify-center items-center relative z-10 gap-8 min-h-0 overflow-y-auto no-scrollbar py-4">
             <AnimatePresence mode="popLayout" initial={false}>
                {displayMessages.length === 0 && (
                    <motion.div 
                        initial={{ opacity: 0 }} 
                        animate={{ opacity: 1 }} 
                        exit={{ opacity: 0 }}
                        className="text-black/30 text-2xl font-bold text-center"
                    >
                        Listening...
                    </motion.div>
                )}
                
                {displayMessages.map((msg) => (
                    <motion.div 
                        key={msg.id}
                        layout
                        initial={{ opacity: 0, y: 50, scale: 0.9 }}
                        animate={{ 
                            opacity: msg.role === MessageRole.USER ? 0.6 : 1, 
                            y: 0, 
                            scale: 1,
                            filter: 'blur(0px)'
                        }}
                        exit={{ 
                            opacity: 0, 
                            y: -50, 
                            scale: 0.9, 
                            filter: 'blur(10px)' 
                        }}
                        transition={{ 
                            type: 'spring', 
                            damping: 20, 
                            stiffness: 100,
                            layout: { duration: 0.3 }
                        }}
                        className={`text-center w-full transition-colors flex-shrink-0 ${msg.role === MessageRole.USER ? 'origin-bottom' : 'origin-top'}`}
                    >
                        <p className={`
                            font-bold leading-relaxed tracking-tight
                            ${msg.role === MessageRole.MODEL 
                                ? 'text-3xl md:text-4xl text-black drop-shadow-sm' 
                                : 'text-xl md:text-2xl text-black/60'}
                        `}>
                            {msg.text}
                        </p>
                    </motion.div>
                ))}
             </AnimatePresence>
      </div>

      {/* Controls with Safe Area - Fixed */}
      <div className="flex-shrink-0 pb-8 pb-safe px-8 flex items-center justify-between relative z-10 mt-auto">
         {/* Left: Keyboard */}
         <button className="w-14 h-14 rounded-full bg-white/60 backdrop-blur-md border border-white/20 flex items-center justify-center text-black/60 hover:bg-white transition-colors cursor-not-allowed shadow-sm">
             <Keyboard size={24} />
         </button>

         {/* Center: Mic Button with Pulse & Mute */}
         <div className="relative flex items-center justify-center">
             {!isMuted && isActive && (
                 <>
                    {/* Inner Reactive Ring */}
                    <motion.div 
                        className="absolute rounded-full bg-black/10"
                        style={{ width: '100%', height: '100%' }}
                        animate={{
                            scale: 1 + volume * 2.5
                        }}
                        transition={{ type: "tween", ease: "easeOut", duration: 0.1 }}
                    />
                    
                    {/* Outer Breathing Ring */}
                    <motion.div 
                        animate={{ scale: [1.1, 1.3, 1.1], opacity: [0.1, 0.05, 0.1] }}
                        transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
                        className="absolute w-full h-full rounded-full bg-black/5"
                        style={{ width: '100%', height: '100%' }}
                    />
                 </>
             )}
             
             {/* Main Button */}
             <button 
                onClick={toggleMute}
                className={`w-24 h-24 rounded-full flex items-center justify-center relative z-10 shadow-2xl transition-all active:scale-95 ${isMuted ? 'bg-red-500' : 'bg-black'}`}
             >
                 {isMuted ? (
                     <MicOff size={36} className="text-white" />
                 ) : (
                     <Mic size={36} className="text-white" />
                 )}
             </button>
         </div>

         {/* Right: Close (X) */}
         <button onClick={onClose} className="w-14 h-14 rounded-full bg-white/60 backdrop-blur-md border border-white/20 flex items-center justify-center text-black hover:bg-white transition-colors shadow-sm">
             <X size={24} />
         </button>
      </div>
      
      {/* Voice Selection Modal */}
      <AnimatePresence>
          {showVoiceMenu && (
              <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="absolute inset-0 z-50 bg-black/20 backdrop-blur-sm flex items-end sm:items-center justify-center p-4 sm:p-0"
                  onClick={() => setShowVoiceMenu(false)}
              >
                  <motion.div
                      initial={{ y: '100%' }}
                      animate={{ y: 0 }}
                      exit={{ y: '100%' }}
                      transition={{ type: "spring", damping: 25, stiffness: 200 }}
                      className="w-full max-w-sm bg-white rounded-3xl overflow-hidden shadow-2xl"
                      onClick={e => e.stopPropagation()}
                  >
                      <div className="p-6 border-b border-gray-100 flex justify-between items-center">
                          <h2 className="text-xl font-bold text-black">Select Voice</h2>
                          <button onClick={() => setShowVoiceMenu(false)} className="p-2 rounded-full hover:bg-gray-100 text-black">
                              <X size={20} />
                          </button>
                      </div>
                      <div className="p-4 space-y-2 max-h-[60vh] overflow-y-auto">
                          {SUPPORTED_VOICES.map((voice) => (
                              <button
                                  key={voice.id}
                                  onClick={() => handleVoiceChange(voice.id)}
                                  className={`w-full flex items-center justify-between p-4 rounded-xl transition-all ${
                                      selectedVoice === voice.id 
                                      ? 'bg-black text-white' 
                                      : 'bg-gray-50 text-black hover:bg-gray-100'
                                  }`}
                              >
                                  <div className="flex flex-col items-start">
                                      <span className="font-bold text-base">{voice.label}</span>
                                      <span className={`text-xs ${selectedVoice === voice.id ? 'text-white/60' : 'text-black/50'}`}>
                                          {voice.description}
                                      </span>
                                  </div>
                                  {selectedVoice === voice.id && <Check size={20} />}
                              </button>
                          ))}
                      </div>
                  </motion.div>
              </motion.div>
          )}
      </AnimatePresence>

    </motion.div>
  );
};

// Icons helper
const MenuIcon = () => (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="4" x2="20" y1="12" y2="12"/><line x1="4" x2="20" y1="6" y2="6"/><line x1="4" x2="20" y1="18" y2="18"/></svg>
);

export default VoiceMode;
