module.exports = {
  content: ['./_includes/*.html', './_layouts/*.html', '_posts/*.{md,html}', './index.html', '404.html', 'assets/js/*.js', 'assets/css/*.css'],
  theme: {
    extend: {
      fontWeight: {
        normal: '300'
      },
      colors: {
        black: '#222222',
        'dark-grey': '#303030',
        blue: '#2357cd',
        tan: '#f8f5ee',
        'dark-green': '#0f3602'
      },
      letterSpacing: {
        wide: '0.015em'
      }
    },
    fontFamily: {
      sans: ['-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'Oxygen', 'Ubuntu', 'Cantarell', 'Open Sans', 'Helvetica Neue', 'sans-serif'],
      title: ['Inconsolata', 'Helvetica', 'sans-serif'],
      mono: ['Inconsolata', 'ui-monospace']
    }
  }
}
