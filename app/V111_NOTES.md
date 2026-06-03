# FTV Dashboard v111

Base: v110 analytics mapping token diagnostic app root.

Corrections v111:
- Bump `CACHE_SCHEMA_VERSION` to `v111` to avoid stale snapshot schema.
- Analytics remains server-managed via `YOUTUBE_REFRESH_TOKEN`; client token legacy path is no longer required.
- Safer Analytics fetch timeout for browser compatibility.
- Removed duplicated identical retry on video chunk Analytics requests; errors now identify the failing chunk.
- Fallback Analytics channel selection can use server health `resolvedDashboardChannels`.
- OAuth callback now explicitly warns when Google does not return a `refresh_token`.
- Admin status / Analytics health expose `version: v111`.

Deploy from this folder's `app` root on Vercel, or upload the zip contents preserving the `api/`, `public/`, `supabase/` structure.
