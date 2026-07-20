// Main store exports
// NOTE: authStore.ts is a legacy Zustand store that is NOT used in production.
// The real auth state lives in core/AuthContext.tsx (React Context).
// The authStore.test.ts exists solely for testing the store itself.
export { useAppStore } from './appStore';
