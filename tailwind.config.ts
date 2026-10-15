import type { Config } from 'tailwindcss'

export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        ink: '#0b0f14',
        panel: '#111820',
        line: '#26323f',
      },
    },
  },
  plugins: [],
} satisfies Config
