/** @type {import('tailwindcss').Config} */
const TYPE_NAMES = [
  'normal', 'fire', 'water', 'electric', 'grass', 'ice',
  'fighting', 'poison', 'ground', 'flying', 'psychic', 'bug',
  'rock', 'ghost', 'dragon', 'dark', 'steel', 'fairy',
  'stellar', 'unknown',
];

export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  safelist: [
    ...TYPE_NAMES.map((t) => `bg-type-${t}`),
    ...TYPE_NAMES.map((t) => `text-type-${t}`),
    ...TYPE_NAMES.map((t) => `before:bg-type-${t}`),
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        bg: {
          DEFAULT: '#0b0f17',
          elev: '#121826',
          card: '#161e2e',
          hover: '#1c2638',
        },
        line: '#22304a',
        muted: '#8a96ad',
        text: '#e6ecf5',
        accent: {
          DEFAULT: '#ef4444',
          hover: '#dc2626',
        },
        // Pokemon type palette
        type: {
          normal: '#a8a77a',
          fire: '#ee8130',
          water: '#6390f0',
          electric: '#f7d02c',
          grass: '#7ac74c',
          ice: '#96d9d6',
          fighting: '#c22e28',
          poison: '#a33ea1',
          ground: '#e2bf65',
          flying: '#a98ff3',
          psychic: '#f95587',
          bug: '#a6b91a',
          rock: '#b6a136',
          ghost: '#735797',
          dragon: '#6f35fc',
          dark: '#705746',
          steel: '#b7b7ce',
          fairy: '#d685ad',
          stellar: '#3fb8b8',
          unknown: '#68a090',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'Segoe UI', 'sans-serif'],
        mono: ['JetBrains Mono', 'ui-monospace', 'monospace'],
      },
      boxShadow: {
        card: '0 1px 0 0 rgba(255,255,255,0.04) inset, 0 8px 24px -8px rgba(0,0,0,0.5)',
      },
    },
  },
  plugins: [],
};
