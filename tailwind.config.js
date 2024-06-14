module.exports = {
  content: ['*.{html,js}', 'src/**/*.{html,js}'],
  theme: {
    extend: {
      fontWeight: {
        normal: '300'
      },
      colors: {
        black: '#222222',
        'dark-grey': '#303030',
        blue: '#2357cd'
      }
    },
    fontFamily: {
      sans: ['-apple-system', 'BlinkMacSystemFont', 'Helvetica Neue', 'Segoe UI', 'sans-serif']
    }
  }
};
