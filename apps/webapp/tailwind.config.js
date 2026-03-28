/** @type {import('tailwindcss').Config} */
export default {
  content: ['./src/**/*.{html,js,svelte,ts}'],
  theme: {
    extend: {
      colors: {
        "surface-container": "#1f1e2e",
        "primary-fixed-dim": "#ecc300",
        "primary-container": "#ffd300",
        "surface-container-low": "#1b1a2a",
        "surface-container-lowest": "#0d0c1b",
        "on-surface": "#e4e0f6",
        "on-surface-variant": "#d0c6ab",
        "outline-variant": "#4d4632",
        "background": "#0b0a19"
      },
      fontFamily: {
        "headline": ["Space Grotesk", "sans-serif"],
        "body": ["Inter", "sans-serif"],
        "label": ["Inter", "sans-serif"],
        "mono": ["Roboto Mono", "monospace"],
        "industrial": ["Roboto Condensed", "sans-serif"]
      },
      borderRadius: {
        "DEFAULT": "0.125rem",
        "lg": "0.25rem",
        "xl": "0.5rem",
        "full": "9999px"
      }
    },
  },
  plugins: [],
}
