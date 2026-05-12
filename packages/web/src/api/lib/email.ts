import nodemailer from "nodemailer";
import ical, { ICalCalendarMethod } from "ical-generator";

const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.GMAIL_USER ?? "",
    pass: process.env.GMAIL_APP_PASSWORD ?? "",
  },
});

export async function sendEmail(opts: {
  to: string;
  subject: string;
  html: string;
  attachments?: nodemailer.Attachment[];
}) {
  await transporter.sendMail({
    from: `"FRAME" <${process.env.GMAIL_USER}>`,
    to: opts.to,
    subject: opts.subject,
    html: opts.html,
    attachments: opts.attachments,
  });
}

function baseTemplate(content: string): string {
  return `
<!DOCTYPE html>
<html lang="it">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <style>
    body { margin: 0; padding: 0; background: #0a0a0a; font-family: 'Helvetica Neue', Arial, sans-serif; }
    .container { max-width: 580px; margin: 40px auto; background: #111; border-radius: 16px; overflow: hidden; border: 1px solid rgba(255,255,255,0.08); }
    .header { background: #111; padding: 32px 40px 24px; border-bottom: 1px solid rgba(255,255,255,0.06); }
    .logo { display: flex; align-items: center; gap: 10px; }
    .logo-icon { width: 36px; height: 36px; background: #F5A623; border-radius: 8px; display: flex; align-items: center; justify-content: center; }
    .logo-text { font-size: 18px; font-weight: 700; color: #f5f5f5; letter-spacing: -0.5px; }
    .body { padding: 32px 40px; }
    .footer { padding: 20px 40px; border-top: 1px solid rgba(255,255,255,0.06); }
    .footer p { font-size: 12px; color: #555; margin: 0; }
    h2 { color: #f5f5f5; font-size: 20px; font-weight: 600; margin: 0 0 16px; }
    p { color: #a0a0a0; font-size: 14px; line-height: 1.6; margin: 0 0 12px; }
    .detail-box { background: #1a1a1a; border-radius: 12px; padding: 20px; margin: 20px 0; border: 1px solid rgba(255,255,255,0.06); }
    .detail-row { display: flex; justify-content: space-between; margin-bottom: 10px; }
    .detail-row:last-child { margin-bottom: 0; }
    .detail-label { color: #666; font-size: 13px; }
    .detail-value { color: #f5f5f5; font-size: 13px; font-weight: 500; text-align: right; max-width: 60%; }
    .btn { display: inline-block; background: #F5A623; color: #000 !important; font-weight: 700; font-size: 14px; padding: 12px 28px; border-radius: 10px; text-decoration: none; margin: 16px 0; }
    .badge-green { display: inline-block; background: rgba(34,197,94,0.15); color: #22c55e; font-size: 12px; font-weight: 600; padding: 4px 10px; border-radius: 6px; }
    .badge-red { display: inline-block; background: rgba(239,68,68,0.15); color: #ef4444; font-size: 12px; font-weight: 600; padding: 4px 10px; border-radius: 6px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <div class="logo">
        <div class="logo-icon" style="text-align:center;line-height:36px;font-weight:900;font-size:16px;color:#000;">F</div>
        <span class="logo-text">FRAME</span>
      </div>
    </div>
    <div class="body">
      ${content}
    </div>
    <div class="footer">
      <p>FRAME — Gestionale per fotografi professionisti</p>
    </div>
  </div>
</body>
</html>`;
}

const EVENT_TYPE_LABELS: Record<string, string> = {
  battesimo: "Battesimo",
  compleanno: "Compleanno",
  matrimonio: "Matrimonio",
  shooting_aziendale: "Shooting Aziendale",
  conferenza: "Conferenza",
  altro: "Altro",
};

const SERVICE_LABELS: Record<string, string> = {
  foto: "Fotografia",
  video: "Video",
  stampe_live: "Stampe Live",
};

function formatDate(d: Date): string {
  return d.toLocaleDateString("it-IT", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

function formatDateTime(d: Date): string {
  return d.toLocaleString("it-IT", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

// ─── OWNER NOTIFICATION ──────────────────────────────────────────────────────
export async function sendOwnerNotification(opts: {
  ownerEmail: string;
  clientName: string;
  clientEmail: string;
  clientPhone?: string | null;
  eventType: string;
  eventTypeCustom?: string | null;
  services: string[];
  eventDate: Date;
  eventLocation?: string | null;
  notes?: string | null;
  approveUrl: string;
  rejectUrl: string;
}) {
  const eventLabel =
    opts.eventType === "altro" && opts.eventTypeCustom
      ? opts.eventTypeCustom
      : EVENT_TYPE_LABELS[opts.eventType] ?? opts.eventType;

  const servicesText = opts.services.map((s) => SERVICE_LABELS[s] ?? s).join(", ");

  const html = baseTemplate(`
    <h2>Nuova richiesta di prenotazione</h2>
    <p>Hai ricevuto una nuova richiesta da <strong style="color:#f5f5f5">${opts.clientName}</strong>.</p>

    <div class="detail-box">
      <div class="detail-row">
        <span class="detail-label">Cliente</span>
        <span class="detail-value">${opts.clientName}</span>
      </div>
      <div class="detail-row">
        <span class="detail-label">Email</span>
        <span class="detail-value">${opts.clientEmail}</span>
      </div>
      ${opts.clientPhone ? `<div class="detail-row"><span class="detail-label">Telefono</span><span class="detail-value">${opts.clientPhone}</span></div>` : ""}
      <div class="detail-row">
        <span class="detail-label">Tipo evento</span>
        <span class="detail-value">${eventLabel}</span>
      </div>
      <div class="detail-row">
        <span class="detail-label">Servizi richiesti</span>
        <span class="detail-value">${servicesText || "Non specificato"}</span>
      </div>
      <div class="detail-row">
        <span class="detail-label">Data</span>
        <span class="detail-value">${formatDateTime(opts.eventDate)}</span>
      </div>
      ${opts.eventLocation ? `<div class="detail-row"><span class="detail-label">Luogo</span><span class="detail-value">${opts.eventLocation}</span></div>` : ""}
      ${opts.notes ? `<div class="detail-row"><span class="detail-label">Note</span><span class="detail-value">${opts.notes}</span></div>` : ""}
    </div>

    <p>Gestisci la richiesta direttamente dalla tua dashboard:</p>
    <a href="${opts.approveUrl}" class="btn" style="margin-right:12px">✓ Approva</a>
    <a href="${opts.rejectUrl}" style="display:inline-block;background:#1a1a1a;color:#ef4444;font-weight:700;font-size:14px;padding:12px 28px;border-radius:10px;text-decoration:none;margin:16px 0;border:1px solid rgba(239,68,68,0.3)">✗ Rifiuta</a>
  `);

  await sendEmail({
    to: opts.ownerEmail,
    subject: `📅 Nuova prenotazione da ${opts.clientName} — ${eventLabel}`,
    html,
  });
}

// ─── CLIENT CONFIRMATION (APPROVED) ─────────────────────────────────────────
export async function sendBookingConfirmation(opts: {
  clientEmail: string;
  clientName: string;
  eventType: string;
  eventTypeCustom?: string | null;
  services: string[];
  eventDate: Date;
  eventEnd: Date;
  eventLocation?: string | null;
  calendarLink?: string;
  tenantName: string;
}) {
  const eventLabel =
    opts.eventType === "altro" && opts.eventTypeCustom
      ? opts.eventTypeCustom
      : EVENT_TYPE_LABELS[opts.eventType] ?? opts.eventType;

  const servicesText = opts.services.map((s) => SERVICE_LABELS[s] ?? s).join(", ");

  // Generate .ics attachment
  const cal = ical({ name: "FRAME Prenotazione" });
  cal.method(ICalCalendarMethod.REQUEST);
  cal.createEvent({
    start: opts.eventDate,
    end: opts.eventEnd,
    summary: `${eventLabel} — ${opts.tenantName}`,
    description: `Prenotazione confermata con ${opts.tenantName}\nServizi: ${servicesText}`,
    location: opts.eventLocation ?? undefined,
    organizer: { name: opts.tenantName, email: process.env.GMAIL_USER ?? "" },
  });
  const icsContent = cal.toString();

  const html = baseTemplate(`
    <span class="badge-green">✓ Confermata</span>
    <h2 style="margin-top:16px">La tua prenotazione è confermata!</h2>
    <p>Ciao <strong style="color:#f5f5f5">${opts.clientName}</strong>, la tua richiesta è stata approvata da ${opts.tenantName}.</p>

    <div class="detail-box">
      <div class="detail-row">
        <span class="detail-label">Tipo evento</span>
        <span class="detail-value">${eventLabel}</span>
      </div>
      <div class="detail-row">
        <span class="detail-label">Servizi</span>
        <span class="detail-value">${servicesText || "Non specificato"}</span>
      </div>
      <div class="detail-row">
        <span class="detail-label">Data</span>
        <span class="detail-value">${formatDateTime(opts.eventDate)}</span>
      </div>
      ${opts.eventLocation ? `<div class="detail-row"><span class="detail-label">Luogo</span><span class="detail-value">${opts.eventLocation}</span></div>` : ""}
    </div>

    <p>Trovi allegato il file .ics per aggiungere l'evento al tuo calendario.</p>
    ${opts.calendarLink ? `<a href="${opts.calendarLink}" class="btn">Aggiungi a Google Calendar</a>` : ""}
  `);

  await sendEmail({
    to: opts.clientEmail,
    subject: `✓ Prenotazione confermata — ${eventLabel} del ${formatDate(opts.eventDate)}`,
    html,
    attachments: [
      {
        filename: "prenotazione.ics",
        content: icsContent,
        contentType: "text/calendar",
      },
    ],
  });
}

// ─── CLIENT REJECTION ────────────────────────────────────────────────────────
export async function sendBookingRejection(opts: {
  clientEmail: string;
  clientName: string;
  eventType: string;
  eventTypeCustom?: string | null;
  eventDate: Date;
  tenantName: string;
}) {
  const eventLabel =
    opts.eventType === "altro" && opts.eventTypeCustom
      ? opts.eventTypeCustom
      : EVENT_TYPE_LABELS[opts.eventType] ?? opts.eventType;

  const html = baseTemplate(`
    <span class="badge-red">Richiesta non disponibile</span>
    <h2 style="margin-top:16px">Richiesta non accettata</h2>
    <p>Ciao <strong style="color:#f5f5f5">${opts.clientName}</strong>,</p>
    <p>purtroppo ${opts.tenantName} non è disponibile per la data richiesta.</p>

    <div class="detail-box">
      <div class="detail-row">
        <span class="detail-label">Tipo evento</span>
        <span class="detail-value">${eventLabel}</span>
      </div>
      <div class="detail-row">
        <span class="detail-label">Data richiesta</span>
        <span class="detail-value">${formatDateTime(opts.eventDate)}</span>
      </div>
    </div>

    <p>Ti invitiamo a contattarci direttamente per trovare una data alternativa.</p>
  `);

  await sendEmail({
    to: opts.clientEmail,
    subject: `Richiesta di prenotazione — ${eventLabel} del ${formatDate(opts.eventDate)}`,
    html,
  });
}

// ─── PORTALE CLIENTE — link accesso ──────────────────────────────────────────
export async function sendPortalAccessEmail(opts: {
  clientEmail: string;
  clientName: string;
  tenantName: string;
  portalUrl: string;
}) {
  const html = baseTemplate(`
    <h2>Il tuo portale personale è pronto</h2>
    <p>Ciao <strong style="color:#f5f5f5">${opts.clientName}</strong>,</p>
    <p>${opts.tenantName} ti ha creato un portale personale dove puoi seguire i tuoi progetti, gallerie e documenti.</p>

    <div class="detail-box" style="text-align:center;padding:28px 20px;">
      <p style="margin:0 0 20px;color:#a0a0a0;font-size:14px;">Accedi al tuo portale con questo link — non serve password.</p>
      <a href="${opts.portalUrl}" class="btn">Accedi al portale</a>
    </div>

    <p style="font-size:12px;color:#555;margin-top:8px;">Il link è personale — non condividerlo con altri.</p>
  `);

  await sendEmail({
    to: opts.clientEmail,
    subject: `${opts.tenantName} — Il tuo portale personale`,
    html,
  });
}

// ─── PREVENTIVO INVIATO ───────────────────────────────────────────────────────
export async function sendQuoteEmail(opts: {
  clientEmail: string;
  clientName: string;
  tenantName: string;
  quoteNumber: string;
  quoteTitle: string;
  total: number;
  validUntil?: Date | null;
  portalUrl?: string | null;
}) {
  const totalFormatted = opts.total.toLocaleString("it-IT", { style: "currency", currency: "EUR" });
  const validUntilText = opts.validUntil
    ? `<div class="detail-row"><span class="detail-label">Valido fino al</span><span class="detail-value">${formatDate(opts.validUntil)}</span></div>`
    : "";

  const html = baseTemplate(`
    <h2>Hai ricevuto un preventivo</h2>
    <p>Ciao <strong style="color:#f5f5f5">${opts.clientName}</strong>,</p>
    <p>${opts.tenantName} ti ha inviato un preventivo.</p>

    <div class="detail-box">
      <div class="detail-row">
        <span class="detail-label">Numero</span>
        <span class="detail-value">${opts.quoteNumber}</span>
      </div>
      <div class="detail-row">
        <span class="detail-label">Descrizione</span>
        <span class="detail-value">${opts.quoteTitle}</span>
      </div>
      <div class="detail-row">
        <span class="detail-label">Totale (IVA incl.)</span>
        <span class="detail-value" style="color:#F5A623;font-weight:700;">${totalFormatted}</span>
      </div>
      ${validUntilText}
    </div>

    ${opts.portalUrl ? `<p>Puoi visualizzare il dettaglio completo dal tuo portale:</p><a href="${opts.portalUrl}" class="btn">Vai al portale</a>` : ""}
  `);

  await sendEmail({
    to: opts.clientEmail,
    subject: `${opts.tenantName} — Preventivo ${opts.quoteNumber}`,
    html,
  });
}

// ─── CONTRATTO DA FIRMARE ─────────────────────────────────────────────────────
export async function sendContractEmail(opts: {
  clientEmail: string;
  clientName: string;
  tenantName: string;
  contractTitle: string;
  signUrl: string;
}) {
  const html = baseTemplate(`
    <h2>Contratto da firmare</h2>
    <p>Ciao <strong style="color:#f5f5f5">${opts.clientName}</strong>,</p>
    <p>${opts.tenantName} ti ha inviato un contratto da firmare digitalmente.</p>

    <div class="detail-box">
      <div class="detail-row">
        <span class="detail-label">Contratto</span>
        <span class="detail-value">${opts.contractTitle}</span>
      </div>
    </div>

    <p>Puoi leggere e firmare il contratto cliccando sul pulsante qui sotto — non serve alcuna registrazione.</p>
    <a href="${opts.signUrl}" class="btn">Leggi e firma il contratto</a>

    <p style="font-size:12px;color:#555;margin-top:16px;">Il link è personale — non condividerlo con altri.</p>
  `);

  await sendEmail({
    to: opts.clientEmail,
    subject: `${opts.tenantName} — Contratto da firmare: ${opts.contractTitle}`,
    html,
  });
}

// ─── CONTRATTO FIRMATO (notifica al fotografo) ────────────────────────────────
export async function sendContractSignedNotification(opts: {
  ownerEmail: string;
  clientName: string;
  contractTitle: string;
  signedAt: Date;
}) {
  const html = baseTemplate(`
    <span class="badge-green">✓ Firmato</span>
    <h2 style="margin-top:16px">Contratto firmato</h2>
    <p><strong style="color:#f5f5f5">${opts.clientName}</strong> ha firmato il contratto.</p>

    <div class="detail-box">
      <div class="detail-row">
        <span class="detail-label">Contratto</span>
        <span class="detail-value">${opts.contractTitle}</span>
      </div>
      <div class="detail-row">
        <span class="detail-label">Firmato il</span>
        <span class="detail-value">${formatDateTime(opts.signedAt)}</span>
      </div>
    </div>
  `);

  await sendEmail({
    to: opts.ownerEmail,
    subject: `✓ ${opts.clientName} ha firmato — ${opts.contractTitle}`,
    html,
  });
}
