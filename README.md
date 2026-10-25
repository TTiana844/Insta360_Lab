# Insta360 Lab — odovzdávací systém s AI hodnotením

Statická webová aplikácia (`index.html`) + Vercel serverless funkcie v `api/`, ktoré
bezpečne volajú Anthropic API, hodnotenie ukladajú do databázy a poskytujú učiteľovi
tabuľku známok. API kľúč sa nikdy neposiela do prehliadača — žije len na serveri ako
premenná prostredia. Rovnaká architektúra ako MIDI Keys, Launchpad, Audio Lab a OBS Lab.

## Štruktúra projektu

```
.
├── index.html                # celá aplikácia (frontend, 10 cvičení, tutoriály)
├── Insta360_Ucebnica.pdf     # celá učebnica (25 strán), cvičenia odkazujú na konkrétne strany
├── img/                      # 26 ilustrácií z učebnice (cvNN-K.jpg), načítavajú sa až pri otvorení tutoriálu
├── api/
│   ├── evaluate.js           # overí odovzdanie, zavolá Anthropic API a výsledok uloží do databázy
│   ├── config.js             # verejne: aktívna trieda a mená na výber pre žiakov
│   ├── teacher.js            # chránené heslom: tabuľka, triedy, ručné známky, mazanie
│   └── _db.js                # pomocná vrstva nad Upstash Redis (nie je samostatná adresa)
├── package.json
├── .gitignore
└── README.md
```

## Cvičenia a učebnica

Cvičenia zodpovedajú učebnici. V appke má každé cvičenie tlačidlo
**„Podrobný výklad — Cvičenie N v učebnici (str. X)“**, odkaz na **Slovník pojmov (str. 1)**
a na **celú učebnicu**; hlavička appky má dlaždicu „Celá učebnica (PDF)“.

| Cv. | Téma | Str. v PDF | Typ |
|---|---|---|---|
| 1 | Príprava kamery a prvý testovací záber | 4 | individuálne alebo tímové |
| 2 | Nakrúcanie a kompozícia v 360° priestore | 8 | individuálne alebo tímové |
| 3 | Import, Stitching a stabilizácia v Insta360 Studio | 11 | individuálne alebo tímové |
| 4 | Reframe a Keyframes v Insta360 Studio | 13 | individuálne alebo tímové |
| 5 | Export a voľba kodekov | 15 | individuálne alebo tímové |
| 6 | VR sekvencia v Premiere Pro | 17 | individuálne alebo tímové |
| 7 | Pokročilý reframe, keyframes a Whip Pan | 19 | individuálne alebo tímové |
| 8 | Lumetri Color a zvuk | 20 | individuálne alebo tímové |
| 9 | Tímový projekt (Režisér, Kameraman, Strihač / DIT) | 22 | **tímové** (predvolene), možno aj individuálne |
| 10 | Finálny export a protokol | 24 | individuálne alebo tímové |

Slovník pojmov je na str. 1, schémy zapojenia na str. 2, rozloženie okien programov na str. 3
a tabuľka klasifikácie na str. 25. Ak PDF premenuješ, uprav konštantu `BOOK` v `index.html`;
ak zmeníš strany, uprav `page:` pri jednotlivých cvičeniach a `BOOK_PAGES`.

Hodnotiace kritériá sú rovnaké pre všetky cvičenia (podľa učebnice): technické zvládnutie 35 b.,
kvalita a kompozícia 25 b., postup a workflow 20 b., protokol a dokumentácia 20 b.
Známka: 86–100 = 1, 70–85 = 2, 56–69 = 3, 40–55 = 4, 0–39 = 5.

## Tímová práca vo všetkých cvičeniach

Každé z 10 cvičení sa dá robiť **samostatne alebo v tíme** (2 až 4 členovia, odporúčané 3).
Žiak si režim prepne tlačidlami *Tímové / Individuálne* nad formulárom. Predvolene je
cvičenie 9 tímové a ostatné individuálne.

V tímovom režime appka ukáže **rozdelenie úloh** (3 odporúčané roly a čo každá robí), tímové
znenie zadania a pridá do Selfchecku položku *„Úlohy v tíme rozdelené podľa rolí a v komentári je
uvedené, kto čo urobil“* (cvičenie 9 ju má vo vlastnom znení). Pri prepnutí späť na individuálne
režim položka zmizne a nezapočíta sa.

| Cv. | Roly v tíme |
|---|---|
| 1 | Technik kamery · Operátor aplikácie · Kameraman |
| 2 | Kameraman · Režisér · Asistent / DIT |
| 3 | DIT / import · Operátor zošitia · Kontrola kvality |
| 4 | Strihač / reframe · Režisér pohľadu · Operátor AI sledovania |
| 5 | Exportný technik · Kontrola formátov · Správca súborov / DIT |
| 6 | Strihač · Operátor plug-inu · Správca projektu / DIT |
| 7 | Animátor kamery · Strihač prechodov · Režisér |
| 8 | Kolorista · Zvukový technik · Kontrola kvality |
| 9 | Režisér · Kameraman · Strihač / DIT |
| 10 | Exportný technik · Autor protokolu · Správca odovzdania |

- **Jedno odovzdanie za celý tím** — započíta sa každému členovi, odovzdať ho stačí jednému.
  Tím musí mať pri odovzdaní aspoň 2 členov.
- **Hodnotenie je spoločné pre celý tím.** AI pri tíme vyká, pozná roly a ich úlohy a v kritériu
  „postup a workflow“ posudzuje aj to, či komentár uvádza, kto čo urobil (ak rozdelenie úloh
  v komentári vôbec chýba, je toto kritérium obmedzené na 70 % maxima). Technické kritériá a
  dokumentáciu hodnotí podľa dôkazov rovnako ako pri jednotlivcovi.
- **Učiteľ** vidí v tabuľke značku 👥, v detaile členov aj s rolami a môže zadať **ručnú známku
  len jednému členovi** (nerovný podiel práce).
- Ak žiak odovzdá to isté cvičenie samostatne aj v tíme, do tabuľky sa započíta lepší výsledok
  (bunka je označená ⚠).
- Server nemusel meniť nič — už predtým prijímal 1 až 4 členov a roly pri každom cvičení.
  Roly a ich popisy sú v poli `EX` v `index.html` (`roles`, `plan`, `goalTeam`).

## Ako to funguje (odovzdávanie do databázy)

- **Trieda a žiaci:** učiteľ vloží zoznam mien (max. 40) a tým vytvorí triedu. Každá trieda má
  **kód triedy** (6 znakov, zobrazený v Učiteľskom prehľade, tlačidlo „Nový kód“). Žiak ho zadá
  raz (prehliadač si ho zapamätá, v appke je „Zmeniť triedu“) a uvidí **zoznam mien len svojej
  triedy** — zoznamy ostatných tried ani ich názvy nevidí. Môžu tak naraz pracovať napr. prváci
  aj štvrtáci, „aktívnu triedu“ netreba prepínať. Server pri odovzdaní overí, že kód aj členovia
  patria do tej istej triedy. Žiaci si vyberú meno zo zoznamu — nepíšu ho, preto sa mená nerozchádzajú. Tím sa skladá
  z 2 až 4 mien zo zoznamu, každý člen má rolu z ponuky daného cvičenia (pozri „Tímová práca“).
- **Jedno odovzdanie = jedno cvičenie pre jedného žiaka alebo pre celý tím.** Tímové odovzdanie
  sa započíta každému členovi; odovzdať ho stačí jednému.
- **Povinné pri odovzdaní:** meno zo zoznamu, aspoň jeden súbor (screenshot alebo video),
  komentár (min. 15 znakov) a **odkaz na Google Drive** (`https://drive.google.com/…`).
  Odkaz sa overuje v prehliadači aj na serveri a ukladá sa k odovzdaniu.
- **Selfcheck** (zoznam pred odovzdaním) je len tvrdenie žiaka — AI ho nepočíta ako dôkaz.
- **Hodnotenie ukladá server**, nie prehliadač žiaka. Žiak nič nesťahuje ani neposiela a nemá
  kde upraviť známku. Body kritérií a známku **prepočíta server** (kritériá sa orežú na maximum,
  `total` je ich súčet, známka podľa tabuľky), takže sa AI nemôže pomýliť v sčítaní.
- **Opakované odovzdanie:** uchová sa posledných 10 pokusov, do tabuľky ide najlepší.
- **Ak AI zlyhá**, odovzdanie sa zaznamená ako „čaká na ručné hodnotenie“ (v tabuľke „…“) a
  známku zadáš ručne. Žiak dostane len orientačný odhad.
- **Učiteľ** (záložka *Učiteľský prehľad*, za heslom) vidí tabuľku žiaci × 10 cvičení, v detaile
  komentár žiaka, odkaz na Google Drive, role v tíme a hodnotenie AI. Môže zadať ručnú známku
  (platí len pre daného žiaka) a exportovať tabuľku do CSV pre Excel.
- **Nový školský rok:** *Nová trieda* → vlož nový zoznam. Stará trieda ostáva uložená aj s
  hodnoteniami (prepínač hore).
- **Viac projektov, jedna databáza:** zoznam tried je spoločný pre všetky aplikácie, ktoré
  používajú tú istú databázu. Odovzdania a ručné známky sú oddelené podľa projektu (konštanta
  `PROJECT = "insta360"` v `api/_db.js`). Zmazanie triedy zmaže jej známky vo všetkých projektoch.
- Súbory sa do databázy neukladajú — AI vidí screenshoty pri odovzdaní, videá a súbory majú žiaci
  na Google Drive. Priložené súbory sa po obnovení stránky nezachovajú (komentár, Selfcheck a
  odkaz na Drive áno).

## Tokeny, náklady a bezpečnosť

- **Model:** predvolene `claude-haiku-4-5-20251001`. Model určuje **server** (premenná prostredia
  `EVAL_MODEL`, nepovinná) — prehliadač ho nevie zmeniť. Na zmenu modelu stačí nastaviť
  `EVAL_MODEL` vo Verceli a spraviť Redeploy, bez úpravy kódu.
- **Výstup:** `max_tokens` = 1000 (nastavené na serveri). JSON so štyrmi číslami a tromi krátkymi
  textami má zvyčajne 300–500 tokenov; prompt obmedzuje dĺžku textov (zhrnutie 1–2 vety, silné
  stránky 1–2 vety, zlepšenia 2–3 vety). Ak by sa odpoveď predsa odrezala, odovzdanie sa uloží
  ako „čaká na ručné hodnotenie“.
- **Vstup:**
  - obrázky sa v prehliadači **zmenšia** (dlhšia strana max. 1400 px, JPEG) — zlacní vstup a
    zároveň obchádza limit Vercelu ~4,5 MB na telo požiadavky (pôvodné screenshoty z 4K
    monitorov by ho prekročili),
  - AI dostane **najviac 4 obrázky** na odovzdanie, ďalšie sa len zaznamenajú,
  - systémový prompt je rozdelený na veľký spoločný blok pravidiel a malý blok s referenčnými
    údajmi len k jednému cvičeniu (hodnoty z učebnice, podľa ktorých AI overuje správnosť).
- **Prompt caching:** spoločný blok má značku `cache_control`. Pri Haiku 4.5 sa však ukladá do
  cache až od cca 4096 tokenov, a spoločný blok je kratší — úspora teda zatiaľ nenastáva (a nič sa
  tým nepokazí). Pri prechode na väčší model alebo dlhší prompt sa zapne automaticky.
- **Server sám kontroluje požiadavku:** povolí len systémový text a jednu správu žiaka (text +
  max. 4 obrázky v povolených formátoch), pevne nastaví model a limit výstupu. Tak sa z
  `/api/evaluate` nedá spraviť všeobecný prístup k API kľúču.
- **Hodnotenie bez obrázka:** kritérium „kvalita a kompozícia“ je automaticky obmedzené na 10 z 25 b.
  (AI videá nevidí).
- **Jazyk odpovedí:** prompt vyžaduje spisovnú slovenčinu s diakritikou, zákaz českých slov
  (pokud, taky, především…), tykanie pri jednotlivcovi a vykanie pri tíme, bezrodové formulácie,
  zachovanie anglických názvov funkcií (Reframe, Keyframe, Lumetri Color…) a pokojný tón kouča.

Odhad nákladov: jedno odovzdanie (text + 2–4 zmenšené screenshoty) je rádovo desatiny centu až
niekoľko tisícin USD pri Haiku. Odporúčame nastaviť v
[console.anthropic.com](https://console.anthropic.com) pri API kľúči tvrdý limit výdavkov.

## 1. Nahratie na GitHub

```bash
git init
git add .
git commit -m "Insta360 Lab - ucebnica, databaza, AI hodnotenie"
git branch -M main
git remote add origin https://github.com/<tvoj-ucet>/<repo>.git
git push -u origin main
```

## 2. Import projektu do Vercelu

1. vercel.com → Add New → Project.
2. Vyber svoj GitHub repozitár.
3. Framework Preset: **Other**. Build Command a Output Directory nechaj prázdne/predvolené.

## 3. Nastavenie API kľúča

1. Settings → Environment Variables:
   - Name: `ANTHROPIC_API_KEY`
   - Value: kľúč z console.anthropic.com/settings/keys
   - Environment: Production, Preview aj Development.
2. Deployments → Redeploy (bez „Use existing Build Cache“).
3. API kľúč nikdy neukladaj do súborov v repozitári — patrí len do Environment Variables.

### Databáza (Upstash Redis)

1. Vo Verceli otvor projekt → **Storage** (alebo **Marketplace**) → **Upstash Redis** → vytvor
   databázu (bezplatný plán, región v EÚ) a **Connect Project**. Ak už databázu máš z iného
   projektu (Launchpad, MIDI Keys, Mixpult), pripoj tú istú — zoznam tried sa potom zdieľa.
2. Vercel sám pridá premenné `KV_REST_API_URL` a `KV_REST_API_TOKEN` (alebo
   `UPSTASH_REDIS_REST_URL` a `UPSTASH_REDIS_REST_TOKEN` — podporované sú obe dvojice).

### Heslo učiteľa

Vo Vercel → Settings → Environment Variables pridaj `TEACHER_PASSWORD` (môže byť rovnaké vo
všetkých projektoch), Production + Preview + Development, potom **Redeploy**.

### Prvé spustenie

Otvor appku → **Učiteľský prehľad** → prihlás sa heslom → **Nová trieda** → názov (napr.
`4.A 2026/27`) a zoznam žiakov, jeden na riadok → **Uložiť**. (Ak triedu už vytvoril iný projekt
na rovnakej databáze, objaví sa tu automaticky.)

## 4. Otestovanie

Vyber cvičenie, rozbaľ tutoriál a over, že sa zobrazujú ilustrácie. Klikni na „Podrobný výklad —
Cvičenie N v učebnici“ a over, že sa PDF otvorí na správnej strane. Vyber svoje meno, prilož
screenshot, vlož odkaz na Google Drive, napíš komentár a odošli — appka zavolá `/api/evaluate`,
vráti AI hodnotenie a odovzdanie sa objaví v učiteľskej tabuľke.

## Aktualizácia obsahu

Texty cvičení sú v poli `EX` v `index.html`. Učebnicu nahradíš súborom `Insta360_Ucebnica.pdf`
(po zmene rozsahu skontroluj čísla strán). Pri novej verzii učebnice v rovnakom rozsahu stačí
nahradiť súbor.
