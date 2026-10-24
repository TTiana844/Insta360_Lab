// /api/evaluate.js
// Vercel Serverless Function (Node.js runtime).
// 1) Overí odovzdanie (trieda, členovia, odkaz na Google Drive) a zavolá Anthropic API
//    kľúčom z ANTHROPIC_API_KEY.
// 2) Hodnotenie spracuje (body a známku prepočíta server) a ULOŽÍ do databázy —
//    žiak výsledok nemá kde upraviť, zapisuje len server.
// 3) Ak AI zlyhá, uloží sa odovzdanie „čaká na ručné hodnotenie“ (bez známky).
//
// Náklady a bezpečnosť:
//  - model určuje SERVER (premenná EVAL_MODEL, predvolene Haiku 4.5), nie prehliadač,
//  - výstup je obmedzený na MAX_OUT_TOKENS, vstup na max. 4 obrázky a pevný limit textu,
//  - systémový prompt a správa sa pred odoslaním čistia (len text + obrázky).

import { dbConfigured, cmd, findClassByCode, PROJECT, subsKey } from "./_db.js";

// Dlhšie okno pre analýzu obrázkov (Vercel predvolene býva kratšie)
export const config = { maxDuration: 30 };

const TZ = "Europe/Bratislava";
const EX_IDS = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "10"];

const MODEL = process.env.EVAL_MODEL || "claude-haiku-4-5-20251001";
const MAX_OUT_TOKENS = 1000;      // JSON so 4 číslami + 3 krátkymi textami má zvyčajne 300–500 tokenov
const MAX_IMAGES = 4;             // viac obrázkov len predražuje vstup, nie hodnotenie
const MAX_IMAGE_CHARS = 1_600_000; // base64 znakov na jeden obrázok (klient ich zmenšuje na ~0,3 MB)
const MAX_SYSTEM_CHARS = 14000;
const MAX_TEXT_CHARS = 8000;
const IMG_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"];

// Pevné kritériá Insta360 Lab (rovnaké pre všetky cvičenia, súčet 100 b.)
const CRIT_MAX = { tech: 35, key: 25, flow: 20, doc: 20 };
// Hranice známok podľa tabuľky klasifikácie v učebnici
const gradeFor = t => (t >= 86 ? 1 : t >= 70 ? 2 : t >= 56 ? 3 : t >= 40 ? 4 : 5);

function stamp() {
  const d = new Date();
  return {
    ts: d.getTime(),
    time: d.toLocaleTimeString("sk-SK", { timeZone: TZ, hour: "2-digit", minute: "2-digit" }),
    date: d.toLocaleDateString("sk-SK", { timeZone: TZ })
  };
}

// Overí meta (trieda, cvičenie, členovia, odkaz). Vracia { v } alebo { error, status }.
async function resolveMeta(meta) {
  if (!meta || typeof meta !== "object") return { error: "Chýbajú údaje o odovzdaní.", status: 400 };
  const exId = String(meta.exId);
  if (!EX_IDS.includes(exId)) return { error: "Neznáme cvičenie.", status: 400 };

  // Trieda sa určuje podľa kódu triedy, ktorý žiak zadal (nie podľa „aktívnej“ triedy)
  const cls = await findClassByCode(meta.code);
  if (!cls) return { error: "Kód triedy nie je platný alebo sa zmenil. Zadaj kód triedy znova.", status: 409 };
  if (String(meta.classId) !== cls.id) {
    return { error: "Trieda sa medzitým zmenila. Obnov stránku (F5) a zadaj kód triedy znova.", status: 409 };
  }

  const ids = Array.isArray(meta.members) ? [...new Set(meta.members.map(String))] : [];
  if (ids.length < 1 || ids.length > 4) return { error: "Tím môže mať 1 až 4 členov.", status: 400 };
  const byId = Object.fromEntries(cls.students.filter(s => s.name).map(s => [s.id, s]));
  if (!ids.every(id => byId[id])) return { error: "Niektorý člen nie je v zozname triedy.", status: 400 };

  // Odkaz na súbory na Google Drive je povinný (https://drive.google.com/…, docs.google.com/…)
  const link = typeof meta.link === "string" ? meta.link.trim().slice(0, 300) : "";
  if (!/^https:\/\/([a-z0-9-]+\.)*google\.com\//i.test(link)) {
    return { error: "Vlož odkaz na svoje súbory na Google Drive (začína https://drive.google.com/…).", status: 400 };
  }

  // Roly členov tímu (napr. „Kameraman“) — len pre členov tímu, krátke texty
  const roles = {};
  if (meta.roles && typeof meta.roles === "object") {
    for (const id of ids) {
      const r = meta.roles[id];
      if (typeof r === "string" && r.trim()) roles[id] = r.trim().slice(0, 30);
    }
  }

  return {
    v: {
      cls,
      exId,
      roles,
      members: ids.sort(),
      ckN: Number(meta.ckN) || 0,
      ckT: Number(meta.ckT) || 0,
      fc: Number(meta.fc) || 0,
      imgN: 0, // doplní sa zo skutočne odoslaných obrázkov
      comm: String(meta.comm ?? "").slice(0, 1200),
      link
    }
  };
}

// Očistí požiadavku z prehliadača: povolí len systémový text a jednu správu žiaka
// (text + obrázky). Vracia { system, messages, imgN } alebo { error }.
function sanitizeRequest(system, messages) {
  let sys;
  if (typeof system === "string") {
    sys = [{ type: "text", text: system }];
  } else if (Array.isArray(system)) {
    sys = system
      .filter(b => b && b.type === "text" && typeof b.text === "string")
      .map(b => ({
        type: "text",
        text: b.text,
        ...(b.cache_control && b.cache_control.type === "ephemeral" ? { cache_control: { type: "ephemeral" } } : {})
      }));
  } else {
    sys = [];
  }
  if (sys.reduce((n, b) => n + b.text.length, 0) > MAX_SYSTEM_CHARS) return { error: "Systémový prompt je príliš dlhý." };

  if (!Array.isArray(messages) || messages.length !== 1 || messages[0]?.role !== "user" || !Array.isArray(messages[0].content)) {
    return { error: "Neplatný formát správy." };
  }
  let textChars = 0, imgN = 0;
  const content = [];
  for (const b of messages[0].content) {
    if (b && b.type === "text" && typeof b.text === "string") {
      textChars += b.text.length;
      content.push({ type: "text", text: b.text });
    } else if (b && b.type === "image" && b.source?.type === "base64"
      && IMG_TYPES.includes(b.source.media_type) && typeof b.source.data === "string"
      && b.source.data.length <= MAX_IMAGE_CHARS) {
      if (++imgN > MAX_IMAGES) return { error: `Najviac ${MAX_IMAGES} obrázky na jedno odovzdanie.` };
      content.push({ type: "image", source: { type: "base64", media_type: b.source.media_type, data: b.source.data } });
    } else {
      return { error: "Správa obsahuje nepovolený alebo príliš veľký prvok (obrázok max. ~1,2 MB po zmenšení)." };
    }
  }
  if (!content.length || textChars > MAX_TEXT_CHARS) return { error: "Text odovzdania je prázdny alebo príliš dlhý." };
  return { system: sys.length ? sys : undefined, messages: [{ role: "user", content }], imgN };
}

async function saveAttempt(v, result, err) {
  const attempt = {
    ...stamp(),
    ckN: v.ckN, ckT: v.ckT, fc: v.fc, imgN: v.imgN, comm: v.comm, link: v.link,
    ...(err ? { err: String(err).slice(0, 160) } : {}),
    ...(Object.keys(v.roles).length ? { roles: v.roles } : {}),
    pending: !result,
    ...(result || {})
  };
  const hash = subsKey(v.cls.id);
  await cmd("SADD", "projects", PROJECT);
  const key = `${v.exId}|${v.members.join("+")}`;
  const cur = await cmd("HGET", hash, key);
  const rec = cur ? JSON.parse(cur) : { exId: v.exId, members: v.members, attempts: [] };
  rec.attempts.push(attempt);
  if (rec.attempts.length > 10) rec.attempts = rec.attempts.slice(-10);
  await cmd("HSET", hash, key, JSON.stringify(rec));
  return attempt;
}

// Z odpovede AI vytvorí hodnotenie. Body kritérií sa orežú na maximum, „total“ je ich
// súčet a známku určuje server podľa tabuľky (AI sa pri sčítaní občas pomýli).
// Vracia { result } alebo { err } ("truncated" = odrezané na max_tokens, "bad_json").
function parseAI(data, v) {
  const txt = (data.content || []).map(b => b.text || "").join("").trim();
  try {
    let s = txt.replace(/```json|```/g, "").trim();
    // AI niekedy pridá vetu pred/za JSON — vezmeme len objekt od prvej { po poslednú }
    const a = s.indexOf("{"), b = s.lastIndexOf("}");
    if (a >= 0 && b > a) s = s.slice(a, b + 1);
    const p = JSON.parse(s);

    const raw = (p.criteria && typeof p.criteria === "object") ? p.criteria : {};
    const criteria = {};
    let haveAll = true, sum = 0;
    for (const [k, max] of Object.entries(CRIT_MAX)) {
      const n = Number(raw[k]);
      if (!Number.isFinite(n)) { haveAll = false; continue; }
      criteria[k] = Math.max(0, Math.min(max, Math.round(n)));
    }
    // Bez obrázka AI nevidí výsledok práce — kvalita a kompozícia max. 40 % (10 z 25 b.)
    if (haveAll && v && v.imgN === 0) criteria.key = Math.min(criteria.key, 10);
    if (haveAll) sum = Object.values(criteria).reduce((x, y) => x + y, 0);

    let total = haveAll ? sum : Math.max(0, Math.min(100, parseInt(p.total) || 0));
    if (!haveAll && v && v.imgN === 0) total = Math.min(total, 75);

    return {
      result: {
        grade: gradeFor(total),
        total,
        criteria: haveAll ? criteria : {},
        strengths: String(p.strengths || "Práca bola odovzdaná.").slice(0, 700),
        improvements: String(p.improvements || "Doplň konkrétnejší komentár a snímky obrazovky.").slice(0, 900),
        summary: String(p.summary || "Automatické hodnotenie.").slice(0, 500)
      }
    };
  } catch {
    return { err: data.stop_reason === "max_tokens" ? "truncated (max_tokens)" : "bad_json" };
  }
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed. Use POST." });
    return;
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    res.status(500).json({
      error: "Server nemá nastavený ANTHROPIC_API_KEY. Pridaj ho v Vercel → Settings → Environment Variables a znovu nasaď projekt."
    });
    return;
  }

  const { system, messages, meta } = req.body || {};
  if (!messages) {
    res.status(400).json({ error: "Chýba pole 'messages' v tele požiadavky." });
    return;
  }
  const clean = sanitizeRequest(system, messages);
  if (clean.error) {
    res.status(400).json({ error: clean.error });
    return;
  }

  const useDb = dbConfigured();
  let v = null;
  if (useDb) {
    try {
      const m = await resolveMeta(meta);
      if (m.error) {
        res.status(m.status).json({ error: m.error });
        return;
      }
      v = m.v;
      v.imgN = clean.imgN;
    } catch (e) {
      res.status(500).json({ error: "Databáza nie je dostupná.", details: String(e.message || e) });
      return;
    }
  }

  // Zaznamená odovzdanie bez známky, aby ho učiteľ videl aj keď AI zlyhala.
  const savePending = async (reason) => {
    if (!v) return false;
    try { await saveAttempt(v, null, reason); return true; } catch { return false; }
  };

  try {
    const headers = {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01"
    };
    // Voliteľné: ak API kľúč funguje na viacerých workspace-och (identity-linked kľúč),
    // Anthropic API vyžaduje aj túto hlavičku (ANTHROPIC_WORKSPACE_ID vo Vercel Environment Variables).
    if (process.env.ANTHROPIC_WORKSPACE_ID) {
      headers["anthropic-workspace-id"] = process.env.ANTHROPIC_WORKSPACE_ID;
    }

    const anthropicRes = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers,
      body: JSON.stringify({
        model: MODEL,
        max_tokens: MAX_OUT_TOKENS,
        system: clean.system,
        messages: clean.messages
      })
    });

    const data = await anthropicRes.json();

    if (!anthropicRes.ok) {
      const msg = data?.error?.message || "Chyba pri volaní Anthropic API.";
      const savedPending = await savePending(`api ${anthropicRes.status}: ${msg}`);
      res.status(anthropicRes.status).json({
        error: msg,
        details: data,
        savedPending
      });
      return;
    }

    const parsed = parseAI(data, v || { imgN: clean.imgN });
    const result = parsed.result;
    if (!result) {
      const savedPending = await savePending(parsed.err);
      res.status(502).json({ error: "Odpoveď AI sa nedala spracovať.", reason: parsed.err, savedPending });
      return;
    }

    if (!v) {
      // Databáza nie je nastavená — hodnotenie sa vráti, ale neuloží
      res.status(200).json({ ...data, saved: false, reason: "no_db", record: result });
      return;
    }

    let attempt;
    try {
      attempt = await saveAttempt(v, result);
    } catch (e) {
      res.status(200).json({ ...data, saved: false, reason: "db_error", record: result });
      return;
    }
    res.status(200).json({ ...data, saved: true, record: attempt });
  } catch (err) {
    const savedPending = await savePending("network: " + String(err).slice(0, 100));
    res.status(500).json({ error: "Nepodarilo sa spojiť s Anthropic API.", details: String(err), savedPending });
  }
}
