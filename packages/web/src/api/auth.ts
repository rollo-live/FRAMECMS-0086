import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { autumn } from "autumn-js/better-auth";
import { twoFactor } from "better-auth/plugins";
import { Autumn } from "autumn-js";
import { db } from "./database";

const autumnSdk = new Autumn();

export const auth = betterAuth({
  basePath: "/api/auth",
  baseURL: process.env.WEBSITE_URL,
  database: drizzleAdapter(db, { provider: "sqlite" }),
  emailAndPassword: { enabled: true },
  secret: process.env.BETTER_AUTH_SECRET,
  trustedOrigins: [
    process.env.WEBSITE_URL ?? "http://localhost:4200",
    process.env.APP_URL ?? "http://localhost:4200",
    "http://localhost:4200",
    "http://localhost:3000",
  ].filter(Boolean) as string[],
  plugins: [
    autumn(),
    twoFactor({
      issuer: "FRAME",
      totpOptions: { period: 30, digits: 6 },
    }),
  ],
  databaseHooks: {
    user: {
      create: {
        async after(user) {
          try {
            await autumnSdk.customers.getOrCreate({
              customerId: user.id,
              name: user.name,
              email: user.email,
            });
          } catch (e) {
            console.error("[autumn] Failed to create customer on sign-up:", e);
          }
        },
      },
    },
  },
});
