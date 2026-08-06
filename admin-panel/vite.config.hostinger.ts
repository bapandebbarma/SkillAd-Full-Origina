/**
 * Legacy Hostinger alias — same production API base as vite.config.ts.
 * Prefer: pnpm build  (output: dist/)
 *
 * Note: the former hostinger-only entry swap is no longer required;
 * App.tsx already uses Router base="/admin".
 */
export { default } from "./vite.config";
