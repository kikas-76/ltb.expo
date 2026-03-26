const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const config = getDefaultConfig(__dirname);

config.resolver.resolverMainFields = [
  'react-native',
  'browser',
  'main',
];

config.resolver.extraNodeModules = {
  '@stripe/stripe-js': path.resolve(__dirname, 'node_modules/@stripe/stripe-js'),
  '@stripe/react-stripe-js': path.resolve(__dirname, 'node_modules/@stripe/react-stripe-js'),
};

module.exports = config;
