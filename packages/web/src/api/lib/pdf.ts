import puppeteer from "puppeteer-core";

interface QuoteItem {
  description: string;
  qty: number;
  price: number;
  unit?: string;
}

interface PdfOptions {
  quote: {
    id: string;
    number: string;
    title: string;
    introText?: string | null;
    closingText?: string | null;
    notes?: string | null;
    items: QuoteItem[];
    subtotal: number;
    taxRate: number;
    total: number;
    validUntil?: Date | null;
    status: string;
    createdAt?: Date | null;
  };
  client: {
    name: string;
    email?: string | null;
    phone?: string | null;
    company?: string | null;
  };
  tenant: {
    name: string;
    logo?: string | null;
    primaryColor?: string | null;
  };
}

function formatCurrency(n: number): string {
  return new Intl.NumberFormat("it-IT", { style: "currency", currency: "EUR" }).format(n);
}

function formatDate(d: Date | null | undefined): string {
  if (!d) return "—";
  return new Intl.DateTimeFormat("it-IT", { day: "2-digit", month: "long", year: "numeric" }).format(d);
}

function buildHtml(opts: PdfOptions): string {
  const { quote, client, tenant } = opts;
  const accent = tenant.primaryColor ?? "#F5A623";
  const items: QuoteItem[] = Array.isArray(quote.items) ? quote.items : [];

  const logoHtml = tenant.logo
    ? `<img src="${tenant.logo}" alt="${tenant.name}" style="max-height:60px;max-width:180px;object-fit:contain;" />`
    : `<span style="font-size:22px;font-weight:700;color:${accent};">${tenant.name}</span>`;

  const itemRows = items.map((item, i) => {
    const lineTotal = Number(item.qty) * Number(item.price);
    return `
      <tr style="background:${i % 2 === 0 ? "#ffffff" : "#fafafa"};">
        <td style="padding:10px 14px;border-bottom:1px solid #eee;font-size:13px;">${item.description ?? ""}</td>
        <td style="padding:10px 14px;border-bottom:1px solid #eee;text-align:center;font-size:13px;">${item.qty}</td>
        <td style="padding:10px 14px;border-bottom:1px solid #eee;text-align:right;font-size:13px;">${formatCurrency(Number(item.price))}</td>
        <td style="padding:10px 14px;border-bottom:1px solid #eee;text-align:right;font-size:13px;font-weight:600;">${formatCurrency(lineTotal)}</td>
      </tr>`;
  }).join("");

  const statusLabels: Record<string, string> = {
    draft: "Bozza",
    sent: "Inviato",
    accepted: "Accettato",
    rejected: "Rifiutato",
  };
  const statusColors: Record<string, string> = {
    draft: "#888",
    sent: "#3b82f6",
    accepted: "#22c55e",
    rejected: "#ef4444",
  };
  const statusLabel = statusLabels[quote.status] ?? quote.status;
  const statusColor = statusColors[quote.status] ?? "#888";

  return `<!DOCTYPE html>
<html lang="it">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>Preventivo ${quote.number}</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body {
    font-family: 'Segoe UI', Helvetica, Arial, sans-serif;
    background: #fff;
    color: #1a1a1a;
    font-size: 14px;
    line-height: 1.6;
  }
  .page { padding: 48px 52px; max-width: 794px; margin: 0 auto; }

  /* HEADER */
  .header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    padding-bottom: 28px;
    border-bottom: 3px solid ${accent};
    margin-bottom: 32px;
  }
  .header-left { display: flex; flex-direction: column; gap: 6px; }
  .header-right { text-align: right; }
  .doc-title {
    font-size: 28px;
    font-weight: 700;
    color: ${accent};
    letter-spacing: -0.5px;
  }
  .doc-number { font-size: 13px; color: #666; margin-top: 2px; }
  .status-badge {
    display: inline-block;
    padding: 3px 10px;
    border-radius: 12px;
    font-size: 11px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    background: ${statusColor}1a;
    color: ${statusColor};
    border: 1px solid ${statusColor}40;
    margin-top: 6px;
  }

  /* CLIENT BOX */
  .client-section {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    margin-bottom: 32px;
    gap: 24px;
  }
  .client-box {
    background: #f8f8f8;
    border-left: 4px solid ${accent};
    padding: 16px 20px;
    border-radius: 0 8px 8px 0;
    flex: 1;
  }
  .client-box h3 { font-size: 10px; text-transform: uppercase; letter-spacing: 1px; color: #999; margin-bottom: 8px; }
  .client-box .name { font-size: 16px; font-weight: 700; color: #1a1a1a; }
  .client-box .detail { font-size: 12px; color: #555; margin-top: 2px; }

  .meta-box {
    text-align: right;
    min-width: 180px;
  }
  .meta-row { font-size: 12px; color: #555; margin-bottom: 4px; }
  .meta-row strong { color: #1a1a1a; }

  /* INTRO TEXT */
  .intro-text {
    margin-bottom: 28px;
    padding: 16px 20px;
    background: #fffdf6;
    border: 1px solid ${accent}30;
    border-radius: 8px;
    font-size: 13px;
    color: #333;
    line-height: 1.7;
    white-space: pre-line;
  }

  /* TABLE */
  .table-section { margin-bottom: 28px; }
  .table-title {
    font-size: 11px;
    text-transform: uppercase;
    letter-spacing: 1px;
    color: #999;
    margin-bottom: 10px;
    font-weight: 600;
  }
  table {
    width: 100%;
    border-collapse: collapse;
    border-radius: 8px;
    overflow: hidden;
    border: 1px solid #eee;
  }
  thead tr {
    background: ${accent};
    color: #fff;
  }
  thead th {
    padding: 11px 14px;
    font-size: 11px;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    font-weight: 600;
    text-align: left;
  }
  thead th:nth-child(2) { text-align: center; }
  thead th:nth-child(3), thead th:nth-child(4) { text-align: right; }

  /* TOTALS */
  .totals-section {
    display: flex;
    justify-content: flex-end;
    margin-bottom: 28px;
  }
  .totals-box {
    width: 280px;
    border: 1px solid #eee;
    border-radius: 8px;
    overflow: hidden;
  }
  .totals-row {
    display: flex;
    justify-content: space-between;
    padding: 10px 16px;
    font-size: 13px;
    border-bottom: 1px solid #eee;
  }
  .totals-row:last-child { border-bottom: none; }
  .totals-row.total-final {
    background: ${accent};
    color: #fff;
    font-weight: 700;
    font-size: 15px;
  }
  .totals-row label { color: #666; }
  .totals-row.total-final label { color: rgba(255,255,255,0.85); }

  /* CLOSING */
  .closing-text {
    margin-bottom: 24px;
    font-size: 13px;
    color: #444;
    line-height: 1.7;
    white-space: pre-line;
  }

  /* NOTES */
  .notes-section {
    margin-bottom: 24px;
    padding: 14px 18px;
    background: #f5f5f5;
    border-radius: 8px;
    font-size: 12px;
    color: #555;
    white-space: pre-line;
  }
  .notes-section h4 { font-size: 10px; text-transform: uppercase; letter-spacing: 1px; color: #aaa; margin-bottom: 6px; }

  /* FOOTER */
  .footer {
    border-top: 1px solid #eee;
    padding-top: 20px;
    display: flex;
    justify-content: space-between;
    align-items: center;
    font-size: 11px;
    color: #aaa;
  }
  .footer .brand { font-weight: 600; color: #888; }
</style>
</head>
<body>
<div class="page">

  <!-- HEADER -->
  <div class="header">
    <div class="header-left">
      ${logoHtml}
    </div>
    <div class="header-right">
      <div class="doc-title">PREVENTIVO</div>
      <div class="doc-number">${quote.number}</div>
      <div><span class="status-badge">${statusLabel}</span></div>
    </div>
  </div>

  <!-- CLIENT + META -->
  <div class="client-section">
    <div class="client-box">
      <h3>Cliente</h3>
      <div class="name">${client.name}</div>
      ${client.company ? `<div class="detail">${client.company}</div>` : ""}
      ${client.email ? `<div class="detail">${client.email}</div>` : ""}
      ${client.phone ? `<div class="detail">${client.phone}</div>` : ""}
    </div>
    <div class="meta-box">
      <div class="meta-row"><label>Data emissione:</label><br/><strong>${formatDate(quote.createdAt ?? new Date())}</strong></div>
      ${quote.validUntil ? `<div class="meta-row" style="margin-top:8px;"><label>Valido fino al:</label><br/><strong>${formatDate(quote.validUntil)}</strong></div>` : ""}
    </div>
  </div>

  <!-- TITLE -->
  <div style="margin-bottom:24px;">
    <div style="font-size:18px;font-weight:700;color:#1a1a1a;">${quote.title}</div>
  </div>

  ${quote.introText ? `<div class="intro-text">${quote.introText}</div>` : ""}

  <!-- LINE ITEMS -->
  <div class="table-section">
    <div class="table-title">Voci del preventivo</div>
    <table>
      <thead>
        <tr>
          <th style="width:50%;">Descrizione</th>
          <th style="width:10%;">Qtà</th>
          <th style="width:20%;">Prezzo unitario</th>
          <th style="width:20%;">Totale</th>
        </tr>
      </thead>
      <tbody>
        ${itemRows || `<tr><td colspan="4" style="padding:16px;text-align:center;color:#aaa;font-size:13px;">Nessuna voce</td></tr>`}
      </tbody>
    </table>
  </div>

  <!-- TOTALS -->
  <div class="totals-section">
    <div class="totals-box">
      <div class="totals-row">
        <label>Subtotale</label>
        <span>${formatCurrency(quote.subtotal)}</span>
      </div>
      <div class="totals-row">
        <label>IVA (${quote.taxRate}%)</label>
        <span>${formatCurrency(quote.total - quote.subtotal)}</span>
      </div>
      <div class="totals-row total-final">
        <label>Totale</label>
        <span>${formatCurrency(quote.total)}</span>
      </div>
    </div>
  </div>

  ${quote.closingText ? `<div class="closing-text">${quote.closingText}</div>` : ""}

  ${quote.notes ? `
  <div class="notes-section">
    <h4>Note</h4>
    ${quote.notes}
  </div>` : ""}

  <!-- FOOTER -->
  <div class="footer">
    <span class="brand">${tenant.name}</span>
    <span>${quote.number} · emesso il ${formatDate(quote.createdAt ?? new Date())}${quote.validUntil ? ` · valido fino al ${formatDate(quote.validUntil)}` : ""}</span>
  </div>

</div>
</body>
</html>`;
}

export async function generateQuotePdf(opts: PdfOptions): Promise<Buffer> {
  const html = buildHtml(opts);

  const browser = await puppeteer.launch({
    executablePath: "/usr/bin/google-chrome",
    headless: true,
    args: [
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-dev-shm-usage",
      "--disable-gpu",
      "--no-first-run",
      "--no-zygote",
    ],
  });

  try {
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: "networkidle0" });
    const pdf = await page.pdf({
      format: "A4",
      printBackground: true,
      margin: { top: "0", right: "0", bottom: "0", left: "0" },
    });
    return Buffer.from(pdf);
  } finally {
    await browser.close();
  }
}
