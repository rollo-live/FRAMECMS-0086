# FRAME — Prompt completo dell'applicazione

Crea un'applicazione web SaaS multi-tenant per fotografi e videomaker professionisti chiamata **FRAME**. L'app gestisce l'intero flusso di lavoro di uno studio fotografico: dai clienti ai preventivi, contratti, progetti, gallerie, video, prenotazioni e contabilità.

---

## Stack tecnico

- **Frontend**: React 19, React Router, TanStack Query, Tailwind CSS, shadcn/ui
- **Backend**: Hono (API REST), Bun runtime
- **Database**: Turso (libsql remoto), Drizzle ORM
- **Storage**: Cloudflare R2 (compatibile S3) per foto e video
- **Auth**: better-auth con sessioni cookie
- **Pagamenti**: Autumn.js
- **Email**: Nodemailer

---

## Architettura multi-tenant

Ogni studio è un **tenant** isolato. L'owner crea il tenant durante l'onboarding (nome, slug, colore brand, logo). Tutti i dati (clienti, gallerie, ecc.) sono filtrati per `tenantId`. I membri del team condividono lo stesso tenant.

---

## 1. Autenticazione e onboarding

- Login/registrazione via email e password (better-auth)
- Dopo il primo login, se l'utente non ha un tenant viene reindirizzato all'**onboarding**: inserisce nome dello studio, slug univoco, colore brand primario
- Il sistema crea il tenant e il profilo utente con ruolo `owner`

---

## 2. Dashboard

Pagina principale con panoramica dello studio:
- Contatori rapidi: clienti totali, progetti attivi, gallerie recenti, prenotazioni in attesa
- Accesso rapido alle sezioni principali
- Notifiche prenotazioni pendenti

---

## 3. Clienti (CRM)

Gestione di clienti e lead:
- Lista con ricerca, filtro per tipo (`client` / `lead`) e stato (`active` ecc.)
- CRUD completo: nome, email, telefono, azienda, note, tag
- Cambio tipo (lead → cliente)
- Generazione di un **token di accesso cliente** (link unico per il portale cliente)
- Il token permette al cliente di accedere al portale senza account

---

## 4. Preventivi

Creazione e gestione preventivi:
- Numero automatico progressivo
- Associato a un cliente
- Righe voci con descrizione, quantità, prezzo unitario
- Calcolo automatico subtotale, IVA (aliquota configurabile), totale
- Testo introduttivo e testo di chiusura personalizzabili
- Note interne
- Stati: `draft` → `sent` → `accepted` / `rejected`
- **Invio via email** al cliente con link al portale
- **Esportazione PDF** generata server-side con Puppeteer (layout professionale con logo studio, dati cliente, tabella voci)
- Il cliente può accettare o rifiutare dal portale

---

## 5. Contratti

Gestione contratti con firma digitale:
- Associati a un cliente (e opzionalmente a un preventivo)
- Editor testo libero per il corpo del contratto
- Stati: `draft` → `sent` → `signed` / `cancelled`
- Generazione **link di firma unico** (share token)
- Pagina pubblica di firma: il cliente legge il contratto, inserisce nome e firma con campo di testo
- Al momento della firma vengono registrati: timestamp, IP del firmatario, nome dichiarato, email
- Notifica email all'owner alla firma
- Visualizzazione firma nel pannello admin

---

## 6. Progetti

Gestione progetti fotografici/video:
- Tipi: `photo` / `video` / `photo_video`
- Stati: `planning` → `active` → `in_review` → `completed` → `archived`
- Associati a cliente e opzionalmente a un contratto
- Campi: nome, date inizio/fine, location, note
- **Kanban task board** integrata per ogni progetto:
  - Colonne: `todo` / `doing` / `review` / `done`
  - Task con titolo, descrizione, priorità (`low` / `medium` / `high`), assegnatario, data scadenza
  - Drag & drop per spostare task tra colonne e riordinare
- Accesso diretto alle gallerie e video collegati al progetto

---

## 7. Gallerie fotografiche

Sistema completo di delivery fotografica:

### Admin
- Crea gallerie (collegate opzionalmente a un progetto)
- Upload foto direttamente in-app via presigned URL su R2 (upload multi-file, progress bar)
- Reorder foto tramite drag & drop
- Elimina singole foto o tutta la galleria
- Genera link condivisione pubblica (share token)

### Impostazioni galleria
- **Watermark**: abilita/disabilita watermark sulle foto
- **Download**: abilita/disabilita download con o senza watermark
- **Access gate**: richiedi registrazione del visitatore (nome, cognome, email)
- **Approvazione accesso**: automatica o manuale
- **Like limit**: numero massimo di like che un visitatore può esprimere (0 = illimitato)

### Vista pubblica (cliente)
- Pagina pubblica accessibile via link con share token
- Se access gate attivo: form di registrazione → email di conferma → accesso
- Se approvazione manuale: lo studio approva/rifiuta dal pannello accessi
- Visualizzazione foto in griglia/lightbox
- Like per foto (con contatore, rispetta il limite impostato)
- Commenti pubblici su singole foto
- Download foto (se abilitato)

### Pannello accessi (admin)
- Lista visitatori che hanno richiesto accesso
- Approva o rifiuta singolarmente
- Vedi data/ora richiesta

### Commenti admin
- L'admin può aggiungere commenti interni sulle foto
- Risolvi/de-risolvi commenti

### Face recognition — Persone
- Route `/gallery/persone` con lista di tutte le persone riconosciute nelle foto
- Analisi AI dei volti: endpoint `POST /:id/photos/analyze` che:
  - Scarica le foto da R2
  - Usa `@vladmandic/human` + `@tensorflow/tfjs-node` per estrarre embedding facciali (128 dimensioni)
  - Raggruppa i volti per similarità coseno (threshold 0.6) → crea o aggiorna una "persona"
  - Salva embedding medio per ogni persona
- Lista persone con: nome (modificabile), numero foto, foto di copertina
- Vista foto per persona
- Elimina persona (con de-tagging delle foto)
- Collega/scollega manualmente una persona da una foto
- Flag `visibileASoci` per esposizione nel portale

---

## 8. Video

Sistema di delivery e review video:

### Admin
- Upload video su R2 via presigned URL
- Versioning: ogni video ha una versione (`v1`, `v2`, `final`)
- Impostazioni: download abilitato, watermark testo
- Genera link condivisione pubblico

### Vista pubblica (cliente)
- Player video nativo
- **Commenti a timecode**: il cliente clicca sul video (o usa il campo timecode) e lascia un commento in quel punto preciso
- I commenti mostrano il timecode nel player
- Identificazione cliente tramite token portale

### Admin — gestione commenti
- Lista commenti con timecode
- Segna come risolto/da fare

---

## 9. Prenotazioni

Sistema di booking online per i clienti:

### Form pubblico (link per tenant: `/booking/:tenantSlug`)
- Il cliente compila: nome, cognome, email, telefono
- Tipo evento: battesimo, compleanno, matrimonio, shooting aziendale, conferenza, altro (custom)
- Servizi desiderati: foto, video, stampe live (multi-selezione)
- Data e ora evento, location, note
- Submit → richiesta creata in stato `pending`

### Admin
- Lista prenotazioni con filtri per stato
- Vista dettaglio prenotazione
- **Approva**: manda email di conferma al cliente + crea automaticamente evento su Google Calendar (se connesso)
- **Rifiuta**: manda email di rifiuto al cliente
- Elimina prenotazione

### Google Calendar OAuth
- Connetti Google Calendar dal pannello prenotazioni
- OAuth2 flow: redirect → callback → salva access/refresh token
- Auto-refresh token scaduto
- Disconnetti integrazione
- Visualizzazione stato connessione

### Controllo disponibilità
- Endpoint pubblico `GET /public/:tenantSlug/busy` che restituisce le date già occupate (prenotazioni approvate) — usato per disabilitare date nel calendario del form booking

---

## 10. Contabilità

Modulo contabilità per studio con due soci (Alessio e Gianluca):

### Impostazioni
- Nomi dei due soci configurabili
- Aliquota accantonamento (%)
- Base imponibile forfettario (%)

### Entrate
- CRUD entrate: descrizione, importo, data, categoria, beneficiario (`socio_a` / `socio_b` / `split` = diviso tra i due)
- Flag fattura emessa
- Note

### Uscite
- CRUD uscite: descrizione, importo, data, categoria
- Flag "divisi per metà" tra i soci
- Campo "pagato da": socio A, socio B, studio

### Riepilogo
- Per ogni socio:
  - Entrate lorde di competenza
  - Imponibile forfettario (applicando la percentuale configurata)
  - Accantonamento tasse
  - Netto disponibile
  - Quota uscite a carico
  - **Saldo netto finale**
- Saldo debito/credito tra i due soci (chi deve quanto a chi)
- Grafici trend mensile entrate/uscite

### Pareggi
- Registra pagamenti tra soci per pareggiare il saldo
- Tipi: pagamento diretto, sconto su entrata
- Storico pareggi

---

## 11. Portale cliente

Pagina privata accessibile dal cliente tramite il suo token personale:
- Verifica token → carica dati cliente e tenant
- Lista progetti collegati al cliente
- Da ogni progetto: accesso a gallerie e video
- Può accettare/rifiutare preventivi
- Può firmare contratti
- Personalizzazione brand (colore primario, logo dello studio)

---

## 12. Team

Gestione membri del team:
- Lista membri con nome, email, ruolo
- **Invita membro** via email: genera token univoco, manda email con link
- Il link porta alla pagina di accettazione (`/accept-invite`): l'utente si registra o fa login e viene aggiunto al tenant
- Rimuovi membro
- Revoca invito

---

## 13. Impostazioni studio

- Modifica nome studio, slug
- Upload logo (su R2)
- Colore brand primario (color picker)
- Informazioni account (email, cambio password)

---

## UI / UX

- **Sidebar** di navigazione con icone e label per tutte le sezioni
- Badge con contatore prenotazioni pendenti sulla voce "Prenotazioni"
- Layout responsive
- Ogni pagina ha lazy loading con Suspense
- Toast notification per feedback azioni
- Modal per form di creazione/modifica
- Tabelle con ricerca e filtri inline
- Skeleton loader durante il caricamento dati
- Colore brand dinamico applicato dal tenant (CSS variable)

---

## Performance

- React Query con `staleTime: 30s`, `refetchOnWindowFocus: false`
- Query Turso ottimizzate: nessun N+1, batch con `inArray` e `groupBy`
- Cache in-memory delle presigned URL R2 (TTL 50min)
- Cache in-memory del `tenantId` per userId (TTL 5min)
- Lazy import di `@vladmandic/human` (evita caricamento TF.js all'avvio)

---

## Database (Turso/libsql, Drizzle ORM)

Tabelle principali:
`tenants`, `user_profiles`, `clients`, `client_tokens`, `quotes`, `contracts`, `projects`, `tasks`, `team_invites`, `galleries`, `gallery_access`, `photos`, `photo_comments`, `videos`, `video_comments`, `appointments`, `google_calendar_tokens`, `contabilita_settings`, `entrate`, `uscite`, `pareggi`, `face_persone`, `foto_persone`
