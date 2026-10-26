import { getMigrations } from "better-auth/db/migration";
import { auth, authOptions } from "../lib/auth-engine";
import { db } from "../lib/db";
export async function setupAuth() {
  if (
    process.env.NODE_ENV === "production" &&
    (!process.env.INITIAL_LOCAL_PASSWORD ||
      process.env.INITIAL_LOCAL_PASSWORD === "demo-local-2026" ||
      process.env.INITIAL_LOCAL_PASSWORD.length < 16)
  )
    throw Error(
      "Configure uma senha inicial administrativa exclusiva com pelo menos 16 caracteres.",
    );
  const migration = await getMigrations(authOptions);
  await migration.runMigrations();
  for (const account of [
    {
      email: "dono@beauty.local",
      name: "Proprietário",
      role: "owner",
      professional: null,
    },
    {
      email: "recepcao@beauty.local",
      name: "Recepção",
      role: "receptionist",
      professional: null,
    },
    {
      email: "rafael@beauty.local",
      name: "Marina Costa",
      role: "barber",
      professional: "rafa",
    },
  ]) {
    const existing = (
      await db.query("SELECT id FROM auth_user WHERE email=$1", [account.email])
    ).rows[0];
    if (existing) continue;
    const result = await auth.api.signUpEmail({
      body: {
        name: account.name,
        email: account.email,
        password: process.env.INITIAL_LOCAL_PASSWORD || "demo-local-2026",
      },
    });
    await db.query(
      "INSERT INTO memberships(user_id,tenant_id,role,professional_id) VALUES ($1,$2,$3,$4)",
      [result.user.id, "demo", account.role, account.professional],
    );
    console.log("Conta local criada:", account.email);
  }
  if (process.env.DEMO_MODE === "true") {
    for (const account of [
      {
        email: "demo@beauty.local",
        name: "Marina · Gestor e profissional",
        role: "owner",
        professional: "rafa",
      },
      {
        email: "profissional@beauty.local",
        name: "Luiza · Profissional",
        role: "barber",
        professional: "leo",
      },
    ]) {
      const email = account.email;
      let u = (
        await db.query("SELECT id FROM auth_user WHERE email=$1", [email])
      ).rows[0];
      if (!u)
        u = (
          await auth.api.signUpEmail({
            body: { name: account.name, email, password: "DemoBeauty2026!" },
          })
        ).user;
      await db.query(
        "INSERT INTO memberships(user_id,tenant_id,role,professional_id,read_only,is_demo) VALUES ($1,'demo',$2,$3,false,true) ON CONFLICT(user_id) DO UPDATE SET role=excluded.role,professional_id=excluded.professional_id,read_only=false,is_demo=true,active=true WHERE memberships.tenant_id='demo'",
        [u.id, account.role, account.professional],
      );
      await db.query("UPDATE auth_user SET name=$2 WHERE id=$1", [
        u.id,
        account.name,
      ]);
    }
  }
}
