# Changelog

All notable changes to this project will be documented in this file.

## [Unreleased]

### Added
- **Preventivi (Quotes) — PDF generation**: generate a professional white/branded PDF for any quote via `GET /api/quotes/:id/pdf`. Uses Puppeteer Core + Chrome, includes tenant logo, client info, line items table, totals, intro/closing text, validity date and notes.
- **Preventivi — Edit modal**: clicking an existing quote opens a full edit form with all fields (items, tax rate, status, intro text, closing text, validity date, notes).
- **Preventivi — Intro & closing text**: `introText` and `closingText` long-text fields added to quotes schema and surfaces in the create/edit form and in the generated PDF.
- **Preventivi — Validity date**: `validUntil` date field added to quotes schema and form; shown in PDF footer.
- **Preventivi — PDF download button**: each quote row in the list has a download button (↓ icon); PDF download also available inside the edit modal.
- **Prenotazioni (Bookings)**: full booking management page with create/edit/delete, service type, notes, status workflow.
- **Booking public page**: public-facing booking form (`/booking/:tenantSlug`) clients can use to request a session.
- **Google Calendar integration** (`lib/gcal.ts`): helper to create/update/delete calendar events via OAuth tokens stored per tenant.
- **Email notifications** (`lib/email.ts`): Resend-based transactional email helper; fires on quote status change draft→sent.
- **Clienti (Clients) routes**: CRUD API for clients with tenant isolation.
- **Contratti (Contracts) routes**: CRUD API for contracts linked to clients.
- **Impostazioni (Settings) page**: tenant profile editor — name, logo upload, contact info, SMTP/email settings.
- **Sidebar navigation**: new entries for Prenotazioni, Preventivi, Contratti.

### Changed
- **Schema**: `quotes` table extended with `introText`, `closingText`, `validUntil` columns (migration applied via `db:push`).
- **Server**: index.ts registers all new route groups (quotes, clients, contracts, bookings).
- **Vite config**: updated aliases and optimizeDeps.
- **App router** (`app.tsx`): new pages wired into client-side router.

### Fixed
- Server port fallback 8080 to match `website.config.json`.
- Include tenant in shared video response; remove checksum from presigned GET URLs.
- Modal div structure — replace file + footer inside `p-5` container.

---

## [0.1.0] — Initial release

- Video portal with gallery, watermark, download HD toggle.
- R2 storage for videos and images.
- Shared video public links with access gate.
- Tenant-scoped authentication.
