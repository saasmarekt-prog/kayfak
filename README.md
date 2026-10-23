# كيفك | Kayfak

An Arabic-first Expo / React Native foundation for a social audio community app.

## Current scope

- RTL-oriented Arabic discovery screen
- Category filters for social rooms, stories, games, and communities
- Responsive room cards and bottom navigation
- Clear UI notices for features not connected yet
- TypeScript strict mode and environment-variable template

## Not implemented yet

This repository starter is **not production-ready** and does not yet include:
- Supabase authentication or database access
- Live audio rooms
- Server-side room membership/capacity enforcement
- Story engine or trusted vote validation
- Moderation/admin backend
- Payments, digital gifts, or subscriptions
- Automated tests or release signing

Room cards are local preview content only. Do not represent them as live users or real rooms.

## Run locally

Requirements: Node.js LTS and npm.

```bash
npm install
npm run typecheck
npx expo start
```

To open on Android, install Expo Go on the device and scan the QR code from the Expo development server. A phone-only workflow may use a cloud development environment such as GitHub Codespaces, subject to availability and plan limits.

## Environment

Copy `.env.example` to `.env` only after creating a Supabase project. Mobile-client variables must contain only the project URL and publishable/anon key. Never place a Supabase `service_role` key in this app.

## Next implementation milestones

1. Create Supabase project and apply a reviewed migration.
2. Add Supabase client and auth screens.
3. Add database-backed room discovery and transactional room join/leave operations.
4. Integrate a real-time audio provider and server-issued room tokens.
5. Add story sessions and server-validated votes.
6. Add moderation workflows, security tests, observability, and release checks.
