import { sqliteTable, text, integer, real } from "drizzle-orm/sqlite-core";
export * from "./auth-schema";

// ─── TENANTS (white-label) ───────────────────────────────────────────────────
export const tenants = sqliteTable("tenants", {
  id: text("id").primaryKey(),
  ownerId: text("owner_id"), // references user.id from auth-schema
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  logo: text("logo"),
  primaryColor: text("primary_color").notNull().default("#F5A623"),
  plan: text("plan").notNull().default("free"),
  createdAt: integer("created_at", { mode: "timestamp" }).$defaultFn(() => new Date()),
});

// ─── USER PROFILE (ext) ──────────────────────────────────────────────────────
export const userProfiles = sqliteTable("user_profiles", {
  userId: text("user_id").primaryKey(),
  tenantId: text("tenant_id").references(() => tenants.id),
  role: text("role").notNull().default("owner"), // owner | staff
  updatedAt: integer("updated_at", { mode: "timestamp" }).$defaultFn(() => new Date()),
});

// ─── CLIENTS / LEAD ──────────────────────────────────────────────────────────
export const clients = sqliteTable("clients", {
  id: text("id").primaryKey(),
  tenantId: text("tenant_id").notNull().references(() => tenants.id),
  name: text("name").notNull(),
  email: text("email"),
  phone: text("phone"),
  company: text("company"),
  type: text("type").notNull().default("client"), // client | lead
  status: text("status").notNull().default("active"),
  notes: text("notes"),
  tags: text("tags").default("[]"),
  createdAt: integer("created_at", { mode: "timestamp" }).$defaultFn(() => new Date()),
  updatedAt: integer("updated_at", { mode: "timestamp" }).$defaultFn(() => new Date()),
});

// ─── CLIENT ACCESS TOKENS ────────────────────────────────────────────────────
export const clientTokens = sqliteTable("client_tokens", {
  id: text("id").primaryKey(),
  clientId: text("client_id").notNull().references(() => clients.id),
  token: text("token").notNull().unique(),
  label: text("label"),
  expiresAt: integer("expires_at", { mode: "timestamp" }),
  createdAt: integer("created_at", { mode: "timestamp" }).$defaultFn(() => new Date()),
});

// ─── QUOTES (preventivi) ──────────────────────────────────────────────────────
export const quotes = sqliteTable("quotes", {
  id: text("id").primaryKey(),
  tenantId: text("tenant_id").notNull().references(() => tenants.id),
  clientId: text("client_id").notNull().references(() => clients.id),
  number: text("number").notNull(),
  title: text("title").notNull(),
  items: text("items").notNull().default("[]"),
  subtotal: real("subtotal").notNull().default(0),
  taxRate: real("tax_rate").notNull().default(22),
  total: real("total").notNull().default(0),
  validUntil: integer("valid_until", { mode: "timestamp" }),
  introText: text("intro_text"),
  closingText: text("closing_text"),
  notes: text("notes"),
  status: text("status").notNull().default("draft"), // draft | sent | accepted | rejected
  createdAt: integer("created_at", { mode: "timestamp" }).$defaultFn(() => new Date()),
  updatedAt: integer("updated_at", { mode: "timestamp" }).$defaultFn(() => new Date()),
});

// ─── CONTRACTS ────────────────────────────────────────────────────────────────
export const contracts = sqliteTable("contracts", {
  id: text("id").primaryKey(),
  tenantId: text("tenant_id").notNull().references(() => tenants.id),
  clientId: text("client_id").notNull().references(() => clients.id),
  quoteId: text("quote_id").references(() => quotes.id),
  title: text("title").notNull(),
  content: text("content").notNull().default(""),
  status: text("status").notNull().default("draft"), // draft | sent | signed | cancelled
  signedAt: integer("signed_at", { mode: "timestamp" }),
  signerIp: text("signer_ip"),
  signerName: text("signer_name"),
  signerEmail: text("signer_email"),
  shareToken: text("share_token").unique(),
  createdAt: integer("created_at", { mode: "timestamp" }).$defaultFn(() => new Date()),
  updatedAt: integer("updated_at", { mode: "timestamp" }).$defaultFn(() => new Date()),
});

// ─── PROJECTS ────────────────────────────────────────────────────────────────
export const projects = sqliteTable("projects", {
  id: text("id").primaryKey(),
  tenantId: text("tenant_id").notNull().references(() => tenants.id),
  clientId: text("client_id").references(() => clients.id),
  contractId: text("contract_id").references(() => contracts.id),
  name: text("name").notNull(),
  type: text("type").notNull().default("photo"), // photo | video | photo_video
  status: text("status").notNull().default("planning"), // planning | active | in_review | completed | archived
  startDate: integer("start_date", { mode: "timestamp" }),
  endDate: integer("end_date", { mode: "timestamp" }),
  location: text("location"),
  notes: text("notes"),
  createdAt: integer("created_at", { mode: "timestamp" }).$defaultFn(() => new Date()),
  updatedAt: integer("updated_at", { mode: "timestamp" }).$defaultFn(() => new Date()),
});

// ─── TASKS ────────────────────────────────────────────────────────────────────
export const tasks = sqliteTable("tasks", {
  id: text("id").primaryKey(),
  projectId: text("project_id").notNull().references(() => projects.id),
  tenantId: text("tenant_id").notNull().references(() => tenants.id),
  title: text("title").notNull(),
  description: text("description"),
  status: text("status").notNull().default("todo"), // todo | doing | review | done
  priority: text("priority").notNull().default("medium"), // low | medium | high
  assigneeId: text("assignee_id"),
  dueDate: integer("due_date", { mode: "timestamp" }),
  order: integer("order").notNull().default(0),
  createdAt: integer("created_at", { mode: "timestamp" }).$defaultFn(() => new Date()),
  updatedAt: integer("updated_at", { mode: "timestamp" }).$defaultFn(() => new Date()),
});

// ─── TEAM INVITES ────────────────────────────────────────────────────────────
export const teamInvites = sqliteTable("team_invites", {
  id: text("id").primaryKey(),
  tenantId: text("tenant_id").notNull().references(() => tenants.id),
  email: text("email").notNull(),
  role: text("role").notNull().default("staff"), // owner | staff
  token: text("token").notNull().unique(),
  invitedBy: text("invited_by").notNull(), // userId
  status: text("status").notNull().default("pending"), // pending | accepted | expired
  expiresAt: integer("expires_at", { mode: "timestamp" }),
  createdAt: integer("created_at", { mode: "timestamp" }).$defaultFn(() => new Date()),
});

// ─── GALLERIES ────────────────────────────────────────────────────────────────
export const galleries = sqliteTable("galleries", {
  id: text("id").primaryKey(),
  projectId: text("project_id").references(() => projects.id),
  tenantId: text("tenant_id").notNull().references(() => tenants.id),
  title: text("title").notNull(),
  watermarkEnabled: integer("watermark_enabled", { mode: "boolean" }).notNull().default(true),
  downloadEnabled: integer("download_enabled", { mode: "boolean" }).notNull().default(false),
  downloadWithWatermark: integer("download_with_watermark", { mode: "boolean" }).notNull().default(true),
  shareToken: text("share_token").unique(),
  // Access gate
  accessGate: integer("access_gate", { mode: "boolean" }).notNull().default(false),
  accessApproval: text("access_approval").notNull().default("auto"), // "auto" | "manual"
  // Like limit (0 = unlimited)
  likeLimit: integer("like_limit").notNull().default(0),
  createdAt: integer("created_at", { mode: "timestamp" }).$defaultFn(() => new Date()),
});

export const galleryAccess = sqliteTable("gallery_access", {
  id: text("id").primaryKey(),
  galleryId: text("gallery_id").notNull().references(() => galleries.id),
  firstName: text("first_name").notNull(),
  lastName: text("last_name").notNull(),
  email: text("email").notNull(),
  status: text("status").notNull().default("pending"), // "pending" | "approved" | "rejected"
  accessToken: text("access_token").notNull().unique(),
  createdAt: integer("created_at", { mode: "timestamp" }).$defaultFn(() => new Date()),
});

export const photos = sqliteTable("photos", {
  id: text("id").primaryKey(),
  galleryId: text("gallery_id").notNull().references(() => galleries.id),
  filename: text("filename").notNull(),
  r2Key: text("r2_key").notNull(),
  thumbnailKey: text("thumbnail_key"),
  width: integer("width"),
  height: integer("height"),
  order: integer("order").notNull().default(0),
  likes: text("likes").notNull().default("[]"),
  createdAt: integer("created_at", { mode: "timestamp" }).$defaultFn(() => new Date()),
});

export const photoComments = sqliteTable("photo_comments", {
  id: text("id").primaryKey(),
  photoId: text("photo_id").notNull().references(() => photos.id),
  clientId: text("client_id").references(() => clients.id),
  authorName: text("author_name"),
  text: text("text").notNull(),
  resolved: integer("resolved", { mode: "boolean" }).notNull().default(false),
  createdAt: integer("created_at", { mode: "timestamp" }).$defaultFn(() => new Date()),
});

// ─── VIDEOS ───────────────────────────────────────────────────────────────────
export const videos = sqliteTable("videos", {
  id: text("id").primaryKey(),
  projectId: text("project_id").references(() => projects.id),
  tenantId: text("tenant_id").notNull().references(() => tenants.id),
  title: text("title").notNull(),
  version: text("version").notNull().default("v1"), // v1 | v2 | final
  r2Key: text("r2_key").notNull().default(""),
  duration: real("duration"),
  shareToken: text("share_token").unique(),
  allowDownload: integer("allow_download", { mode: "boolean" }).notNull().default(true),
  watermarkEnabled: integer("watermark_enabled", { mode: "boolean" }).notNull().default(false),
  watermarkText: text("watermark_text"),
  createdAt: integer("created_at", { mode: "timestamp" }).$defaultFn(() => new Date()),
});

export const videoComments = sqliteTable("video_comments", {
  id: text("id").primaryKey(),
  videoId: text("video_id").notNull().references(() => videos.id),
  clientId: text("client_id").references(() => clients.id),
  authorName: text("author_name"),
  timecodeMs: integer("timecode_ms").notNull(),
  text: text("text").notNull(),
  resolved: integer("resolved", { mode: "boolean" }).notNull().default(false),
  createdAt: integer("created_at", { mode: "timestamp" }).$defaultFn(() => new Date()),
});

// ─── APPOINTMENTS (prenotazioni) ─────────────────────────────────────────────
export const appointments = sqliteTable("appointments", {
  id: text("id").primaryKey(),
  tenantId: text("tenant_id").notNull().references(() => tenants.id),
  // Client info (non-authed form submission)
  clientName: text("client_name").notNull(),
  clientEmail: text("client_email").notNull(),
  clientPhone: text("client_phone"),
  // Event details
  eventType: text("event_type").notNull(), // battesimo | compleanno | matrimonio | shooting_aziendale | conferenza | altro
  eventTypeCustom: text("event_type_custom"), // if eventType === "altro"
  services: text("services").notNull().default("[]"), // JSON array: ["foto","video","stampe_live"]
  eventDate: integer("event_date", { mode: "timestamp" }).notNull(),
  eventLocation: text("event_location"),
  notes: text("notes"),
  // Status
  status: text("status").notNull().default("pending"), // pending | approved | rejected
  // Unique token for public booking link
  bookingToken: text("booking_token").notNull().unique(),
  // Google Calendar event (set after approval)
  googleCalendarEventId: text("google_calendar_event_id"),
  // Timestamps
  createdAt: integer("created_at", { mode: "timestamp" }).$defaultFn(() => new Date()),
  updatedAt: integer("updated_at", { mode: "timestamp" }).$defaultFn(() => new Date()),
});

// ─── GOOGLE CALENDAR TOKENS ──────────────────────────────────────────────────
export const googleCalendarTokens = sqliteTable("google_calendar_tokens", {
  id: text("id").primaryKey(),
  tenantId: text("tenant_id").notNull().references(() => tenants.id).unique(),
  accessToken: text("access_token").notNull(),
  refreshToken: text("refresh_token").notNull(),
  expiresAt: integer("expires_at", { mode: "timestamp" }).notNull(),
  calendarId: text("calendar_id").notNull().default("primary"),
  createdAt: integer("created_at", { mode: "timestamp" }).$defaultFn(() => new Date()),
  updatedAt: integer("updated_at", { mode: "timestamp" }).$defaultFn(() => new Date()),
});
