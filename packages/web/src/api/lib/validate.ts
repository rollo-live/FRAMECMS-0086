import { z, ZodError } from "zod/v4";
import type { Context } from "hono";

/**
 * Parse request body against a Zod schema.
 * Returns { data } on success, calls c.json(422) and returns null on failure.
 */
export async function validateBody<T>(
  c: Context,
  schema: z.ZodType<T>
): Promise<T | null> {
  let raw: unknown;
  try {
    raw = await c.req.json();
  } catch {
    c.res = c.json({ error: "Body JSON non valido" }, 400) as any;
    return null;
  }
  const result = schema.safeParse(raw);
  if (!result.success) {
    const errors = result.error.issues.map((i) => ({
      field: i.path.join("."),
      message: i.message,
    }));
    c.res = c.json({ error: "Dati non validi", errors }, 422) as any;
    return null;
  }
  return result.data;
}

// ─── Shared schemas ───────────────────────────────────────────────────────────

export const ClientSchema = z.object({
  name: z.string().min(1, "Nome obbligatorio").max(255),
  email: z.string().email("Email non valida").optional().nullable(),
  phone: z.string().max(50).optional().nullable(),
  company: z.string().max(255).optional().nullable(),
  type: z.enum(["client", "lead", "prospect"]).optional(),
  status: z.string().max(50).optional().nullable(),
  notes: z.string().max(5000).optional().nullable(),
  tags: z.array(z.string()).optional(),
  codiceSdi: z.string().max(20).optional().nullable(),
  partitaIva: z.string().max(20).optional().nullable(),
  codiceFiscale: z.string().max(20).optional().nullable(),
  codiceCliente: z.string().max(50).optional().nullable(),
  pec: z.string().max(255).optional().nullable(),
  indirizzo: z.string().max(500).optional().nullable(),
  cap: z.string().max(10).optional().nullable(),
  comune: z.string().max(100).optional().nullable(),
  provincia: z.string().max(5).optional().nullable(),
});

export const ClientUpdateSchema = ClientSchema.partial();

export const QuoteSchema = z.object({
  clientId: z.string().min(1, "Cliente obbligatorio"),
  title: z.string().min(1, "Titolo obbligatorio").max(500),
  introText: z.string().max(5000).optional().nullable(),
  closingText: z.string().max(5000).optional().nullable(),
  notes: z.string().max(5000).optional().nullable(),
  taxRate: z.number().min(0).max(100).optional(),
  validUntil: z.string().optional().nullable(),
  items: z
    .array(
      z.object({
        description: z.string().min(1),
        quantity: z.number().min(0),
        unitPrice: z.number().min(0),
        total: z.number().min(0),
      })
    )
    .optional(),
});

export const QuoteUpdateSchema = QuoteSchema.partial().extend({
  status: z.enum(["draft", "sent", "accepted", "rejected"]).optional(),
});

export const EntrataSchema = z.object({
  descrizione: z.string().min(1, "Descrizione obbligatoria").max(500),
  importo: z.number().min(0, "Importo non valido"),
  acconto: z.number().min(0).optional(),
  saldoRicevuto: z.number().min(0).optional(),
  clientId: z.string().optional().nullable(),
  beneficiario: z.enum(["split", "alessio", "gianluca"]).optional(),
  fattura: z.boolean().optional(),
  speseOperatore: z.number().min(0).optional(),
  categoria: z.string().max(100).optional(),
  note: z.string().max(2000).optional().nullable(),
  data: z.string().optional().nullable(),
});

export const EntrataUpdateSchema = EntrataSchema.partial();

export const UscitaSchema = z.object({
  descrizione: z.string().min(1).max(500),
  importo: z.number().min(0),
  beneficiario: z.enum(["split", "alessio", "gianluca"]).optional(),
  fattura: z.boolean().optional(),
  categoria: z.string().max(100).optional(),
  note: z.string().max(2000).optional().nullable(),
  data: z.string().optional().nullable(),
});

export const UscitaUpdateSchema = UscitaSchema.partial();

export const BookingRequestSchema = z.object({
  name: z.string().min(1).max(255),
  email: z.string().email(),
  phone: z.string().max(50).optional().nullable(),
  eventDate: z.string().min(1, "Data evento obbligatoria"),
  eventType: z.string().min(1).max(100),
  location: z.string().max(500).optional().nullable(),
  notes: z.string().max(2000).optional().nullable(),
});

export const InviteSchema = z.object({
  email: z.string().email("Email non valida"),
  role: z.enum(["owner", "staff", "viewer"]).optional(),
  permissions: z.array(z.string()).optional().nullable(),
});
