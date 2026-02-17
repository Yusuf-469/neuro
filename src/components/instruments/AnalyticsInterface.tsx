import { useState, useMemo } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import { ArrowLeft, Download, TrendingUp, Brain, Clock, BarChart3, PieChart, Sparkles, Target, Award } from 'lucide-react';
import { Archive } from '../3d';
import { useSessionStore } from '../../stores';
import { Button, IconButton } from '../ui/Button';
import type { EEGSession } from '../../types/firebase';

interface AnalyticsInterfaceProps {
  onBack: () => void;
}

export function AnalyticsInterface({ onBack }: AnalyticsInterfaceProps) {
  const [timeRange, setTimeRange] = useState<'7d' | '30d' | '90d' | 'all'>('30d');
  
  const { sessions } = useSessionStore();
  
  // Calculate analytics
  const analytics = useMemo(() => {
    const now = Date.now();
    const ranges = {
      '7d': 7 * 24 * 60 * 60 * 1000,
      '30d': 30 * 24 * 60 * 60 * 1000,
      '90d': 90 * 24 * 60 * 60 * 1000,
      'all': Infinity,
    };
    
    const filteredSessions = sessions.filter((s) => {
      const sessionTime = s.startedAt?.toMillis?.() || 0;
      return now - sessionTime < ranges[timeRange];
    });
    
    const stateDistribution: Record<string, number> = {};
    filteredSessions.forEach((s) => {
      s.summary?.dominantStates?.forEach((ds) => {
        stateDistribution[ds.state] = (stateDistribution[ds.state] || 0) + ds.duration;
      });
    });
    
    const totalMinutes = filteredSessions.reduce((sum, s) => sum + (s.duration || 0), 0) / 60;
    
    const avgQuality = filteredSessions.length > 0
      ? filteredSessions.reduce((sum, s) => sum + (s.summary?.averageQuality || 0), 0) / filteredSessions.length
      : 0;
    
    const weeklyData = [];
    for (let i = 0; i < 4; i++) {
      const weekStart = now - (i + 1) * 7 * 24 * 60 * 60 * 1000;
      const weekEnd = now - i * 7 * 24 * 60 * 60 * 1000;
      
      const weekSessions = filteredSessions.filter((s) => {
        const t = s.startedAt?.toMillis?.() || 0;
        return t >= weekStart && t < weekEnd;
      });
      
      weeklyData.push({
        week: `Week ${4 - i}`,
        sessions: weekSessions.length,
        minutes: weekSessions.reduce((sum, s) => sum + (s.duration || 0), 0) / 60,
      });
    }
    
    return {
      totalSessions: filteredSessions.length,
      totalMinutes,
      avgQuality,
      stateDistribution,
      weeklyData: weeklyData.reverse(),
    };
  }, [sessions, timeRange]);
  
  // Export data
  const handleExport = async () => {
    const csv = generateCSVReport(sessions);
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    
    const a = document.createElement('a');
    a.href = url;
    a.download = `neuro-report-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    
    URL.revokeObjectURL(url);
  };
  
  return (
    <div className="fixed inset-0 bg-void z-50 flex flex-col overflow-hidden animate-fade-in-up">
      {/* Animated background */}
      <div className="absolute inset-0 grid-bg opacity-50" />
      <div className="absolute inset-0 hex-pattern opacity-30" />
      
      {/* Animated gradient orbs */}
      <div 
        className="absolute w-[600px] h-[600px] rounded-full opacity-20 blur-[120px] pointer-events-none transition-all duration-1000 animate-breathe"
        style={{
          background: 'radial-gradient(circle, rgba(0, 212, 255, 0.4) 0%, transparent 70%)',
          left: '20%',
          top: '15%',
        }}
      />
      <div 
        className="absolute w-[400px] h-[400px] rounded-full opacity-20 blur-[100px] pointer-events-none transition-all duration-1000"
        style={{
          background: 'radial-gradient(circle, rgba(157, 0, 255, 0.4) 0%, transparent 70%)',
          right: '10%',
          bottom: '20%',
        }}
      />
      
      {/* Floating particles */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        {[...Array(20)].map((_, i) => (
          <div
            key={i}
            className="absolute w-1 h-1 bg-purple/30 rounded-full animate-float"
            style={{
              left: `${Math.random() * 100}%`,
              top: `${Math.random() * 100}%`,
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
          {/* Time range selector */}
          <div className="flex glass-panel rounded-2xl p-1 border border-white/5">
            {(['7d', '30d', '90d', 'all'] as const).map((range) => (
              <button
                key={range}
                onClick={() => setTimeRange(range)}
                className={`
                  px-5 py-2 rounded-xl text-sm font-medium transition-all duration-300
                  ${timeRange === range 
                    ? 'bg-cyan/20 text-cyan shadow-[0_0_20px_rgba(0,212,255,0.3)]' 
                    : 'text-text-secondary hover:text-text-primary'}
                `}
              >
                {range === 'all' ? 'All' : range}
              </button>
            ))}
          </div>
          
          <Button
            onClick={handleExport}
            variant="secondary"
            icon={<Download className="w-4 h-4" />}
          >
            Export
          </Button>
        </div>
      </header>
      
      {/* Main content */}
      <div className="flex-1 flex relative z-10">
        {/* 3D Galaxy visualization */}
        <div className="flex-1 relative">
          <Canvas
            camera={{ position: [0, 0, 5], fov: 50 }}
            gl={{ antialias: true, alpha: true }}
          >
            <ambientLight intensity={0.5} />
            <pointLight position={[10, 10, 10]} intensity={1} />
            <Archive
              scrollProgress={1}
              isExpanded={true}
            />
            <OrbitControls
              enableZoom={true}
              enablePan={true}
              minDistance={3}
              maxDistance={10}
            />
          </Canvas>
          
          {/* Hint */}
          <div className="absolute bottom-8 left-1/2 -translate-x-1/2 animate-fade-in-up">
            <div className="px-6 py-3 rounded-2xl glass-panel border border-white/10">
              <p className="text-xs text-text-tertiary">
                Drag to rotate · Scroll to zoom
              </p>
            </div>
          </div>
        </div>
        
        {/* Analytics panel */}
        <div className="w-[420px] flex flex-col relative overflow-hidden">
          {/* Glass panel background */}
          <div className="absolute inset-0 glass-panel border-l border-white/5" />
          
          <div className="flex-1 p-6 relative z-10 overflow-y-auto custom-scrollbar space-y-6">
            {/* Summary stats */}
            <div className="grid grid-cols-2 gap-4 animate-fade-in-up">
              <div className="futuristic-card p-5 group">
                <div className="flex items-center gap-2 text-cyan mb-3">
                  <Brain className="w-4 h-4" />
                  <span className="text-xs uppercase tracking-wider font-medium">Sessions</span>
                </div>
                <div className="text-4xl font-bold gradient-text">
                  {analytics.totalSessions}
                </div>
                <p className="text-xs text-text-tertiary mt-2">Total recordings</p>
              </div>
              
              <div className="futuristic-card p-5 group">
                <div className="flex items-center gap-2 text-cyan mb-3">
                  <Clock className="w-4 h-4" />
                  <span className="text-xs uppercase tracking-wider font-medium">Total Time</span>
                </div>
                <div className="text-4xl font-bold gradient-text">
                  {Math.round(analytics.totalMinutes)}
                  <span className="text-lg text-text-secondary ml-1">min</span>
                </div>
                <p className="text-xs text-text-tertiary mt-2">Meditation time</p>
              </div>
            </div>
            
            {/* State distribution */}
            <div className="futuristic-card p-6 animate-fade-in-up delay-100">
              <div className="flex items-center justify-between mb-5">
                <h3 className="text-sm text-text-secondary font-medium flex items-center gap-2">
                  <PieChart className="w-4 h-4 text-cyan" />
                  State Distribution
                </h3>
              </div>
              
              <div className="space-y-4">
                {Object.entries(analytics.stateDistribution)
                  .sort((a, b) => b[1] - a[1])
                  .map(([state, duration], index) => {
                    const total = Object.values(analytics.stateDistribution).reduce((a, b) => a + b, 0);
                    const percentage = total > 0 ? (duration / total) * 100 : 0;
                    const color = getStateColor(state);
                    
                    return (
                      <div 
                        key={state} 
                        className="flex items-center gap-4 animate-fade-in-left"
                        style={{ animationDelay: `${index * 100}ms` }}
                      >
                        <div 
                          className="w-3 h-3 rounded-full shadow-lg"
                          style={{ backgroundColor: color, boxShadow: `0 0 15px ${color}` }}
                        />
                        <span className="text-sm text-text-primary capitalize flex-1 font-medium">
                          {state}
                        </span>
                        <div className="w-28 h-3 bg-surface-3/50 rounded-full overflow-hidden">
                          <div
                            className="h-full rounded-full transition-all duration-700 relative"
                            style={{
                              width: `${percentage}%`,
                              backgroundColor: color,
                              boxShadow: `0 0 10px ${color}60`,
                            }}
                          />
                        </div>
                        <span className="text-lg font-mono font-semibold w-14 text-right" style={{ color }}>
                          {Math.round(percentage)}%
                        </span>
                      </div>
                    );
                  })}
              </div>
            </div>
            
            {/* Weekly trend */}
            <div className="futuristic-card p-6 animate-fade-in-up delay-200">
              <div className="flex items-center justify-between mb-5">
                <h3 className="text-sm text-text-secondary font-medium flex items-center gap-2">
                  <BarChart3 className="w-4 h-4 text-cyan" />
                  Weekly Trend
                </h3>
                <TrendingUp className="w-5 h-5 text-alpha" />
              </div>
              
              <div className="flex items-end gap-4 h-36">
                {analytics.weeklyData.map((week, i) => {
                  const maxMinutes = Math.max(...analytics.weeklyData.map(w => w.minutes), 1);
                  const height = (week.minutes / maxMinutes) * 100;
                  
                  return (
                    <div key={i} className="flex-1 flex flex-col items-center gap-3 animate-fade-in-up" style={{ animationDelay: `${i * 100}ms` }}>
                      <div className="w-full h-28 flex items-end justify-center">
                        <div 
                          className="w-full max-w-[40px] rounded-xl transition-all duration-700 relative overflow-hidden"
                          style={{ 
                            height: `${Math.max(12, height)}%`,
                            background: `linear-gradient(180deg, rgba(0, 212, 255, 0.6) 0%, rgba(157, 0, 255, 0.4) 100%)`,
                            boxShadow: '0 0 20px rgba(0, 212, 255, 0.3)',
                          }}
                        >
                          <div className="absolute inset-0 bg-gradient-to-t from-transparent to-white/10" />
                          {/* Value label */}
                          <div className="absolute -top-6 left-1/2 -translate-x-1/2">
                            <span className="text-xs font-mono text-cyan">{week.sessions}</span>
                          </div>
                        </div>
                      </div>
                      <span className="text-xs text-text-tertiary font-medium">
                        {week.week}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
            
            {/* AI Insights */}
            <div className="futuristic-card p-6 animate-fade-in-up delay-300">
              <div className="flex items-center gap-2 mb-5">
                <Sparkles className="w-4 h-4 text-cyan" />
                <h3 className="text-sm text-text-secondary font-medium">AI Insights</h3>
              </div>
              
              <div className="space-y-4">
                {[
                  { color: '#00D4FF', text: 'Your theta states have increased', highlight: '23%', suffix: 'this month, indicating deeper meditation practice.' },
                  { color: '#5AC8FA', text: 'Peak coherence achieved during', highlight: 'morning sessions', suffix: 'between 6-8 AM.' },
                  { color: '#FF375F', text: 'Consider extending session duration for', highlight: 'deeper state exploration', suffix: '.' },
                ].map((insight, i) => (
                  <div 
                    key={i}
                    className="flex items-start gap-4 p-4 rounded-xl border transition-all duration-300 hover:border-opacity-50"
                    style={{ 
                      backgroundColor: `${insight.color}08`,
                      borderColor: `${insight.color}20`,
                    }}
                  >
                    <div 
                      className="w-2 h-2 rounded-full mt-1.5 flex-shrink-0"
                      style={{ backgroundColor: insight.color, boxShadow: `0 0 10px ${insight.color}` }}
                    />
                    <p className="text-sm text-text-secondary leading-relaxed">
                      {insight.text} <span style={{ color: insight.color }} className="font-semibold">{insight.highlight}</span> {insight.suffix}
                    </p>
                  </div>
                ))}
              </div>
            </div>
            
            {/* Actions */}
            <div className="space-y-3 pt-2 animate-fade-in-up delay-400">
              <Button
                fullWidth
                variant="primary"
                icon={<Target className="w-4 h-4" />}
                glow="cyan"
              >
                Find Therapist
              </Button>
              <Button
                fullWidth
                variant="secondary"
                icon={<Award className="w-4 h-4" />}
              >
                Schedule Session
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

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

function generateCSVReport(sessions: EEGSession[]): string {
  const header = 'Date,Duration (min),Dominant State,Avg Quality,Peak Coherence\n';
  
  const rows = sessions.map((s) => {
    const date = s.startedAt?.toDate?.()?.toISOString?.() || 'Unknown';
    const duration = Math.round((s.duration || 0) / 60);
    const dominant = s.summary?.dominantStates?.[0]?.state || 'Unknown';
    const quality = s.summary?.averageQuality || 0;
    const coherence = s.summary?.peakCoherence || 0;
    
    return `${date},${duration},${dominant},${quality},${coherence}`;
  });
  
  return header + rows.join('\n');
}

export default AnalyticsInterface;