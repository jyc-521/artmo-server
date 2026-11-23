# ARTMO Role & Endpoint Matrix

Source of truth: `docs/PRD.md` section 5-3. Update both together.

| Method & Path | Guard | Anonymous | User | Admin | Notes |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `GET /health` | none | `200` | `200` | `200` | `{ status: "ok" }` |
| `GET /api/auth/providers` | none | `200` | `200` | `200` | `Cache-Control: no-store` |
| `GET /api/auth/me` | isAuthenticated | `401` | `200` | `200` | `{ success: true, data }` |
| `GET /api/users/profile` | isAuthenticated | `401` | `200` | `200` | own profile |
| `PUT /api/users/profile` | isAuthenticated | `401` | `200` | `200` | `name`, `avatar` only |
| `DELETE /api/users/account` | isAuthenticated | `401` | `200` | `200` | `409` on `LAST_ADMIN` |
| `GET /api/users/all` | isAuthenticated → requireAdmin | `401` | `403` | `200` | |
| `PUT /api/users/:userId/type` | isAuthenticated → requireAdmin | `401` | `403` | `200` | `409` on `LAST_ADMIN` |
| `POST /api/recommendations` | optionalAuth + daily limit | `201` (3/day per IP) | `201` (10/day) | `201` (10/day) | `429` over limit; `400` bad sentence; `200 { data: { needsMoreDetail, hint } }` when vague |
| `GET /api/recommendations/:id` | optionalAuth | `200` | `200` | `200` | input sentence only to owner or via share link |
| `GET /api/recommendations/me` | isAuthenticated | `401` | `200` own | `200` own | |
| `POST /api/recommendations/:id/share` | none | `204` | `204` | `204` | increments `shared_count` |
| `GET /api/artworks` · `/popular` · `/tags` · `/:id` | none | `200` | `200` | `200` | visible artworks only; `/tags` = allowed emotion tags |
| `GET /api/artworks/:id/image` | none | `200` | `200` | `200` | share-card image proxy; host allowlist (Met, AIC, Supabase), no redirects, image/* ≤8MB; `404` outside allowlist, `502` upstream failure |
| `GET /api/artworks/saved` | isAuthenticated | `401` | `200` own | `200` own | saved artworks of `req.auth` |
| `POST /api/artworks` | isAuthenticated → requireAdmin | `401` | `403` | `201` | |
| `PUT /api/artworks/:id` | isAuthenticated → requireAdmin | `401` | `403` | `200` | |
| `DELETE /api/artworks/:id` | isAuthenticated → requireAdmin | `401` | `403` | `204` | |
| `POST /api/artworks/:id/save` | isAuthenticated | `401` | `201` | `201` | once per user |
| `DELETE /api/artworks/:id/save` | isAuthenticated | `401` | `204` | `204` | |
| `POST /api/sponsorships` | isAuthenticated | `401` | `201` | `201` | `400` without `license_agreed` |
| `GET /api/sponsorships/me` | isAuthenticated | `401` | `200` own | `200` own | |
| `GET /api/sponsorships` | isAuthenticated → requireAdmin | `401` | `403` | `200` | optional `status` filter |
| `POST /api/sponsorships/:id/approve` | isAuthenticated → requireAdmin | `401` | `403` | `200` | idempotent RPC |
| `PUT /api/sponsorships/:id` | isAuthenticated → requireAdmin | `401` | `403` | `200` | reject |

Middleware contract: invalid token `401` (also under `optionalAuth`), missing or inactive profile `403`, Auth outage `503`. `notFound` then `errorHandler` are mounted last.
