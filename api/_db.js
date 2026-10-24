// /api/_db.js
// Tenká vrstva nad Upstash Redis (REST API) — bez npm závislostí.
// Premenné prostredia pridá Vercel sám, keď k projektu pripojíš Upstash Redis
// (Vercel → Storage / Marketplace → Upstash Redis → Connect Project):
//   KV_REST_API_URL + KV_REST_API_TOKEN   (alebo UPSTASH_REDIS_REST_URL + UPSTASH_REDIS_REST_TOKEN,
//   prípadne tie isté názvy s vlastnou predponou, napr. STORAGE_KV_REST_API_URL)
//
// Kľúče v databáze:
//   cfg:active        -> id aktívnej triedy (text)
//   classes           -> množina id všetkých tried
//   class:<id>        -> JSON { id, name, students:[{id:"s01", name:"..."}], createdAt, code }
//                        (code = kód triedy, ktorým sa žiaci prihlasujú do svojej triedy)
//   projects          -> množina projektov, ktoré používajú túto databázu (mixpult, launchpad, midikeys, insta360, …)
//   subs:<projekt>:<id> -> hash: "<cvičenie>|<s01+s04>" -> JSON { exId, members, attempts:[...] }
//   ovr:<projekt>:<id>  -> hash: "<s01>|<cvičenie>" -> JSON { grade, note }  (ručná známka učiteľa)
//
// Zoznamy tried (classes, class:<id>, cfg:active) sú ZDIEĽANÉ medzi projektmi, ak viaceré
// aplikácie používajú tú istú databázu — zoznam žiakov stačí vložiť raz. Odovzdania a ručné
// známky sú oddelené podľa projektu (konštanta PROJECT nižšie).

import { randomInt } from "node:crypto";

export const PROJECT = "insta360";
export const subsKey = id => `subs:${PROJECT}:${id}`;
export const ovrKey = id => `ovr:${PROJECT}:${id}`;

// Prihlasovacie údaje k databáze. Vercel ich pri pripojení Upstash Redis uloží pod názvami
//   KV_REST_API_URL + KV_REST_API_TOKEN   (alebo UPSTASH_REDIS_REST_URL + UPSTASH_REDIS_REST_TOKEN).
// Ak sa pri pripájaní databázy zvolí vlastná predpona (Custom Prefix), názvy vyzerajú napr.
// STORAGE_KV_REST_API_URL + STORAGE_KV_REST_API_TOKEN — tie sa nájdu tiež (URL a token musia
// mať rovnakú predponu). Tokeny „READ_ONLY“ sa nepoužívajú, zapisovať by nešlo.
const PAIRS = [
  ["KV_REST_API_URL", "KV_REST_API_TOKEN"],
  ["UPSTASH_REDIS_REST_URL", "UPSTASH_REDIS_REST_TOKEN"]
];
const isUrl = v => /^https?:\/\//i.test(String(v || ""));

function creds() {
  const env = process.env;
  for (const [u, t] of PAIRS) {                       // 1) štandardné názvy
    if (isUrl(env[u]) && env[t]) return { url: env[u], token: env[t] };
  }
  const keys = Object.keys(env).sort();
  for (const [u, t] of PAIRS) {                       // 2) názvy s predponou
    for (const k of keys) {
      if (k.length > u.length && k.endsWith("_" + u) && isUrl(env[k])) {
        const tk = k.slice(0, k.length - u.length) + t;
        if (env[tk]) return { url: env[k], token: env[tk] };
      }
    }
  }
  return null;
}

export const dbConfigured = () => !!creds();

// Pomoc pri ladení: NÁZVY premenných súvisiacich s databázou (nikdy nie ich hodnoty).
export function dbEnvNames() {
  return Object.keys(process.env).filter(k => /REDIS|KV_|UPSTASH|STORAGE/i.test(k)).sort();
}

export async function cmd(...args) {
  const c = creds();
  if (!c) throw new Error("Databáza nie je pripojená (chýbajú premenné prostredia).");
  const r = await fetch(c.url, {
    method: "POST",
    headers: { Authorization: `Bearer ${c.token}`, "Content-Type": "application/json" },
    body: JSON.stringify(args.map(String))
  });
  const d = await r.json().catch(() => ({}));
  if (!r.ok || d.error) throw new Error(d.error || `DB ${r.status}`);
  return d.result;
}

export async function hgetall(key) {
  const res = (await cmd("HGETALL", key)) || [];
  if (!Array.isArray(res)) return res;
  const o = {};
  for (let i = 0; i < res.length; i += 2) o[res[i]] = res[i + 1];
  return o;
}

export async function getJSON(key) {
  const v = await cmd("GET", key);
  return v ? JSON.parse(v) : null;
}

export const setJSON = (key, val) => cmd("SET", key, JSON.stringify(val));

export async function getActiveClass() {
  const id = await cmd("GET", "cfg:active");
  return id ? await getJSON(`class:${id}`) : null;
}

// ---------- Kód triedy ----------
// Žiak zadá kód od učiteľa a server mu vráti zoznam mien LEN tej triedy, ku ktorej kód patrí.
// Abeceda bez zameniteľných znakov (bez 0/O, 1/I).
const CODE_ALPHA = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
export const normCode = v => String(v || "").toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 12);

export async function allClasses() {
  const ids = (await cmd("SMEMBERS", "classes")) || [];
  const list = await Promise.all(ids.map(id => getJSON(`class:${id}`)));
  return list.filter(Boolean);
}

export async function findClassByCode(code) {
  const c = normCode(code);
  if (c.length < 4) return null;
  return (await allClasses()).find(x => x.code && normCode(x.code) === c) || null;
}

export async function newUniqueCode() {
  const used = new Set((await allClasses()).map(c => normCode(c.code)));
  for (;;) {
    let s = "";
    for (let i = 0; i < 6; i++) s += CODE_ALPHA[randomInt(CODE_ALPHA.length)];
    if (!used.has(s)) return s;
  }
}
