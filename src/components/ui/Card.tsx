import { motion } from 'framer-motion';

interface CardProps {
  children: React.ReactNode;
  className?: string;
  elevated?: boolean;
  onClick?: () => void;
}

export function Card({ children, className = '', elevated = false, onClick }: CardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      whileHover={onClick ? { scale: 1.02 } : undefined}
      onClick={onClick}
      className={`
        ${elevated ? 'bg-surface-2' : 'bg-surface-1'}
        rounded-card-lg
        p-6
        transition-all
        duration-300
        ${onClick ? 'cursor-pointer hover:bg-surface-2' : ''}
        ${className}
      `}
    >
      {children}
    </motion.div>
  );
}