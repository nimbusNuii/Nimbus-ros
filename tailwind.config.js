/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/lib/**/*.{js,ts,jsx,tsx,mdx}"
  ],
  theme: {
    extend: {
      colors: {
        app: {
          bg: "var(--bg)",
          surface: "var(--surface)",
          line: "var(--line)",
          text: "var(--text)",
          muted: "var(--muted)",
          brand: "var(--brand)"
        }
      }
    }
  },
  plugins: []
};
