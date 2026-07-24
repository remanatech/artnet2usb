/** Relackout design language — same palette. */
export default {
  content: ['./src/**/*.{ts,tsx,html}'],
  theme: {
    extend: {
      colors: {
        primary: '#25b9f4',
        'background-dark': '#101d22',
        'surface-dark': '#182c34',
        'border-dark': '#223e49'
      },
      fontFamily: {
        display: ['Space Grotesk', 'sans-serif']
      }
    }
  },
  plugins: []
}
