import {router} from 'expo-router';

type Route = string | {pathname: string; params?: Record<string, string>};

type Navigation = {
  push: (route: Route) => void;
  replace: (route: Route) => void;
  back: () => void;
};

// Expo Router's generated Href union can become stale when routes are generated
// outside the TypeScript process. Runtime routing still accepts these paths.
// Keep the escape hatch isolated to this module instead of weakening route types
// throughout the app.
export const nav = router as unknown as Navigation;
