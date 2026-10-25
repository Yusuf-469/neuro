import { useState, useRef, useEffect, useCallback } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import { ArrowLeft, Mic, MicOff, Send, Volume2, Brain, MessageCircle, Sparkles, Heart, Waves } from 'lucide-react';
import { Therapist } from '../3d';
import { useTherapistStore, useEEGStore, useUserStore } from '../../stores';
import { IconButton } from '../ui/Button';
import type { TherapyMessage } from '../../types/firebase';
import { askTherapist, CRISIS, CRISIS_REPLY } from '../../lib/therapistApi';

interface TherapyInterfaceProps {
  onBack: () => void;
}

export function TherapyInterface({ onBack }: TherapyInterfaceProps) {
  const [inputMode, setInputMode] = useState<'text' | 'voice'>('text');
  const [inputText, setInputText] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  
  const { 
    messages, 
    addMessage, 
    isTyping,
    setTyping,
    setSpeaking,
    startConversation,
    currentConversation,
  } = useTherapistStore();
  
  const { dominantState, signalQuality, isStreaming } = useEEGStore();
  const { user } = useUserStore();
  
  // Scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);
  
  // Start a new session if needed
  useEffect(() => {
    if (!currentConversation && user) {
      startConversation();
    }
  }, [currentConversation, user, startConversation]);
  
  // Handle sending message
  const handleSend = useCallback(async () => {
    if (!inputText.trim() || isTyping) return;
    
    const userMessage: Omit<TherapyMessage, 'id' | 'timestamp'> = {
      role: 'user',
      content: inputText.trim(),
      eegContext: {
        dominant: dominantState,
        quality: signalQuality,
      },
    };
    
    addMessage(userMessage);
    setInputText('');
    setTyping(true);
    
    try {
      // Real AI reply from the /api/therapist serverless function (the key stays server-side)
      const text = inputText.trim();
      const history = [...messages, { role: 'user' as const, content: text }];
      const reply = await askTherapist(history, { dominant: dominantState, quality: signalQuality });

      const aiResponse: Omit<TherapyMessage, 'id' | 'timestamp'> = {
        role: 'assistant',
        content:
          reply ??
          (CRISIS.test(text)
            ? CRISIS_REPLY
            : `${signalQuality > 0 ? generateAIResponse(text, dominantState) : "I'm here and listening. Tell me a little more about what's on your mind?"}

(Offline: a scripted reply, because the AI service is unavailable right now.)`),
      };
      
      addMessage(aiResponse);
    } catch (error) {
      console.error('Failed to get AI response:', error);
    } finally {
      setTyping(false);
    }
  }, [inputText, isTyping, messages, dominantState, signalQuality, addMessage, setTyping]);
  
  // Handle voice input
  const toggleRecording = useCallback(() => {
    if (isRecording) {
      setIsRecording(false);
      // Process recorded audio
    } else {
      setIsRecording(true);
      // Start recording
    }
  }, [isRecording]);
  
  // Handle text-to-speech
  const speakMessage = useCallback((text: string) => {
    if ('speechSynthesis' in window) {
      setIsSpeaking(true);
      setSpeaking(true);
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.onend = () => {
        setIsSpeaking(false);
        setSpeaking(false);
      };
      speechSynthesis.speak(utterance);
    }
  }, [setSpeaking]);
  
  const stateColor = getStateColor(dominantState);
  
  return (
    <div className="fixed inset-0 bg-void z-50 flex flex-col overflow-hidden animate-fade-in-up">
      {/* Animated background */}
      <div className="absolute inset-0 grid-bg opacity-50" />
      <div className="absolute inset-0 hex-pattern opacity-30" />
      
      {/* Animated gradient orbs */}
      <div 
        className="absolute w-[600px] h-[600px] rounded-full opacity-30 blur-[120px] pointer-events-none transition-all duration-1000 animate-breathe"
        style={{
          background: `radial-gradient(circle, ${stateColor}60 0%, transparent 70%)`,
          left: '15%',
          top: '20%',
        }}
      />
      <div 
        className="absolute w-[400px] h-[400px] rounded-full opacity-20 blur-[100px] pointer-events-none transition-all duration-1000"
        style={{
          background: `radial-gradient(circle, #30D158 0%, transparent 70%)`,
          right: '15%',
          bottom: '25%',
        }}
      />
      
      {/* Floating particles */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        {[...Array(15)].map((_, i) => (
          <div
            key={i}
            className="absolute w-1 h-1 rounded-full animate-float"
            style={{
              left: `${Math.random() * 100}%`,
              top: `${Math.random() * 100}%`,
              backgroundColor: i % 2 === 0 ? 'rgba(48, 209, 88, 0.4)' : 'rgba(0, 212, 255, 0.4)',
              animationDelay: `${Math.random() * 5}s`,
              animationDuration: `${4 + Math.random() * 4}s`,
            }}
          />
        ))}
      </div>
      
      {/* Header */}
      <header className="relative z-20 flex items-center justify-between p-5 border-b border-white/5">
        <IconButton
          onClick={onBack}
          variant="ghost"
          ariaLabel="Go back"
          className="group"
        >
          <ArrowLeft className="w-5 h-5 group-hover:-translate-x-1 transition-transform" />
        </IconButton>
        
        <div className="flex items-center gap-4">
          {/* EEG State indicator */}
          {isStreaming && (
            <div className="flex items-center gap-3 px-5 py-2.5 rounded-2xl glass-panel border border-white/10 animate-scale-in">
              <Brain className="w-4 h-4" style={{ color: stateColor }} />
              <span className="text-sm font-medium uppercase tracking-wider" style={{ color: stateColor }}>
                {dominantState}
              </span>
            </div>
          )}
          
          {/* Mode toggle */}
          <div className="flex glass-panel rounded-2xl p-1 border border-white/5">
            <button
              onClick={() => setInputMode('text')}
              className={`
                px-5 py-2 rounded-xl text-sm font-medium transition-all duration-300
                ${inputMode === 'text' 
                  ? 'bg-cyan/20 text-cyan shadow-[0_0_20px_rgba(0,212,255,0.3)]' 
                  : 'text-text-secondary hover:text-text-primary'}
              `}
            >
              Text
            </button>
            <button
              onClick={() => setInputMode('voice')}
              className={`
                px-5 py-2 rounded-xl text-sm font-medium transition-all duration-300
                ${inputMode === 'voice' 
                  ? 'bg-cyan/20 text-cyan shadow-[0_0_20px_rgba(0,212,255,0.3)]' 
                  : 'text-text-secondary hover:text-text-primary'}
              `}
            >
              Voice
            </button>
          </div>
        </div>
      </header>
      
      {/* Main content */}
      <div className="flex-1 flex relative z-10">
        {/* 3D Therapist visualization */}
        <div className="flex-1 relative">
          <Canvas
            camera={{ position: [0, 0, 5], fov: 50 }}
            gl={{ antialias: true, alpha: true }}
          >
            <ambientLight intensity={0.5} />
            <pointLight position={[10, 10, 10]} intensity={1} />
            <Therapist
              scrollProgress={1}
              isExpanded={true}
              onClick={() => {}}
            />
            <OrbitControls
              enableZoom={false}
              enablePan={false}
              minPolarAngle={Math.PI / 3}
              maxPolarAngle={Math.PI / 1.5}
            />
          </Canvas>
          
          {/* Status indicator */}
          <div className="absolute bottom-8 left-1/2 -translate-x-1/2 animate-fade-in-up">
            <div className="px-8 py-4 rounded-2xl glass-panel border border-white/10">
              <div className="flex items-center gap-3">
                {isTyping ? (
                  <>
                    <Sparkles className="w-4 h-4 text-cyan animate-pulse" />
                    <span className="text-sm text-text-secondary">Processing your thoughts...</span>
                  </>
                ) : isSpeaking ? (
                  <>
                    <Waves className="w-4 h-4 text-alpha animate-pulse" />
                    <span className="text-sm text-text-secondary">Speaking to you...</span>
                  </>
                ) : (
                  <>
                    <Heart className="w-4 h-4 text-pink animate-pulse" />
                    <span className="text-sm text-text-secondary">Ready to listen</span>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
        
        {/* Chat panel */}
        <div className="w-[420px] flex flex-col relative overflow-hidden">
          {/* Glass panel background */}
          <div className="absolute inset-0 glass-panel border-l border-white/5" />
          
          {/* Messages */}
          <div className="flex-1 p-6 relative z-10 overflow-y-auto custom-scrollbar space-y-4">
            {messages.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-center animate-fade-in-up">
                <div className="relative mb-6">
                  <div className="w-20 h-20 rounded-3xl bg-gradient-to-r from-cyan/20 to-alpha/20 flex items-center justify-center border border-white/10">
                    <MessageCircle className="w-10 h-10 text-cyan" />
                  </div>
                  <div className="absolute inset-0 bg-cyan/10 blur-2xl rounded-full" />
                </div>
                <h3 className="text-lg font-semibold text-text-primary mb-2">
                  Start Your Session
                </h3>
                <p className="text-text-secondary text-sm mb-1">
                  Begin a conversation with your AI therapist
                </p>
                <p className="text-text-tertiary text-xs mb-8">
                  Your EEG state will inform the conversation
                </p>
                
                {/* Quick prompts */}
                <div className="w-full space-y-3">
                  {[
                    "How are you feeling right now?",
                    "I'm feeling stressed, can you help?",
                    "Let's explore my current mental state",
                  ].map((prompt, i) => (
                    <button
                      key={i}
                      onClick={() => setInputText(prompt)}
                      className="w-full px-5 py-4 rounded-2xl glass-panel border border-white/5 text-left
                                 hover:border-cyan/30 hover:bg-cyan/5 transition-all duration-300 text-sm text-text-secondary
                                 animate-fade-in-up"
                      style={{ animationDelay: `${(i + 1) * 100}ms` }}
                    >
                      <span className="text-cyan mr-2">"</span>
                      {prompt}
                      <span className="text-cyan ml-2">"</span>
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <>
                {messages.map((message, index) => (
                  <div
                    key={message.id}
                    className={`
                      max-w-[85%] p-5 transition-all duration-300 animate-fade-in-up
                      ${message.role === 'user' 
                        ? 'ml-auto message-user' 
                        : 'mr-auto message-ai'}
                    `}
                    style={{ animationDelay: `${index * 50}ms` }}
                  >
                    <p className="text-sm leading-relaxed whitespace-pre-line">{message.content}</p>
                    
                    {/* EEG context for user messages */}
                    {message.role === 'user' && message.eegContext && (
                      <div className="mt-3 pt-3 border-t border-white/10">
                        <div className="flex items-center gap-2">
                          <Brain className="w-3 h-3" style={{ color: getStateColor(message.eegContext.dominant) }} />
                          <span className="text-xs text-text-tertiary">
                            <span style={{ color: getStateColor(message.eegContext.dominant) }}>
                              {message.eegContext.dominant}
                            </span>
                            <span className="mx-1">·</span>
                            {message.eegContext.quality}% quality
                          </span>
                        </div>
                      </div>
                    )}
                    
                    {/* TTS button for AI messages */}
                    {message.role === 'assistant' && (
                      <button
                        onClick={() => speakMessage(message.content)}
                        className="mt-3 flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/5 border border-white/5
                                   text-xs text-text-tertiary hover:text-cyan hover:border-cyan/30 transition-all duration-300"
                      >
                        <Volume2 className="w-3 h-3" />
                        <span>Listen</span>
                      </button>
                    )}
                  </div>
                ))}
                
                {/* Typing indicator */}
                {isTyping && (
                  <div className="mr-auto message-ai max-w-[85%] p-5 animate-fade-in-up">
                    <div className="flex items-center gap-3">
                      <div className="flex gap-1.5">
                        <div className="w-2.5 h-2.5 rounded-full bg-cyan typing-dot" />
                        <div className="w-2.5 h-2.5 rounded-full bg-cyan typing-dot" />
                        <div className="w-2.5 h-2.5 rounded-full bg-cyan typing-dot" />
                      </div>
                      <span className="text-xs text-text-tertiary">Thinking...</span>
                    </div>
                  </div>
                )}
                
                <div ref={messagesEndRef} />
              </>
            )}
          </div>
          
          {/* Input area */}
          <div className="p-5 relative z-10 border-t border-white/5">
            {inputMode === 'text' ? (
              <div className="flex items-center gap-3">
                <input
                  ref={inputRef}
                  type="text"
                  value={inputText}
                  onChange={(e) => setInputText(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSend()}
                  placeholder="Type your message..."
                  className="flex-1 px-5 py-4 rounded-2xl glass-panel border border-white/10
                           text-text-primary placeholder-text-tertiary text-sm
                           focus:border-cyan/30 focus:bg-cyan/5 transition-all duration-300"
                />
                <IconButton
                  onClick={handleSend}
                  disabled={!inputText.trim() || isTyping}
                  variant={inputText.trim() && !isTyping ? 'glow' : 'default'}
                  ariaLabel="Send message"
                >
                  <Send className="w-5 h-5" />
                </IconButton>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-4 py-4">
                <button
                  onClick={toggleRecording}
                  className={`
                    relative w-24 h-24 rounded-3xl transition-all duration-400
                    ${isRecording 
                      ? 'bg-pink/20 border-2 border-pink text-pink shadow-[0_0_40px_rgba(255,55,95,0.4)]' 
                      : 'bg-cyan/10 border-2 border-cyan/30 text-cyan hover:shadow-[0_0_30px_rgba(0,212,255,0.3)]'}
                  `}
                >
                  {isRecording ? (
                    <>
                      <MicOff className="w-10 h-10 mx-auto" />
                      <div className="absolute inset-0 rounded-3xl border-2 border-pink animate-pulse-ring" />
                      <div className="absolute inset-0 rounded-3xl border-2 border-pink animate-pulse-ring" style={{ animationDelay: '0.5s' }} />
                    </>
                  ) : (
                    <Mic className="w-10 h-10 mx-auto" />
                  )}
                </button>
                <p className="text-sm text-text-tertiary font-medium">
                  {isRecording ? 'Tap to stop' : 'Tap to speak'}
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// Helper function to get state color
function getStateColor(state: string): string {
  const colors: Record<string, string> = {
    delta: '#BF5AF2',
    theta: '#5AC8FA',
    alpha: '#30D158',
    beta: '#FF9500',
    gamma: '#FF375F',
  };
  return colors[state] || colors.alpha;
}

// Generate AI response based on EEG state
function generateAIResponse(_userInput: string, eegState: string): string {
  const responses: Record<string, string[]> = {
    theta: [
      "I notice you're in a deeply relaxed theta state. This is an excellent time for introspection and creative exploration. What thoughts are surfacing for you right now?",
      "Your brain is showing strong theta waves, which often indicates a meditative or deeply relaxed state. How does your body feel in this moment?",
      "Theta states are associated with creativity and emotional processing. Is there something on your mind you'd like to explore while in this receptive state?",
    ],
    alpha: [
      "You're in a calm, focused alpha state - perfect for mindful awareness. What sensations are you noticing in your body right now?",
      "Alpha waves indicate a relaxed but alert state. This is an ideal time for gentle self-reflection. How would you describe your current emotional landscape?",
      "I see you're experiencing alpha dominance, which suggests a balanced, peaceful state. What brings you here today?",
    ],
    beta: [
      "I notice your beta waves are elevated, which can indicate active thinking or mild stress. Let's take a moment to slow down. Can you describe what's on your mind?",
      "Your brain is showing beta activity, often associated with focused attention or anxiety. Would you like to try a brief grounding exercise?",
      "Beta states can mean you're actively processing information. What's occupying your thoughts right now? Let's work through it together.",
    ],
    gamma: [
      "Interesting - you're showing gamma wave activity, associated with peak cognition and insight. Are you experiencing any breakthroughs or heightened awareness?",
      "Gamma waves often indicate heightened perception and integration of information. What feels particularly clear to you right now?",
      "Your brain is in a high-frequency gamma state. This can be a powerful moment for insight. What would you like to explore?",
    ],
    delta: [
      "You're in a delta state, typically associated with deep rest or sleep. If you're consciously aware in this state, it's quite rare. How are you feeling?",
      "Delta waves are usually present during deep sleep. If you're experiencing this while awake, you may be in a profoundly restorative state. What do you notice?",
    ],
  };
  
  const stateResponses = responses[eegState] || responses.alpha;
  return stateResponses[Math.floor(Math.random() * stateResponses.length)];
}

export default TherapyInterface;