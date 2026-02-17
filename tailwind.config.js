/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Background layers
        void: '#000000',
        surface: {
          1: '#0A0A0A',
          2: '#141414',
          3: '#1E1E1E',
        },
        // EEG state colors
        theta: '#5AC8FA',
        alpha: '#30D158',
        beta: '#FF9500',
        gamma: '#FF375F',
        delta: '#BF5AF2',
        // Text colors
        text: {
          primary: '#FFFFFF',
          secondary: '#8E8E93',
          tertiary: '#636366',
        },
      },
      fontFamily: {
        sans: ['Inter', 'SF Pro', 'system-ui', '-apple-system', 'sans-serif'],
        mono: ['SF Mono', 'Fira Code', 'monospace'],
      },
      fontSize: {
        caption: ['12px', { lineHeight: '16px', fontWeight: '400' }],
        body: ['16px', { lineHeight: '24px', fontWeight: '400' }],
        medium: ['16px', { lineHeight: '24px', fontWeight: '500' }],
        semibold: ['16px', { lineHeight: '24px', fontWeight: '600' }],
        title: ['24px', { lineHeight: '32px', fontWeight: '600' }],
        display: ['48px', { lineHeight: '56px', fontWeight: '600' }],
        hero: ['72px', { lineHeight: '80px', fontWeight: '600' }],
      },
      spacing: {
        '4pt': '4px',
        '8pt': '8px',
        '12pt': '12px',
        '16pt': '16px',
        '24pt': '24px',
        '32pt': '32px',
        '48pt': '48px',
        '64pt': '64px',
      },
      borderRadius: {
        'card': '12px',
        'card-lg': '24px',
        'pill': '9999px',
      },
      boxShadow: {
        'glow-theta': '0 0 20px rgba(90, 200, 250, 0.3)',
        'glow-alpha': '0 0 20px rgba(48, 209, 88, 0.3)',
        'glow-beta': '0 0 20px rgba(255, 149, 0, 0.3)',
        'glow-gamma': '0 0 20px rgba(255, 55, 95, 0.3)',
        'glow-delta': '0 0 20px rgba(191, 90, 242, 0.3)',
      },
      animation: {
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'breathe': 'breathe 4s ease-in-out infinite',
        'float': 'float 6s ease-in-out infinite',
        'glow': 'glow 2s ease-in-out infinite',
      },
      keyframes: {
        breathe: {
          '0%, 100%': { transform: 'scale(1)', opacity: '1' },
          '50%': { transform: 'scale(1.05)', opacity: '0.9' },
        },
        float: {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-10px)' },
        },
        glow: {
          '0%, 100%': { filter: 'brightness(1)' },
          '50%': { filter: 'brightness(1.2)' },
        },
      },
      backdropBlur: {
        xs: '2px',
      },
    },
  },
  plugins: [],
}
