<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

## Architecture rules
- No Lovable Cloud/Supabase: all data goes through `src/lib/api/client.ts` to an external REST API (`VITE_API_BASE_URL/api/v1`); keeps backend swappable.
- Each feature lives in `src/modules/<name>/` with an `api.ts` of TanStack Query hooks; routes in `src/routes` stay thin.
- Brand name/logo/colors only come from `src/config/brand.tsx`; nothing else hardcodes the product name.
- Demo data exists only in `src/lib/api/demo.ts`, loaded when `VITE_ENABLE_DEMO_MODE=true`; never show fictitious coordinates otherwise.
- Maps go through `src/modules/maps/map-view.tsx` (provider abstraction, Leaflet lazy-loaded client-side); sensors through `SensorProvider`.
- Auth is client-side (access token in memory, refresh token in localStorage), so protected screens render guards client-side via `RequireAuth`.
- Endpoints consumed are documented in `docs/FRONTEND_CONTRACTS.md`; update it when adding calls.
