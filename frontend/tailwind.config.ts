import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/pages/**/*.{js,ts,jsx,tsx,mdx}", "./src/components/**/*.{js,ts,jsx,tsx,mdx}", "./src/app/**/*.{js,ts,jsx,tsx,mdx}"],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        background: {
          primary: "#050507",
          secondary: "#0a0a12",
          card: "rgba(18, 18, 28, 0.6)",
          DEFAULT: "#050507",
        },
        border: {
          default: "#1f1f2e",
          glow: "rgba(255, 255, 255, 0.08)",
          DEFAULT: "#1f1f2e",
        },
        accent: {
          cyan: "#00f0ff",
          magenta: "#ff003c",
          lime: "#39ff14",
          red: "#ff2a6d",
          yellow: "#fcee0a",
          DEFAULT: "#00f0ff",
        },
        text: {
          primary: "#ffffff",
          secondary: "#9494a8",
          muted: "#505060",
          DEFAULT: "#ffffff",
        },
      },
      fontFamily: {
        header: ["var(--font-space-grotesk)", "Space Grotesk", "sans-serif"],
        code: ["var(--font-jetbrains-mono)", "JetBrains Mono", "monospace"],
        body: ["var(--font-inter)", "Inter", "sans-serif"],
      },
      backgroundImage: {
        "gradient-radial": "radial-gradient(var(--tw-gradient-stops))",
        "gradient-conic": "conic-gradient(from 180deg at 50% 50%, var(--tw-gradient-stops))",
        "gradient-cyber": "linear-gradient(135deg, #0a0a0f 0%, #1a1a2e 50%, #0a0a0f 100%)",
        "gradient-glow-cyan": "radial-gradient(circle at center, rgba(0, 255, 255, 0.15) 0%, transparent 70%)",
        "gradient-glow-magenta": "radial-gradient(circle at center, rgba(255, 0, 255, 0.15) 0%, transparent 70%)",
      },
      animation: {
        "pulse-slow": "pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite",
        glow: "glow 2s ease-in-out infinite alternate",
        shake: "shake 200ms ease-in-out",
        particle: "particle-float 500ms ease-out forwards",
        confetti: "confetti-fall 3s ease-in forwards",
        victory: "victory-bounce 800ms cubic-bezier(0.68, -0.55, 0.265, 1.55)",
        "pulse-glow": "pulse-glow 2s ease-in-out infinite",
        "slide-in-up": "slide-in-up 300ms ease-out",
        "slide-in-down": "slide-in-down 300ms ease-out",
        "fade-in": "fade-in 300ms ease-out",
        "float-3d": "float-3d 8s ease-in-out infinite",
      },
      keyframes: {
        glow: {
          "0%": { boxShadow: "0 0 5px rgba(0, 255, 255, 0.5), 0 0 10px rgba(0, 255, 255, 0.3)" },
          "100%": { boxShadow: "0 0 20px rgba(0, 255, 255, 0.8), 0 0 40px rgba(0, 255, 255, 0.5)" },
        },
        shake: {
          "0%, 100%": { transform: "translateX(0)" },
          "25%": { transform: "translateX(-5px)" },
          "75%": { transform: "translateX(5px)" },
        },
        "particle-float": {
          "0%": { opacity: "1", transform: "translate(0, 0) scale(1)" },
          "100%": { opacity: "0", transform: "translate(var(--x), -20px) scale(0.5)" },
        },
        "confetti-fall": {
          "0%": { transform: "translateY(-100vh) rotate(0deg)", opacity: "1" },
          "100%": { transform: "translateY(100vh) rotate(720deg)", opacity: "0" },
        },
        "victory-bounce": {
          "0%, 100%": { transform: "scale(1) translateY(0)" },
          "25%": { transform: "scale(1.1) translateY(-10px)" },
          "50%": { transform: "scale(0.95) translateY(5px)" },
          "75%": { transform: "scale(1.05) translateY(-5px)" },
        },
        "pulse-glow": {
          "0%, 100%": { opacity: "1", boxShadow: "0 0 10px currentColor" },
          "50%": { opacity: "0.7", boxShadow: "0 0 20px currentColor, 0 0 30px currentColor" },
        },
        "slide-in-up": {
          from: { transform: "translateY(20px)", opacity: "0" },
          to: { transform: "translateY(0)", opacity: "1" },
        },
        "slide-in-down": {
          from: { transform: "translateY(-20px)", opacity: "0" },
          to: { transform: "translateY(0)", opacity: "1" },
        },
        "fade-in": {
          from: { opacity: "0" },
          to: { opacity: "1" },
        },
        "float-3d": {
          "0%, 100%": { transform: "translate3d(0, 0, 0) rotate(0deg)" },
          "25%": { transform: "translate3d(20px, -20px, 20px) rotate(5deg)" },
          "50%": { transform: "translate3d(-10px, -40px, 10px) rotate(-5deg)" },
          "75%": { transform: "translate3d(-20px, -20px, 30px) rotate(3deg)" },
        },
      },
      transitionTimingFunction: {
        micro: "cubic-bezier(0.4, 0, 0.2, 1)",
        page: "cubic-bezier(0.4, 0, 0.2, 1)",
        spring: "cubic-bezier(0.68, -0.55, 0.265, 1.55)",
      },
      transitionDuration: {
        micro: "150ms",
        page: "300ms",
        typing: "50ms",
        victory: "800ms",
      },
      boxShadow: {
        "neon-cyan": "0 0 20px rgba(0, 255, 255, 0.5), 0 0 40px rgba(0, 255, 255, 0.3)",
        "neon-magenta": "0 0 20px rgba(255, 0, 255, 0.5), 0 0 40px rgba(255, 0, 255, 0.3)",
        "neon-lime": "0 0 20px rgba(0, 255, 0, 0.5), 0 0 40px rgba(0, 255, 0, 0.3)",
        "neon-red": "0 0 20px rgba(255, 0, 64, 0.5), 0 0 40px rgba(255, 0, 64, 0.3)",
      },
    },
  },
  plugins: [],
};
export default config;
