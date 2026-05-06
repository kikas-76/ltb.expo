// Platform-resolution fallback for TypeScript. Metro picks
// HandoverQRScanner.web.tsx on web and HandoverQRScanner.native.tsx on
// iOS/Android, so this module is never executed at runtime.
export { default } from './HandoverQRScanner.web';
