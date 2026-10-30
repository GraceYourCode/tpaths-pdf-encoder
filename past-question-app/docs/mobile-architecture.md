# Mobile architecture

The uploaded source was an Expo Router starter using Expo SDK 57 and React Native 0.86.3. The existing Expo Router, theme primitives, TypeScript setup and Expo dependency versions were retained. The starter Home/Explore content was replaced with Tpaths product flows rather than adding a second navigation system.

Routes:
- `/onboarding`
- `/(auth)/login`
- `/(auth)/register`
- `/(auth)/verify`
- `/(app)/` Home
- `/(app)/library` Library
- `/(app)/activate` Activation
- `/product/[id]` Product details
- `/reader` Secure reader

Central services live in `src/api`, `src/auth`, `src/security`, and `src/storage`.
