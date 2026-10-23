# Localization

The first release is Arabic-first and uses explicit RTL layout styles so the interface remains predictable across Android and iOS. Arabic copy is centralized in `ar.ts`.

When adding another locale:

1. Add a typed translation object matching `ar`.
2. Select the locale at the application boundary; do not branch on language inside visual components.
3. Keep accessibility labels translated and test long text on small screens.
4. Keep server-owned statuses and errors mapped to safe user-facing copy.
