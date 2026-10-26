import "dotenv/config";
import { mkdir, writeFile, readFile, copyFile } from "node:fs/promises";
import { resolve } from "node:path";
import { spawnSync } from "node:child_process";
import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
} from "node:crypto";
const mode = process.argv[2] || "create";
const root = process.cwd();
function docker(args: string[]) {
  const r = spawnSync("docker", args, {
    encoding: null,
    maxBuffer: 100 * 1024 * 1024,
  });
  if (r.status !== 0) throw Error(r.stderr?.toString() || "Falha no Docker.");
  return r.stdout;
}
const password = process.env.BACKUP_ENCRYPTION_KEY;
if (!password || password.length < 32)
  throw Error(
    "Configure BACKUP_ENCRYPTION_KEY com pelo menos 32 caracteres. Guarde a chave em local separado do backup.",
  );
const key = createHash("sha256").update(password).digest();
if (mode === "create") {
  await mkdir(resolve(root, "backups"), { recursive: true });
  const dump = docker([
    "compose",
    "exec",
    "-T",
    "db",
    "pg_dump",
    "-U",
    "barber",
    "-d",
    "barber",
    "--format=custom",
  ]);
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const encrypted = Buffer.concat([cipher.update(dump), cipher.final()]);
  const name = `salão-${new Date().toISOString().replace(/[:.]/g, "-")}.backup.enc`;
  const path = resolve(root, "backups", name);
  await writeFile(
    path,
    Buffer.concat([
      Buffer.from("NAVALHA1"),
      iv,
      cipher.getAuthTag(),
      encrypted,
    ]),
  );
  console.log("Backup criptografado:", path);
} else if (mode === "verify") {
  const input = process.argv[3];
  if (!input) throw Error("Informe o caminho do backup criptografado.");
  const bytes = await readFile(resolve(input));
  if (bytes.subarray(0, 8).toString() !== "NAVALHA1")
    throw Error("Formato de backup inválido.");
  const decipher = createDecipheriv("aes-256-gcm", key, bytes.subarray(8, 20));
  decipher.setAuthTag(bytes.subarray(20, 36));
  const dump = Buffer.concat([
    decipher.update(bytes.subarray(36)),
    decipher.final(),
  ]);
  const database = "restore_check_" + randomBytes(6).toString("hex");
  const container = docker(["compose", "ps", "-q", "db"]).toString().trim();
  const temporary = "/tmp/" + database + ".dump";
  try {
    docker([
      "compose",
      "exec",
      "-T",
      "db",
      "createdb",
      "-U",
      "barber",
      database,
    ]);
    const r = spawnSync(
      "docker",
      ["exec", "-i", container, "sh", "-c", `cat > ${temporary}`],
      { input: dump, maxBuffer: 100 * 1024 * 1024 },
    );
    if (r.status !== 0)
      throw Error("Não foi possível preparar o dump no container.");
    docker([
      "compose",
      "exec",
      "-T",
      "db",
      "pg_restore",
      "-U",
      "barber",
      "-d",
      database,
      "--exit-on-error",
      "--no-owner",
      temporary,
    ]);
    const check = docker([
      "compose",
      "exec",
      "-T",
      "db",
      "psql",
      "-U",
      "barber",
      "-d",
      database,
      "-Atc",
      "SELECT count(*) FROM appointments; SELECT count(*) FROM auth_user;",
    ]);
    console.log(
      "Restauração verificada em banco temporário. Contagens de atendimentos/usuários:",
      check.toString().trim(),
    );
  } finally {
    docker([
      "compose",
      "exec",
      "-T",
      "db",
      "dropdb",
      "-U",
      "barber",
      "--if-exists",
      database,
    ]);
    docker(["compose", "exec", "-T", "db", "rm", "-f", temporary]);
  }
} else
  throw Error(
    "Use create ou verify. O script não restaura sobre o banco principal.",
  );
