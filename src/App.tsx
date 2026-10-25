import { useState, useEffect, useRef, useCallback, Suspense } from 'react';
import { Canvas } from '@react-three/fiber';
import { Preload } from '@react-three/drei';
import { Brain, Therapist, Archive } from './components/3d';
import { EEGInterface, TherapyInterface, ModelInterface } from './components/instruments';
import { useEEGStore, useUserStore } from './stores';
import { Button } from './components/ui/Button';
import type { Instrument } from './types';
import { ChevronDown, Zap, Sparkles, Activity, MessageCircle, FlaskConical } from 'lucide-react';

// Scroll sections configuration
const SECTIONS = [
  { 
    id: 'brain', 
    instrument: 'brain' as Instrument, 
    title: 'Brain', 
    subtitle: 'EEG Capture', 
    description: 'Real-time neural monitoring',
    icon: Activity,
    color: '#00D4FF',
  },
  { 
    id: 'therapist', 
    instrument: 'therapist' as Instrument, 
    title: 'Therapist', 
    subtitle: 'AI Conversation', 
    description: 'Mind-aware AI therapy',
    icon: MessageCircle,
    color: '#30D158',
  },
  { 
    id: 'archive', 
    instrument: 'archive' as Instrument, 
    title: 'Model', 
    subtitle: 'Prediction Model', 
    description: 'Our EEG research model, running in your browser',
    icon: FlaskConical,
    color: '#FFD60A',
  },
];

function App() {
  const [scrollProgress, setScrollProgress] = useState(0);
  const [activeSection, setActiveSection] = useState(0);
  const [expandedInstrument, setExpandedInstrument] = useState<Instrument | null>(null);
  const [isLoaded, setIsLoaded] = useState(false);
  const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 });
  
  const containerRef = useRef<HTMLDivElement>(null);
  const { initialize: initializeUser } = useUserStore();
  const { dominantState } = useEEGStore();
  
  // Initialize user auth
  useEffect(() => {
    const unsubscribe = initializeUser();
    return () => unsubscribe?.();
  }, [initializeUser]);
  
  // Mouse tracking for parallax effects
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      setMousePosition({
        x: (e.clientX / window.innerWidth - 0.5) * 2,
        y: (e.clientY / window.innerHeight - 0.5) * 2,
      });
    };
    
    window.addEventListener('mousemove', handleMouseMove);
    return () => window.removeEventListener('mousemove', handleMouseMove);
  }, []);
  
  // Handle scroll
  const handleScroll = useCallback(() => {
    if (!containerRef.current || expandedInstrument) return;
    
    const { scrollTop, scrollHeight, clientHeight } = containerRef.current;
    const progress = scrollTop / (scrollHeight - clientHeight);
    setScrollProgress(Math.max(0, Math.min(1, progress)));
    
    const sectionIndex = Math.min(
      Math.floor(progress * SECTIONS.length),
      SECTIONS.length - 1
    );
    setActiveSection(sectionIndex);
  }, [expandedInstrument]);
  
  // Handle instrument click
  const handleInstrumentClick = useCallback((instrument: Instrument) => {
    setExpandedInstrument(instrument);
  }, []);
  
  // Handle back from expanded view
  const handleBack = useCallback(() => {
    setExpandedInstrument(null);
  }, []);
  
  // Loading state
  useEffect(() => {
    const timer = setTimeout(() => setIsLoaded(true), 800);
    return () => clearTimeout(timer);
  }, []);
  
  // Get state color for glow effects
  const stateColor = getStateColor(dominantState);
  
  return (
    <div className="relative w-full h-screen bg-void overflow-hidden">
      {/* Animated background */}
      <div className="fixed inset-0 grid-bg opacity-30" />
      <div className="fixed inset-0 hex-pattern opacity-20" />
      
      {/* Animated gradient orbs */}
      <div 
        className="fixed w-[700px] h-[700px] rounded-full opacity-25 blur-[120px] pointer-events-none transition-all duration-1000 animate-breathe"
        style={{
          background: `radial-gradient(circle, ${stateColor}50 0%, transparent 70%)`,
          left: `${25 + mousePosition.x * 10}%`,
          top: `${25 + mousePosition.y * 10}%`,
        }}
      />
      <div 
        className="fixed w-[500px] h-[500px] rounded-full opacity-15 blur-[100px] pointer-events-none transition-all duration-1000"
        style={{
          background: 'radial-gradient(circle, #00D4FF50 0%, transparent 70%)',
          right: `${15 - mousePosition.x * 5}%`,
          bottom: `${15 - mousePosition.y * 5}%`,
        }}
      />
      <div 
        className="fixed w-[300px] h-[300px] rounded-full opacity-10 blur-[80px] pointer-events-none transition-all duration-1000"
        style={{
          background: 'radial-gradient(circle, #9D00FF50 0%, transparent 70%)',
          left: `${60 + mousePosition.x * 8}%`,
          top: `${60 - mousePosition.y * 8}%`,
        }}
      />
      
      {/* Loading screen */}
      {!isLoaded && (
        <div className="fixed inset-0 z-50 bg-void flex items-center justify-center">
          <div className="text-center animate-fade-in-up">
            <div className="relative">
              <h1 className="text-7xl font-bold gradient-text mb-6 tracking-tight">
                Neuro
              </h1>
              <div className="absolute -inset-8 bg-gradient-to-r from-cyan/20 via-purple/20 to-pink/20 blur-3xl rounded-full animate-pulse" />
            </div>
            <p className="text-text-secondary text-sm uppercase tracking-widest mb-8">
              Loading your mind's interface...
            </p>
            <div className="w-56 h-1.5 bg-surface-2 rounded-full overflow-hidden mx-auto">
              <div 
                className="h-full bg-gradient-to-r from-cyan via-purple to-pink rounded-full transition-all duration-1000"
                style={{ width: '60%' }}
              />
            </div>
          </div>
        </div>
      )}
      
      {/* Main scroll container */}
      <div
        ref={containerRef}
        onScroll={handleScroll}
        className="w-full h-full overflow-y-auto no-scrollbar"
        style={{ opacity: isLoaded ? 1 : 0, transition: 'opacity 0.5s' }}
      >
        {/* Hero section */}
        <section className="h-screen flex flex-col items-center justify-center relative">
          {/* Floating particles */}
          <div className="absolute inset-0 overflow-hidden pointer-events-none">
            {[...Array(30)].map((_, i) => (
              <div
                key={i}
                className="absolute rounded-full animate-float"
                style={{
                  width: `${2 + Math.random() * 3}px`,
                  height: `${2 + Math.random() * 3}px`,
                  backgroundColor: i % 3 === 0 ? 'rgba(0, 212, 255, 0.4)' : i % 3 === 1 ? 'rgba(157, 0, 255, 0.3)' : 'rgba(255, 0, 110, 0.3)',
                  left: `${Math.random() * 100}%`,
                  top: `${Math.random() * 100}%`,
                  animationDelay: `${Math.random() * 5}s`,
                  animationDuration: `${5 + Math.random() * 5}s`,
                }}
              />
            ))}
          </div>
          
          <div className="text-center z-10 relative animate-fade-in-up">
            <div className="relative inline-block mb-6">
              <h1 className="text-9xl font-bold gradient-text tracking-tighter">
                Neuro
              </h1>
              <div className="absolute -inset-12 bg-gradient-to-r from-cyan/10 via-purple/10 to-pink/10 blur-3xl rounded-full animate-breathe" />
              <Sparkles className="absolute -top-4 -right-4 w-8 h-8 text-cyan animate-pulse" />
            </div>
            
            <p className="text-2xl text-text-primary mb-3 font-light">
              Your mind. <span className="text-cyan">Finally</span> visible.
            </p>
            <p className="text-sm text-text-tertiary uppercase tracking-widest mb-10">
              Scroll to explore
            </p>
            
            {/* Feature badges */}
            <div className="flex items-center justify-center gap-4 flex-wrap">
              {SECTIONS.map((section, i) => (
                <div 
                  key={section.id}
                  className="px-5 py-2.5 rounded-2xl glass-panel border transition-all duration-300 hover:scale-105 animate-fade-in-up"
                  style={{ 
                    borderColor: `${section.color}30`,
                    animationDelay: `${(i + 1) * 100}ms`,
                  }}
                >
                  <div className="flex items-center gap-2">
                    <section.icon className="w-4 h-4" style={{ color: section.color }} />
                    <span className="text-xs uppercase tracking-wider font-medium" style={{ color: section.color }}>
                      {section.subtitle}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
          
          {/* Scroll indicator */}
          <div className="absolute bottom-10 left-1/2 -translate-x-1/2 flex flex-col items-center gap-3 animate-fade-in-up delay-500">
            <div className="w-6 h-10 rounded-full border-2 border-cyan/30 flex items-start justify-center p-1.5">
              <div className="w-1.5 h-3 bg-cyan rounded-full animate-bounce" />
            </div>
            <ChevronDown className="w-5 h-5 text-cyan animate-bounce" />
          </div>
        </section>
        
        {/* Instrument sections */}
        {SECTIONS.map((section, index) => (
          <section
            key={section.id}
            className="h-screen flex items-center justify-center relative"
          >
            {/* 3D Canvas */}
            <div className="absolute inset-0 pointer-events-none">
              <Canvas
                camera={{ position: [0, 0, 5], fov: 50 }}
                gl={{ antialias: true, alpha: true }}
              >
                <Suspense fallback={null}>
                  <ambientLight intensity={0.5} />
                  <pointLight position={[10, 10, 10]} intensity={1} />
                  
                  {section.instrument === 'brain' && (
                    <Brain
                      scrollProgress={getSectionProgress(scrollProgress, index)}
                      isExpanded={false}
                      onClick={() => handleInstrumentClick('brain')}
                    />
                  )}
                  
                  {section.instrument === 'therapist' && (
                    <Therapist
                      scrollProgress={getSectionProgress(scrollProgress, index)}
                      isExpanded={false}
                      onClick={() => handleInstrumentClick('therapist')}
                    />
                  )}
                  
                  {section.instrument === 'archive' && (
                    <Archive
                      scrollProgress={getSectionProgress(scrollProgress, index)}
                      isExpanded={false}
                      onClick={() => handleInstrumentClick('archive')}
                    />
                  )}
                  
                  <Preload all />
                </Suspense>
              </Canvas>
            </div>
            
            {/* Section info */}
            <div className="z-10 text-center pointer-events-auto px-8 animate-fade-in-up">
              <div className="relative inline-block mb-4">
                <h2 className="text-7xl font-bold gradient-text tracking-tight">
                  {section.title}
                </h2>
                <div className="absolute -inset-6 blur-2xl rounded-full opacity-50" style={{ background: `radial-gradient(circle, ${section.color}20 0%, transparent 70%)` }} />
              </div>
              
              <p className="text-xl mb-2 uppercase tracking-widest font-medium" style={{ color: section.color }}>
                {section.subtitle}
              </p>
              <p className="text-text-secondary mb-10 text-lg">
                {section.description}
              </p>
              
              <Button
                onClick={() => handleInstrumentClick(section.instrument)}
                variant="primary"
                size="lg"
                icon={<Zap className="w-5 h-5" />}
                glow="cyan"
              >
                Enter
              </Button>
            </div>
          </section>
        ))}
        
      </div>
      
      {/* Progress indicator */}
      <div className="fixed right-8 top-1/2 -translate-y-1/2 z-20">
        <div className="flex flex-col gap-4">
          {SECTIONS.map((section, index) => (
            <button
              key={section.id}
              onClick={() => {
                if (containerRef.current) {
                  const scrollTarget = (index / SECTIONS.length) * (containerRef.current.scrollHeight - containerRef.current.clientHeight);
                  containerRef.current.scrollTo({ top: scrollTarget, behavior: 'smooth' });
                }
              }}
              className="group relative transition-all duration-300"
            >
              <div 
                className={`
                  w-3 h-3 rounded-full transition-all duration-300
                  ${activeSection === index 
                    ? 'scale-150 shadow-lg' 
                    : 'scale-100 opacity-50 group-hover:opacity-100'}
                `}
                style={{ 
                  backgroundColor: activeSection === index ? section.color : '#48484A',
                  boxShadow: activeSection === index ? `0 0 20px ${section.color}` : 'none',
                }}
              />
              {activeSection === index && (
                <div 
                  className="absolute inset-0 rounded-full animate-ping opacity-30"
                  style={{ backgroundColor: section.color }}
                />
              )}
              
              {/* Tooltip */}
              <div 
                className="absolute right-6 top-1/2 -translate-y-1/2 px-3 py-1.5 rounded-lg glass-panel border border-white/10
                           opacity-0 group-hover:opacity-100 transition-opacity duration-300 whitespace-nowrap"
              >
                <span className="text-xs font-medium" style={{ color: section.color }}>{section.title}</span>
              </div>
            </button>
          ))}
        </div>
      </div>
      
      {/* Expanded instrument interfaces */}
      {expandedInstrument === 'brain' && (
        <EEGInterface onBack={handleBack} />
      )}
      
      {expandedInstrument === 'therapist' && (
        <TherapyInterface onBack={handleBack} />
      )}
      
      {/* The archive scene is now the research prediction model */}
      {expandedInstrument === 'archive' && (
        <ModelInterface onBack={handleBack} />
      )}
    </div>
  );
}

// Helper function to calculate section-specific progress
function getSectionProgress(globalProgress: number, sectionIndex: number): number {
  const sectionStart = sectionIndex / SECTIONS.length;
  const sectionEnd = (sectionIndex + 1) / SECTIONS.length;
  
  if (globalProgress < sectionStart) return 0;
  if (globalProgress > sectionEnd) return 1;
  
  return (globalProgress - sectionStart) / (sectionEnd - sectionStart);
}

// Get color for brain state
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

export default App;
