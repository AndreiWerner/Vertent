/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        // Paleta derivada da identidade já usada no app mobile
        // (o #2C6E49 é literalmente a cor do título/botão de login do app).
        vertente: {
          dark: "#1B4332",
          DEFAULT: "#2C6E49",
          medium: "#52796F",
          light: "#95D5B2",
          bg: "#F4F6F8",
          ink: "#16241C",
        },
      },
      fontFamily: {
        display: ["'Space Grotesk'", "sans-serif"],
        sans: ["'Inter'", "sans-serif"],
      },
      boxShadow: {
        soft: "0 8px 24px -8px rgba(27, 67, 50, 0.16)",
        card: "0 2px 10px -2px rgba(22, 36, 28, 0.08)",
      },
      borderRadius: {
        xl2: "1.25rem",
      },
    },
  },
  plugins: [],
};
