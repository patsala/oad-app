import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        masters: {
          green: '#006747',
          dark: '#00382a',
          darker: '#002118',
          yellow: '#FED141',
          gold: '#d4a843',
          cream: '#f5f0e1',
          azalea: '#E75480',
        }
      }
    },
  },
  plugins: [],
};

export default config;
