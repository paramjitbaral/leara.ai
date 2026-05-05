import path from "path";
import fs from "fs-extra";

interface SecretStore {
  [key: string]: string;
}

function secretPath(projectRoot: string): string {
  return path.join(projectRoot, ".leara", "secrets.json");
}

function encode(v: string): string {
  return Buffer.from(v, "utf-8").toString("base64");
}

function decode(v: string): string {
  return Buffer.from(v, "base64").toString("utf-8");
}

async function readStore(projectRoot: string): Promise<SecretStore> {
  const p = secretPath(projectRoot);
  if (!(await fs.pathExists(p))) return {};
  return fs.readJson(p);
}

export async function setSecret(projectRoot: string, key: string, value: string): Promise<void> {
  const p = secretPath(projectRoot);
  const store = await readStore(projectRoot);
  store[key] = encode(value);
  await fs.ensureDir(path.dirname(p));
  await fs.writeJson(p, store, { spaces: 2 });
}

export async function getSecret(projectRoot: string, key: string): Promise<string | null> {
  const store = await readStore(projectRoot);
  if (!store[key]) return null;
  return decode(store[key]);
}

export async function listSecrets(projectRoot: string): Promise<string[]> {
  const store = await readStore(projectRoot);
  return Object.keys(store);
}

export async function deleteSecret(projectRoot: string, key: string): Promise<void> {
  const p = secretPath(projectRoot);
  const store = await readStore(projectRoot);
  delete store[key];
  await fs.ensureDir(path.dirname(p));
  await fs.writeJson(p, store, { spaces: 2 });
}

export async function hasSecret(projectRoot: string, key: string): Promise<boolean> {
  const store = await readStore(projectRoot);
  return Boolean(store[key]);
}
