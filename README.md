# Insta360 Lab — odovzdávací systém s AI hodnotením

Statická webová aplikácia (`index.html`) + jedna Vercel serverless funkcia
(`api/evaluate.js`), ktorá bezpečne volá Anthropic API a vracia AI hodnotenie
odovzdanej práce. API kľúč sa nikdy neposiela do prehliadača — žije len na
serveri ako premenná prostredia.

## Štruktúra projektu

```
.
├── index.html          # celá aplikácia (frontend, 10 cvičení, tutoriály)
├── api/
│   └── evaluate.js      # serverless funkcia - volá Anthropic API
├── package.json
├── .gitignore
└── README.md
```

## 1. Nahratie na GitHub

Ak ešte nemáš repozitár:

```bash
git init
git add .
git commit -m "Insta360 Lab s AI hodnotením"
git branch -M main
git remote add origin https://github.com/<tvoj-ucet>/<repo>.git
git push -u origin main
```

Ak repozitár už existuje (napr. ten istý, čo používaš pre iné Lab projekty),
skopíruj do neho `index.html`, priečinok `api/` a `package.json` a commitni/pushni.

## 2. Import projektu do Vercelu

1. Choď na [vercel.com](https://vercel.com) → **Add New → Project**.
2. Vyber svoj GitHub repozitár.
3. Framework Preset nechaj na **Other** (nie je to Next.js/React projekt).
4. Build Command a Output Directory nechaj prázdne/predvolené — je to statický
   `index.html` + `api/` priečinok, Vercel ho rozpozná automaticky.

## 3. Nastavenie API kľúča (najdôležitejší krok)

1. V projekte na Vercel choď do **Settings → Environment Variables**.
2. Pridaj premennú:
   - **Name:** `ANTHROPIC_API_KEY`
   - **Value:** tvoj skutočný kľúč z [console.anthropic.com](https://console.anthropic.com/settings/keys)
   - **Environment:** zaškrtni Production, Preview aj Development.
3. Ulož a spusti **Redeploy** (Deployments → tri bodky pri poslednom deploji →
   Redeploy) — premenná sa načíta až pri novom builde.

Kľúč sa použije len vnútri `api/evaluate.js` (`process.env.ANTHROPIC_API_KEY`)
na serveri, nikdy nie je súčasťou `index.html` ani JS kódu, ktorý beží
v prehliadači.

## 4. Otestovanie

Po deployi otvor pridelenú `*.vercel.app` adresu, vyber ľubovoľné cvičenie,
zaškrtni pár bodov kontrolného zoznamu, **priprav aspoň jeden súbor (napr.
screenshot z Insta360 Studio alebo Premiere Pro)** a napíš konkrétny komentár
(min. 15 znakov) — bez toho appka odovzdanie odmietne. Potom klikni na
**„Odoslať na AI hodnotenie"**. Aplikácia zavolá `/api/evaluate`, ktorý
zavolá Anthropic API a vráti skutočné AI hodnotenie (známka, percentá,
kritériá, silné stránky, odporúčania) — vrátane reálnej analýzy priložených
obrázkov, nie len kontroly zaškrtnutých políčok.

Ak API z akéhokoľvek dôvodu zlyhá (chýbajúci kľúč, výpadok, chyba siete),
aplikácia sa automaticky prepne na lokálny náhradný odhad, ktorý tiež
zohľadňuje mieru dôkazu (priložený obrázok/detailný komentár), takže appka
nikdy nezamrzne ani nespadne, ale zároveň nikdy nevygeneruje vysoké skóre
len na základe zaškrtnutých políčok bez dôkazu.

## 5. Odovzdávanie a zber výsledkov (JSON)

Keďže appka beží ako statický web bez databázy, výsledky každého žiaka
zostávajú len v jeho prehliadači (`localStorage`). Po odoslaní práce sa
zobrazí tlačidlo **„Stiahnuť potvrdenie o odovzdaní (.json)"** — žiak tento
súbor pošle učiteľovi (mailom, cez EduPage a pod.).

Učiteľ v záložke **„Učiteľský prehľad"** klikne na **„Importovať odovzdania
(.json)"** a vyberie súbory od žiakov (možno vybrať aj viac naraz) — appka
ich automaticky pridá do prehľadu a preskočí duplicity. Tlačidlo
**„Exportovať zálohu všetkých"** slúži na priebežné zálohovanie zo
zariadenia učiteľa.

## Aktualizácia obsahu

Keďže je to jeden statický `index.html`, akákoľvek ďalšia úprava (texty,
cvičenia, tutoriály) = uprav súbor lokálne → commit → push. Vercel spraví
nový deploy automaticky pri každom pushi do sledovanej vetvy.

## Poznámka k modelu a nákladom

Serverless funkcia aj frontend používajú `claude-haiku-4-5-20251001` ako
predvolený model — pre štruktúrované hodnotenie podľa rubriky je plne
dostatočný a výrazne lacnejší než väčšie modely (Sonnet/Opus). Ak budeš
neskôr chcieť prejsť na iný model, stačí zmeniť reťazec `model` v
`index.html` (funkcia `submitWork`) — `api/evaluate.js` model len prepošle
ďalej, nemá ho natvrdo zakódovaný.

Systémový prompt je pri všetkých cvičeniach a všetkých žiakoch identický,
preto je odoslaný s **prompt caching** (`cache_control: {type:"ephemeral"}`)
— prvé volanie v danom čase zaplatí plnú cenu, opakované volania v krátkom
slede (cache je aktívny cca 5 minút od posledného použitia) stoja len zlomok
ceny za vstupnú časť promptu.

### Odhad nákladov

Pri Haiku 4.5 vychádza jedno odovzdanie (text + 1 obrázok) na približne
0,003–0,005 USD. Pri väčšom nasadení (napr. 150+ žiakov, 10 cvičení) to
znamená rádovo desiatky USD za celý školský rok, nie stovky.

**Odporúčanie:** v [console.anthropic.com](https://console.anthropic.com)
nastav pri API kľúči tvrdý spending limit (napr. 15–20 USD/mesiac), aby
appka nemohla minúť viac, než plánuješ — po dosiahnutí limitu API kľúč
prestane fungovať, appka sa automaticky prepne na lokálny náhradný odhad.
