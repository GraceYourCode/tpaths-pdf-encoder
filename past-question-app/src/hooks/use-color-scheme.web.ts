import { useColorScheme as useRNColorScheme } from 'react-native';

/**
 * The web implementation uses the native color-scheme hook directly.
 * Returning a deterministic fallback keeps the hook safe during static rendering.
 */
export function useColorScheme() {
  return useRNColorScheme() ?? 'light';
}
