module.exports = {
  content: [
    "./*.html",
    "./*.js",
    "./src/**/*.{html,js}"
  ],
  theme: {
    extend: {},
  },
  plugins: [
    require('daisyui')
  ],
  daisyui: {
    themes: ["light", "dark", "cupcake"],
  },
}
