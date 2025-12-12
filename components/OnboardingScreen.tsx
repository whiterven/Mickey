
import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowRight, Mic, Image as ImageIcon, Video, MessageSquareText, Sparkles, X } from 'lucide-react';
import { COLORS } from '../types';

interface OnboardingScreenProps {
  onComplete: () => void;
}

const STEPS = [
  {
    id: 'welcome',
    title: "Meet Mikey",
    description: "Your friendly, creative AI assistant powered by Gemini. I'm here to help you chat, create, and explore.",
    icon: <Sparkles size={48} className="text-yellow-500" />,
    color: "bg-yellow-50"
  },
  {
    id: 'voice',
    title: "Voice Mode",
    description: "Have natural, real-time conversations. Just tap the mic and start talking—hands-free.",
    icon: <Mic size={48} className="text-blue-500" />,
    color: "bg-blue-50"
  },
  {
    id: 'media',
    title: "Media Studio",
    description: "Turn words into reality. Generate high-quality images and videos instantly.",
    icon: <div className="flex gap-2"><ImageIcon size={40} className="text-pink-500" /><Video size={40} className="text-purple-500" /></div>,
    color: "bg-pink-50"
  },
  {
    id: 'privacy',
    title: "Local History",
    description: "Your chats are stored locally on your device for privacy and quick access.",
    icon: <MessageSquareText size={48} className="text-green-500" />,
    color: "bg-green-50"
  }
];

const OnboardingScreen: React.FC<OnboardingScreenProps> = ({ onComplete }) => {
  const [currentStep, setCurrentStep] = useState(0);

  const handleNext = () => {
    if (currentStep < STEPS.length - 1) {
      setCurrentStep(prev => prev + 1);
    } else {
      onComplete();
    }
  };

  const contentVariants = {
    hidden: { opacity: 0, x: 50 },
    visible: { opacity: 1, x: 0 },
    exit: { opacity: 0, x: -50 }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/40 backdrop-blur-md">
      <motion.div 
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.9 }}
        className="bg-white w-full max-w-sm rounded-[32px] overflow-hidden shadow-2xl relative flex flex-col min-h-[500px]"
      >
        {/* Skip Button */}
        <button 
            onClick={onComplete}
            className="absolute top-4 right-4 p-2 text-gray-400 hover:text-gray-600 z-10"
        >
            <X size={20} />
        </button>

        {/* Content Area */}
        <div className="flex-1 flex flex-col items-center justify-center p-8 text-center">
            <AnimatePresence mode="wait">
                <motion.div
                    key={STEPS[currentStep].id}
                    variants={contentVariants}
                    initial="hidden"
                    animate="visible"
                    exit="exit"
                    transition={{ duration: 0.3 }}
                    className="flex flex-col items-center"
                >
                    <div className={`w-32 h-32 rounded-full ${STEPS[currentStep].color} flex items-center justify-center mb-8 shadow-sm`}>
                        {STEPS[currentStep].icon}
                    </div>
                    <h2 className="text-2xl font-extrabold text-gray-900 mb-4">{STEPS[currentStep].title}</h2>
                    <p className="text-gray-500 leading-relaxed text-base">{STEPS[currentStep].description}</p>
                </motion.div>
            </AnimatePresence>
        </div>

        {/* Footer Actions */}
        <div className="p-8 pt-0 w-full">
            {/* Dots */}
            <div className="flex justify-center gap-2 mb-8">
                {STEPS.map((_, idx) => (
                    <div 
                        key={idx}
                        className={`h-2 rounded-full transition-all duration-300 ${idx === currentStep ? 'w-8 bg-black' : 'w-2 bg-gray-200'}`}
                    />
                ))}
            </div>

            <button
                onClick={handleNext}
                className="w-full bg-black text-white py-4 rounded-2xl font-bold text-lg hover:scale-[1.02] active:scale-95 transition-all shadow-lg flex items-center justify-center gap-2"
            >
                {currentStep === STEPS.length - 1 ? "Get Started" : "Next"}
                {currentStep !== STEPS.length - 1 && <ArrowRight size={20} />}
            </button>
        </div>
      </motion.div>
    </div>
  );
};

export default OnboardingScreen;
