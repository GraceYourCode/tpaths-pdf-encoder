# Tpaths mobile app

Secure React Native / Expo Router client for the Tpaths paid past-question platform.

## Existing architecture retained

The uploaded source was an Expo SDK 57 / React Native 0.86.3 TypeScript Expo Router starter. The implementation keeps Expo Router, TypeScript, the existing theme primitives, Expo package family, and app configuration approach. The starter screens were replaced with the Tpaths flow rather than introducing a second navigation/state system.

## Configuration

Copy `.env.example` to `.env` and set:

```text
EXPO_PUBLIC_API_URL=https://your-api-host
EXPO_PUBLIC_WEBSITE_URL=https://your-website-host
```

These are public client values. Never put database passwords, payment secrets, storage credentials, JWT signing secrets, or the document master encryption key in this app.

## Install/build

Dependency installation could not be completed in the isolated build environment because npm registry DNS/network access was unavailable. After network access is available:

```bash
npm install
npm run test
npm run typecheck
npm run lint
npx expo start
```

The PDF renderer is `react-native-pdf-jsi` and requires an Expo development/production native build; Expo Go is not sufficient. After dependencies are installed, use the project's EAS development profile or `npx expo run:android` / `npx expo run:ios`.

## Backend

See:

- `docs/mobile-architecture.md`
- `docs/mobile-auth-flow.md`
- `docs/mobile-document-security.md`
- `docs/mobile-backend-gaps.md`
