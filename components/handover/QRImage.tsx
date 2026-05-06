// Platform-resolution fallback for TypeScript. Metro picks
// QRImage.web.tsx on web and QRImage.native.tsx on iOS/Android; this
// module is never executed at runtime.
export { default } from './QRImage.web';
