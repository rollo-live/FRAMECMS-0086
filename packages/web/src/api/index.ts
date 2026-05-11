import { Hono } from "hono";
import { cors } from "hono/cors";
import { auth } from "./auth";
import { authMiddleware } from "./middleware/auth";
import { tenants } from "./routes/tenants";
import { clients } from "./routes/clients";
import { quotes } from "./routes/quotes";
import { contracts } from "./routes/contracts";
import { projects } from "./routes/projects";
import { galleries } from "./routes/galleries";
import { videos } from "./routes/videos";
import { portal } from "./routes/portal";

const app = new Hono()
  .use(cors({ origin: "*", credentials: true }))
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
  .route("/portal", portal)
  .route("/client-portal", portal);

export type AppType = typeof app;
export default app;
