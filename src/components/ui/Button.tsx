import { forwardRef } from 'react';
import { Loader2 } from 'lucide-react';

interface ButtonProps {
  children: React.ReactNode;
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger' | 'success';
  size?: 'sm' | 'md' | 'lg' | 'xl';
  loading?: boolean;
  glow?: 'theta' | 'alpha' | 'beta' | 'gamma' | 'delta' | 'cyan' | 'none';
  icon?: React.ReactNode;
  iconPosition?: 'left' | 'right';
  fullWidth?: boolean;
  onClick?: () => void;
  disabled?: boolean;
  className?: string;
  type?: 'button' | 'submit' | 'reset';
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ 
    children, 
    variant = 'primary', 
    size = 'md', 
    loading = false,
    glow = 'none',
    icon,
    iconPosition = 'left',
    fullWidth = false,
    className = '', 
    disabled,
    onClick,
    type = 'button',
  }, ref) => {
    const baseStyles = 'relative inline-flex items-center justify-center font-semibold transition-all duration-400 ease-out rounded-xl active:scale-[0.98] disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:scale-100 overflow-hidden';
    
    const variants = {
      primary: `
        bg-gradient-to-r from-cyan/20 to-purple/20 
        border border-cyan/40 
        text-cyan 
        hover:border-cyan hover:text-white
        hover:shadow-[0_0_30px_rgba(0,212,255,0.4),0_0_60px_rgba(0,212,255,0.2)]
        hover:translate-y-[-2px]
      `,
      secondary: `
        bg-surface-2/50 
        border border-white/10 
        text-text-secondary 
        hover:border-white/30 hover:text-text-primary
        hover:bg-surface-3/50
      `,
      ghost: `
        bg-transparent 
        text-text-secondary 
        hover:text-text-primary hover:bg-white/5
      `,
      danger: `
        bg-gradient-to-r from-pink/20 to-gamma/20 
        border border-pink/40 
        text-pink 
        hover:border-pink hover:text-white
        hover:shadow-[0_0_30px_rgba(255,0,110,0.4)]
        hover:translate-y-[-2px]
      `,
      success: `
        bg-gradient-to-r from-alpha/20 to-theta/20 
        border border-alpha/40 
        text-alpha 
        hover:border-alpha hover:text-white
        hover:shadow-[0_0_30px_rgba(48,209,88,0.4)]
        hover:translate-y-[-2px]
      `,
    };
    
    const sizes = {
      sm: 'px-4 py-2 text-xs gap-1.5',
      md: 'px-6 py-3 text-sm gap-2',
      lg: 'px-8 py-4 text-base gap-2.5',
      xl: 'px-10 py-5 text-lg gap-3',
    };

    const glowStyles = {
      theta: 'before:absolute before:inset-0 before:bg-theta/20 before:blur-xl before:opacity-0 hover:before:opacity-100 before:transition-opacity before:duration-500',
      alpha: 'before:absolute before:inset-0 before:bg-alpha/20 before:blur-xl before:opacity-0 hover:before:opacity-100 before:transition-opacity before:duration-500',
      beta: 'before:absolute before:inset-0 before:bg-beta/20 before:blur-xl before:opacity-0 hover:before:opacity-100 before:transition-opacity before:duration-500',
      gamma: 'before:absolute before:inset-0 before:bg-gamma/20 before:blur-xl before:opacity-0 hover:before:opacity-100 before:transition-opacity before:duration-500',
      delta: 'before:absolute before:inset-0 before:bg-delta/20 before:blur-xl before:opacity-0 hover:before:opacity-100 before:transition-opacity before:duration-500',
      cyan: 'before:absolute before:inset-0 before:bg-cyan/20 before:blur-xl before:opacity-0 hover:before:opacity-100 before:transition-opacity before:duration-500',
      none: '',
    };

    const fullWidthStyle = fullWidth ? 'w-full' : '';
    
    return (
      <button
        ref={ref}
        type={type}
        className={`
          ${baseStyles} 
          ${variants[variant]} 
          ${sizes[size]} 
          ${glowStyles[glow]} 
          ${fullWidthStyle} 
          ${className}
        `.trim().replace(/\s+/g, ' ')}
        disabled={disabled || loading}
        onClick={onClick}
      >
        {/* Shine effect on hover */}
        <span className="absolute inset-0 -translate-x-full hover:animate-[shine_0.6s_ease-out] bg-gradient-to-r from-transparent via-white/10 to-transparent" />
        
        {/* Content */}
        <span className="relative flex items-center justify-center gap-2 z-10">
          {loading ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <>
              {icon && iconPosition === 'left' && icon}
              {children}
              {icon && iconPosition === 'right' && icon}
            </>
          )}
        </span>
      </button>
    );
  }
);

Button.displayName = 'Button';

// Icon Button variant
interface IconButtonProps {
  children: React.ReactNode;
  size?: 'sm' | 'md' | 'lg';
  variant?: 'default' | 'ghost' | 'glow';
  onClick?: () => void;
  disabled?: boolean;
  className?: string;
  ariaLabel?: string;
}

export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(
  ({ 
    children, 
    size = 'md', 
    variant = 'default',
    className = '', 
    disabled,
    onClick,
    ariaLabel,
  }, ref) => {
    const baseStyles = 'inline-flex items-center justify-center rounded-xl transition-all duration-300 active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed';
    
    const variants = {
      default: 'bg-white/5 border border-white/10 text-text-secondary hover:border-cyan/30 hover:text-cyan hover:bg-cyan/10 hover:shadow-[0_0_20px_rgba(0,212,255,0.2)]',
      ghost: 'bg-transparent text-text-secondary hover:text-text-primary hover:bg-white/5',
      glow: 'bg-cyan/10 border border-cyan/30 text-cyan hover:bg-cyan/20 hover:shadow-[0_0_30px_rgba(0,212,255,0.4)]',
    };
    
    const sizes = {
      sm: 'w-8 h-8',
      md: 'w-10 h-10',
      lg: 'w-12 h-12',
    };
    
    return (
      <button
        ref={ref}
        type="button"
        className={`${baseStyles} ${variants[variant]} ${sizes[size]} ${className}`}
        disabled={disabled}
        onClick={onClick}
        aria-label={ariaLabel}
      >
        {children}
      </button>
    );
  }
);

IconButton.displayName = 'IconButton';

// Floating Action Button
interface FABProps {
  children: React.ReactNode;
  onClick?: () => void;
  className?: string;
  position?: 'bottom-right' | 'bottom-left' | 'bottom-center';
}

export const FAB: React.FC<FABProps> = ({ 
  children, 
  onClick, 
  className = '',
  position = 'bottom-right'
}) => {
  const positions = {
    'bottom-right': 'bottom-6 right-6',
    'bottom-left': 'bottom-6 left-6',
    'bottom-center': 'bottom-6 left-1/2 -translate-x-1/2',
  };

  return (
    <button
      onClick={onClick}
      className={`
        fixed ${positions[position]}
        w-14 h-14
        bg-gradient-to-r from-cyan to-purple
        rounded-2xl
        flex items-center justify-center
        text-white
        shadow-[0_4px_30px_rgba(0,212,255,0.4)]
        hover:shadow-[0_8px_40px_rgba(0,212,255,0.6)]
        hover:scale-110
        active:scale-95
        transition-all duration-300
        z-50
        ${className}
      `}
    >
      {children}
    </button>
  );
};

// Button Group
interface ButtonGroupProps {
  children: React.ReactNode;
  className?: string;
}

export const ButtonGroup: React.FC<ButtonGroupProps> = ({ children, className = '' }) => {
  return (
    <div className={`inline-flex gap-2 ${className}`}>
      {children}
    </div>
  );
};

export default Button;