import "dotenv/config";
import { betterAuth, type BetterAuthOptions } from "better-auth";
import { db } from "./db";
export const authOptions = {
  database: db,
  advanced: { cookiePrefix: "elares-beauty" },
  secret: process.env.BETTER_AUTH_SECRET,
  baseURL: process.env.BETTER_AUTH_URL || "http://127.0.0.1:3018",
  trustedOrigins: (
    process.env.APP_ORIGINS || "http://127.0.0.1:3018,http://localhost:3018"
  )
    .split(",")
    .map((s) => s.trim()),
  emailAndPassword: { enabled: true, minPasswordLength: 10, autoSignIn: false },
  user: { modelName: "auth_user" },
  session: {
    modelName: "auth_session",
    expiresIn: 43200,
    updateAge: 3600,
    cookieCache: { enabled: false },
  },
  account: { modelName: "auth_account" },
  verification: { modelName: "auth_verification" },
  rateLimit: { enabled: true, storage: "database", window: 60, max: 30 },
} satisfies BetterAuthOptions;
export const auth = betterAuth(authOptions);
