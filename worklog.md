---
Task ID: 1
Agent: Main Agent
Task: Fix sign-in "failed to fetch" error and add page-specific 3D background animations

Work Log:
- Identified the "failed to fetch" error was caused by NextAuth `signIn('credentials')` blocking the auth flow
- Simplified the login flow: verify API is now primary auth, NextAuth session is fire-and-forget
- Fixed double SessionProvider (was in both layout.tsx via AuthProvider and page.tsx via SessionProvider)
- Removed redundant ParticleBackground in favor of new SecurityBackground3D component
- Created SecurityBackground3D component with 5 unique page-specific 3D backgrounds
- Added new CSS animations for 3D backgrounds (radar-sweep, data-flow, matrix-rain, cube-rotate, etc.)
- Cleaned up test users from database, kept only abc@gmail.com
- Reduced Prisma logging from ['query'] to ['warn', 'error'] for better server stability

Stage Summary:
- Auth flow now works: verify API returns correct results for valid/invalid credentials
- Server is stable with reduced Prisma logging
- 5 page-specific 3D backgrounds created: Auth (shields+locks), Landing (globe network), Loading (radar scanner), Dashboard (data matrix cube), History (archive timeline)
- Each background has large, immersive 3D security-themed animations with smooth transitions between pages
