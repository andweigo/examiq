module.exports = {
  presets: ['module:@react-native/babel-preset'],
  plugins: [
    [
      'module-resolver',
      {
        root: ['./'],
        extensions: ['.ios.js', '.android.js', '.js', '.ts', '.tsx', '.json'],
        alias: {
          '@app': './src/app',
          '@assets': './src/assets',
          '@core': './src/core',
          '@domain': './src/domain',
          '@data': './src/data',
          '@engines': './src/engines',
          '@services': './src/services',
          '@context': './src/context',
          '@hooks': './src/hooks',
          '@navigation': './src/navigation',
          '@components': './src/components',
          '@screens': './src/screens',
          '@theme': './src/theme',
          '@constants': './src/constants',
          '@utils': './src/utils',
        },
      },
    ],
  ],
};
