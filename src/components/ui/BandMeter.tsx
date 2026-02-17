import { FREQUENCY_BANDS } from '../../types/eeg';

interface BandMeterProps {
  bands: {
    delta: number;
    theta: number;
    alpha: number;
    beta: number;
    gamma: number;
  };
  dominant: 'delta' | 'theta' | 'alpha' | 'beta' | 'gamma';
  showLabels?: boolean;
}

export function BandMeter({ bands, dominant, showLabels = true }: BandMeterProps) {
  return (
    <div className="flex items-end justify-between gap-2 h-24">
      {Object.entries(FREQUENCY_BANDS).map(([key, band]) => {
        const value = bands[key as keyof typeof bands] || 0;
        const isDominant = key === dominant;
        const height = Math.max(4, (value / 100) * 100);
        
        return (
          <div key={key} className="flex flex-col items-center flex-1">
            {/* Bar */}
            <div className="relative w-full h-20 flex items-end justify-center">
              <div
                className={`
                  w-full max-w-[24px] rounded-t-sm transition-all duration-300
                  ${isDominant ? 'animate-pulse' : ''}
                `}
                style={{
                  height: `${height}%`,
                  backgroundColor: band.color,
                  boxShadow: isDominant ? `0 0 20px ${band.color}` : 'none',
                }}
              />
            </div>
            
            {/* Label */}
            {showLabels && (
              <div className="mt-2 text-center">
                <div 
                  className={`text-xs font-medium ${isDominant ? 'text-text-primary' : 'text-text-secondary'}`}
                  style={{ color: isDominant ? band.color : undefined }}
                >
                  {band.label}
                </div>
                <div className="text-xs text-text-tertiary">
                  {Math.round(value)}%
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// Compact inline version
export function BandMeterInline({ bands, dominant }: BandMeterProps) {
  return (
    <div className="flex items-center gap-1">
      {Object.entries(FREQUENCY_BANDS).map(([key, band]) => {
        const value = bands[key as keyof typeof bands] || 0;
        const isDominant = key === dominant;
        
        return (
          <div
            key={key}
            className={`
              h-2 rounded-full transition-all duration-300
              ${isDominant ? 'opacity-100' : 'opacity-50'}
            `}
            style={{
              width: `${Math.max(4, value / 2)}px`,
              backgroundColor: band.color,
            }}
          />
        );
      })}
    </div>
  );
}