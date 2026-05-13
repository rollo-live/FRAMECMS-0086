import { Hono } from "hono";
import { cors } from "hono/cors";
import { auth } from "./auth";
import { authMiddleware } from "./middleware/auth";
import { tenants } from "./routes/tenants";
import { bookings } from "./routes/bookings";
import { clients } from "./routes/clients";
import { quotes } from "./routes/quotes";
import { contracts } from "./routes/contracts";
import { projects } from "./routes/projects";
import { galleries } from "./routes/galleries";
import { videos } from "./routes/videos";
import { portal } from "./routes/portal";
import { tasks } from "./routes/tasks";
import { team } from "./routes/team";
import { contabilita } from "./routes/contabilita";
import { backup } from "./routes/backup";
import { db } from "./database";
import * as schema from "./database/schema";
import { and, eq } from "drizzle-orm";

const app = new Hono()
  .use(cors({ origin: "*", credentials: true }))
  // Block open sign-up: only allow registration with a valid invite token
  .post("/api/auth/sign-up/email", async (c, next) => {
    try {
      // Clone the request so better-auth can still read the body after we inspect it
      const cloned = c.req.raw.clone();
      const body = await cloned.json();
      const inviteToken = body.inviteToken as string | undefined;
      if (!inviteToken) {
        return c.json({ error: "Registrazione non consentita. Usa il link di invito." }, 403);
      }
      const invite = await db.select().from(schema.teamInvites)
        .where(and(eq(schema.teamInvites.token, inviteToken), eq(schema.teamInvites.status, "pending"))).get();
      if (!invite || (invite.expiresAt && invite.expiresAt < new Date())) {
        return c.json({ error: "Invito non valido o scaduto." }, 403);
      }
      // Stash token so the after-create hook can use it
      (c as any).set?.("pendingInviteToken", inviteToken);
    } catch {
      return c.json({ error: "Registrazione non consentita." }, 403);
    }
    await next();
  })
  .on(["GET", "POST"], "/api/auth/*", (c) => auth.handler(c.req.raw))
  .basePath("api")
  .use("*", authMiddleware)
  .get("/health", (c) => c.json({ status: "ok", app: "FRAME" }, 200))
  .route("/tenants", tenants)
  .route("/clients", clients)
  .route("/quotes", quotes)
  .route("/contracts", contracts)
  .route("/projects", projects)
  .route("/galleries", galleries)
  .route("/videos", videos)
  .route("/tasks", tasks)
  .route("/team", team)
  .route("/portal", portal)
  .route("/client-portal", portal)
  .route("/bookings", bookings)
  .route("/contabilita", contabilita)
  .route("/backup", backup);

export type AppType = typeof app;
export default app;
