import { registerRootComponent } from 'expo';

import App from './App';

// Suppress known third-party warnings from React Native Web console
const originalConsoleError = console.error;
console.error = (...args) => {
  if (typeof args[0] === 'string' && (
    args[0].includes('Invalid DOM property') ||
    args[0].includes('Unknown event handler property') ||
    args[0].includes('React does not recognize the')
  )) {
    return;
  }
  originalConsoleError(...args);
};

const originalConsoleWarn = console.warn;
console.warn = (...args) => {
  if (typeof args[0] === 'string' && (
    args[0].includes('TouchableMixin is deprecated') ||
    args[0].includes('props.pointerEvents is deprecated') ||
    args[0].includes('"shadow*" style props are deprecated') ||
    args[0].includes('Animated: `useNativeDriver` is not supported')
  )) {
    return;
  }
  originalConsoleWarn(...args);
};

// registerRootComponent calls AppRegistry.registerComponent('main', () => App);
// It also ensures that whether you load the app in Expo Go or in a native build,
// the environment is set up appropriately
registerRootComponent(App);
