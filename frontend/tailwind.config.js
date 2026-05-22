/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx}',
    './src/components/**/*.{js,ts,jsx,tsx}',
    './src/app/**/*.{js,ts,jsx,tsx}',
  ],
  safelist: [
    // Dynamic opacity classes used in ternary expressions
    { pattern: /bg-gt-(accent|blue|danger|warn|dim|surface|surface2)\/(10|15|20|25|30)/ },
    { pattern: /border-gt-(accent|blue|danger|warn|dim)\/(20|25|30|40)/ },
    { pattern: /text-gt-(accent|blue|danger|warn|muted|dim|text)/ },
    // Dynamic color classes for risk/severity
    'bg-gt-accent/10', 'bg-gt-accent/15', 'bg-gt-accent/20',
    'bg-gt-blue/10',   'bg-gt-blue/15',   'bg-gt-blue/20',
    'bg-gt-danger/10', 'bg-gt-danger/15', 'bg-gt-danger/20',
    'bg-gt-warn/10',   'bg-gt-warn/15',   'bg-gt-warn/20',
    'border-gt-accent/20', 'border-gt-accent/25', 'border-gt-accent/30',
    'border-gt-blue/20',   'border-gt-blue/25',   'border-gt-blue/30',
    'border-gt-danger/20', 'border-gt-danger/25', 'border-gt-danger/30',
    'border-gt-warn/20',   'border-gt-warn/25',   'border-gt-warn/30',
    'text-gt-accent', 'text-gt-blue', 'text-gt-danger', 'text-gt-warn',
    'text-orange-400', 'bg-orange-400/10', 'border-orange-400/20',
    'text-purple-400', 'bg-purple-400/10', 'border-purple-400/20',
    'text-red-400',    'bg-red-400/10',
    'border-l-gt-danger', 'border-l-gt-accent', 'border-l-orange-400', 'border-l-gt-warn',
  ],
  theme: {
    extend: {
      colors: {
        gt: {
          bg:       '#0a0c0f',
          surface:  '#0f1318',
          surface2: '#151b23',
          border:   'rgba(255,255,255,0.07)',
          border2:  'rgba(255,255,255,0.12)',
          accent:   '#00e5a0',
          blue:     '#0095ff',
          danger:   '#ff3b5c',
          warn:     '#ffb43a',
          text:     '#e8edf2',
          muted:    '#6b7a8d',
          dim:      '#3a4553',
        },
      },
      fontFamily: {
        sans:    ['Inter', 'system-ui', 'sans-serif'],
        mono:    ['"Space Mono"', 'monospace'],
        display: ['Syne', 'sans-serif'],
      },
      animation: {
        'pulse-slow': 'pulse 2s cubic-bezier(0.4,0,0.6,1) infinite',
        'slide-in':   'slideIn 0.3s ease',
        'fade-in':    'fadeIn 0.4s ease',
        'glow':       'glow 2s ease-in-out infinite',
      },
      keyframes: {
        slideIn: {
          '0%':   { opacity: '0', transform: 'translateX(-8px)' },
          '100%': { opacity: '1', transform: 'translateX(0)' },
        },
        fadeIn: {
          '0%':   { opacity: '0' },
          '100%': { opacity: '1' },
        },
        glow: {
          '0%,100%': { boxShadow: '0 0 0 rgba(0,229,160,0)' },
          '50%':     { boxShadow: '0 0 12px rgba(0,229,160,0.25)' },
        },
      },
    },
  },
  plugins: [],
};
