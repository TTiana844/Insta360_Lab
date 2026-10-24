// /api/config.js
// Verejná (bez hesla) konfigurácia pre žiakov. Žiak pošle KÓD TRIEDY (?code=…) a dostane
// zoznam mien len tej triedy, ku ktorej kód patrí. Bez kódu sa nevráti žiadne meno ani
// názov triedy. Vracia len id a mená — žiadne známky ani odovzdania.

import { dbConfigured, findClassByCode, normCode } from "./_db.js";

const sleep = ms => new Promise(r => setTimeout(r, ms));

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  if (!dbConfigured()) {
    res.status(200).json({ ok: false, reason: "no_db" });
    return;
  }
  try {
    const code = normCode(req.query && req.query.code);
    if (!code) {
      res.status(200).json({ ok: false, reason: "need_code" });
      return;
    }
    const cls = await findClassByCode(code);
    if (!cls) {
      await sleep(500); // spomalí hádanie kódu
      res.status(200).json({ ok: false, reason: "bad_code" });
      return;
    }
    res.status(200).json({
      ok: true,
      cls: {
        id: cls.id,
        name: cls.name,
        students: cls.students.filter(s => s.name)
      }
    });
  } catch (e) {
    res.status(500).json({ ok: false, reason: "db_error", error: String(e.message || e) });
  }
}
