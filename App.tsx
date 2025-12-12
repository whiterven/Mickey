
import React, { useState, useEffect } from 'react';
import HomeScreen from './components/HomeScreen';
import ChatScreen from './components/ChatScreen';
import VoiceMode from './components/VoiceMode';
import ProfileScreen from './components/ProfileScreen';
import OnboardingScreen from './components/OnboardingScreen';
import { ScreenName, ChatMode } from './types';
import { AnimatePresence, motion } from 'framer-motion';

const App: React.FC = () => {
  const [currentScreen, setCurrentScreen] = useState<ScreenName>(ScreenName.HOME);
  const [chatMode, setChatMode] = useState<ChatMode>(ChatMode.DEFAULT);
  const [currentSessionId, setCurrentSessionId] = useState<string>("");
  const [initialPrompt, setInitialPrompt] = useState<string>("");
  const [isKeyReady, setIsKeyReady] = useState(false);
  const [language, setLanguage] = useState("English");
  
  // Onboarding State
  const [showOnboarding, setShowOnboarding] = useState(false);

  // Check for API Key & Onboarding on mount
  useEffect(() => {
    const checkInit = async () => {
      // 1. Check Onboarding
      const hasOnboarded = localStorage.getItem('mikey_onboarding_completed');
      if (!hasOnboarded) {
          setShowOnboarding(true);
      }

      // 2. Check API Key
      const win = window as any;
      if (win.aistudio) {
        const hasKey = await win.aistudio.hasSelectedApiKey();
        if (!hasKey) {
            try {
                const success = await win.aistudio.openSelectKey();
                setIsKeyReady(!!success);
            } catch (e) {
                console.error("Failed to select key", e);
            }
        } else {
            setIsKeyReady(true);
        }
      } else {
        setIsKeyReady(true);
      }
    };
    checkInit();
  }, []);

  const handleOnboardingComplete = () => {
      localStorage.setItem('mikey_onboarding_completed', 'true');
      setShowOnboarding(false);
  };

  const startNewChat = (mode: ChatMode, prompt: string = "") => {
    const newId = crypto.randomUUID();
    setCurrentSessionId(newId);
    setChatMode(mode);
    setInitialPrompt(prompt);
    setCurrentScreen(ScreenName.CHAT);
  };

  const handleStartVoice = () => {
    const newId = crypto.randomUUID();
    setCurrentSessionId(newId);
    setCurrentScreen(ScreenName.VOICE);
  };

  const handleStartChat = () => {
    startNewChat(ChatMode.DEFAULT);
  };

  const handleStartImageGen = () => {
    startNewChat(ChatMode.IMAGE_GEN);
  };
  
  const handleStartVideoGen = () => {
    startNewChat(ChatMode.VIDEO_GEN);
  };

  const handleLoadChat = (sessionId: string, mode: ChatMode) => {
      setCurrentSessionId(sessionId);
      setChatMode(mode);
      setInitialPrompt(""); 
      setCurrentScreen(ScreenName.CHAT);
  };

  const handleRecentQuery = (text: string) => {
      startNewChat(ChatMode.DEFAULT, text);
  }

  const handleOpenProfile = () => {
      setCurrentScreen(ScreenName.PROFILE);
  };

  const handleBack = () => {
    setCurrentScreen(ScreenName.HOME);
  };

  if (!isKeyReady) {
      return (
          <div className="min-h-screen flex items-center justify-center bg-[#f8f9fa] flex-col gap-4 p-6 text-center">
              <div className="animate-pulse flex flex-col items-center">
                  <div className="w-12 h-12 bg-gray-200 rounded-full mb-4"></div>
                  <div className="h-4 bg-gray-200 rounded w-32"></div>
              </div>
              <p className="text-gray-500 text-sm">Waiting for API Key selection...</p>
              <button 
                onClick={async () => {
                    const win = window as any;
                    if(win.aistudio) {
                        const success = await win.aistudio.openSelectKey();
                        setIsKeyReady(!!success);
                    }
                }}
                className="mt-4 px-6 py-2 bg-black text-white rounded-full text-sm font-bold shadow-lg hover:scale-105 transition-transform"
              >
                Select API Key
              </button>
          </div>
      );
  }

  const variants = {
      initial: { opacity: 0, scale: 0.95, filter: 'blur(5px)' },
      animate: { opacity: 1, scale: 1, filter: 'blur(0px)' },
      exit: { opacity: 0, scale: 1.05, filter: 'blur(5px)' }
  };

  return (
    <div className="relative w-full h-[100dvh] overflow-hidden bg-appBackground">
      <AnimatePresence mode="wait" initial={false}>
        {currentScreen === ScreenName.HOME && (
            <motion.div
                key="home"
                className="w-full h-full"
                variants={variants}
                initial="initial"
                animate="animate"
                exit="exit"
                transition={{ duration: 0.3, ease: [0.32, 0.72, 0, 1] }}
            >
                <HomeScreen 
                    onStartVoice={handleStartVoice}
                    onStartChat={handleStartChat}
                    onStartImageGen={handleStartImageGen}
                    onStartVideoGen={handleStartVideoGen}
                    onRecentQuery={handleRecentQuery}
                    onLoadChat={handleLoadChat}
                    onOpenProfile={handleOpenProfile}
                />
            </motion.div>
        )}

        {currentScreen === ScreenName.CHAT && (
            <motion.div
                key="chat"
                className="w-full h-full"
                variants={variants}
                initial="initial"
                animate="animate"
                exit="exit"
                transition={{ duration: 0.3, ease: [0.32, 0.72, 0, 1] }}
            >
                <ChatScreen 
                    onBack={handleBack} 
                    onNewChat={() => startNewChat(ChatMode.DEFAULT)}
                    onOpenVoiceMode={handleStartVoice}
                    sessionId={currentSessionId}
                    initialMode={chatMode}
                    initialPrompt={initialPrompt}
                    language={language}
                />
            </motion.div>
        )}

        {currentScreen === ScreenName.PROFILE && (
            <motion.div
                key="profile"
                className="w-full h-full"
                variants={variants}
                initial="initial"
                animate="animate"
                exit="exit"
                transition={{ duration: 0.3, ease: [0.32, 0.72, 0, 1] }}
            >
                <ProfileScreen 
                    onBack={handleBack} 
                    language={language}
                    onLanguageChange={setLanguage}
                />
            </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {currentScreen === ScreenName.VOICE && (
            <VoiceMode 
                onClose={handleBack} 
                language={language}
                sessionId={currentSessionId}
            />
        )}
      </AnimatePresence>

      <AnimatePresence>
          {showOnboarding && (
              <motion.div
                key="onboarding"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="absolute inset-0 z-[100]"
              >
                  <OnboardingScreen onComplete={handleOnboardingComplete} />
              </motion.div>
          )}
      </AnimatePresence>
    </div>
  );
};

export default App;
