# FRAME — Design System

## Brand
- **Nome:** FRAME
- **Tagline:** Il tuo studio digitale
- **Target:** Fotografi e videomaker professionisti (IT)

## Colori
```
--bg-base:       #0a0a0a      /* sfondo principale */
--bg-surface:    #111111      /* card, sidebar */
--bg-elevated:   #1a1a1a      /* hover, dropdown */
--border:        rgba(255,255,255,0.08)
--border-focus:  rgba(245,166,35,0.5)
--text-primary:  #f5f5f5
--text-secondary:#a0a0a0
--text-muted:    #555555
--accent:        #F5A623      /* ambra — CTA, badge, highlights */
--accent-dim:    rgba(245,166,35,0.15)
--accent-glow:   rgba(245,166,35,0.3)
--danger:        #ef4444
--success:       #22c55e
--warning:       #f59e0b
```

## Tipografia
- **Font:** Poppins (Google Fonts) — import in styles.css
- **Display (h1):** 600–700, 2.5–3.5rem, tight tracking
- **Heading (h2–h3):** 600, 1.25–1.75rem
- **Body:** 400, 0.875–1rem, line-height 1.6
- **Caption/Label:** 500, 0.75rem, uppercase tracking-wide per le etichette

## Layout
- **Sidebar:** 240px fissa, bg-surface, bordo destro border
- **Content area:** padding 24–32px, max-width 1400px
- **Card:** bg-surface, border border, border-radius 12px, padding 20–24px
- **Gap standard:** 16px (sm), 24px (md), 32px (lg)

## Componenti chiave
- **Badge status:** pillola small, colori semantici (giallo=pending, verde=done, rosso=cancelled)
- **Button primario:** bg-accent text-black font-600, hover brightness-110
- **Button secondario:** bg-transparent border border text-primary, hover bg-elevated
- **Input:** bg-bg-base border border, focus border-focus, border-radius 8px
- **Avatar:** cerchio 32px, bg-accent-dim testo iniziali ambra
- **Kanban card:** bg-surface hover bg-elevated, drag handle, priority dot

## Motion
- Page load: fade-in + translateY(8px) → 0, stagger 60ms per child
- Sidebar item hover: bg transition 150ms
- Modal: scale(0.96)→1 + opacity 0→1, 200ms

## Patterns anti da evitare
- NO gradiente purple su bianco
- NO card rotonde con ombra azzurra
- NO Inter/Roboto come font principale
- NO layout simmetrici e prevedibili
