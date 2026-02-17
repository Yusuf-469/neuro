interface SignalQualityProps {
  quality: number;
  showLabel?: boolean;
  size?: 'sm' | 'md' | 'lg';
}

export function SignalQuality({ quality, showLabel = true, size = 'md' }: SignalQualityProps) {
  const getColor = (q: number) => {
    if (q >= 80) return '#30D158'; // Green
    if (q >= 60) return '#5AC8FA'; // Blue
    if (q >= 40) return '#FF9500'; // Orange
    return '#FF375F'; // Red
  };
  
  const sizes = {
    sm: 'w-16 h-1',
    md: 'w-24 h-2',
    lg: 'w-32 h-3',
  };
  
  const color = getColor(quality);
  
  return (
    <div className="flex items-center gap-2">
      <div className={`${sizes[size]} bg-surface-3 rounded-full overflow-hidden`}>
        <div
          className="h-full rounded-full transition-all duration-300"
          style={{
            width: `${quality}%`,
            backgroundColor: color,
            boxShadow: `0 0 10px ${color}50`,
          }}
        />
      </div>
      {showLabel && (
        <span 
          className="text-xs font-medium"
          style={{ color }}
        >
          {quality}%
        </span>
      )}
    </div>
  );
}