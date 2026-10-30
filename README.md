# MAFIA — Orașul Umbrelor 🕯️

Un joc web multiplayer în română, 5–20 locuri (inclusiv boți). Proiect demo pentru testare cu prietenii. **Nu necesită domeniu cumpărat.**

## Caracteristici

- Intrare cu nickname și link/cod de cameră, fără cont.
- **67% Oraș / 33% Mafia aproximativ**: Mafia = `Math.round(numărul de jucători / 3)`, restul Oraș. La 5 jucători sunt **3 Oraș + 2 Mafia**; la 9 sunt 6+3; la 12 sunt 8+4. Rotunjirea este inevitabilă când numărul nu este multiplu de 3.
- Roluri din catalogul de 15: Detectiv, Doctor, Gardian, Observator, Temnicer, Judecător, Jurnalist, Vânător, Medium, Capcanier, Nașul, Asasinul, Infiltrat, Falsificator, Spion. **Toate au explicații în interfața site-ului**.
- **Zi 50 secunde în total:** 30 secunde conversație, apoi alte 20 secunde conversație + vot în paralel.
- La **9+ jucători** (număr stabilit la startul partidei), prima votare nominalizează doi suspecți. Cei doi au **15 secunde** să se apere (ambii pot vorbi, ceilalți ascultă), apoi **10 secunde** pentru votul final.
- La **5–8 jucători** rezultatul primului vot este direct (execuție numai cu majoritate absolută).
- **Noapte 45 secunde**. Noaptea zero fără ucideri pentru distribuirea rolurilor și capcane. Pentru 5–6 jucători Mafia nu poate ucide în prima noapte activă.
- Chat public, chat Mafia, canal pentru morți și Medium (server-side access control).
- **Boți pentru test**: în lobby, `Completează până la 5`, `+1 bot`, `Șterge boții`. Boții au acțiuni automate simple, nu sunt adversari cu strategie avansată.
- Sunete sintetizate local prin Web Audio, cu întrerupător ON/OFF, atmosferă întunecată și efecte animate în CSS. Nu sunt folosite fișiere audio cu drepturi de autor.
- Voice chat **experimental** prin WebRTC peer-to-peer pentru camere mici: buton `Intră în canalul vocal`, permisiune microfon opțională. Funcționează doar pe HTTPS/localhost; unele conexiuni între rețele necesită server TURN, care **nu este inclus**. Pentru mai mult de 8 oameni reali recomandăm voce externă și chatul în site.

## Cum pornești pe calculator

1. Instalează [Node.js](https://nodejs.org/) versiunea **20 sau mai nouă**.
2. Descarcă arhiva ZIP a proiectului și **dezarhivează-o** într-un folder, de exemplu `Desktop/mafia-power`.
3. Deschide Terminal (macOS/Linux) sau PowerShell (Windows) și intră în folderul proiectului (acela în care există `package.json`).
4. Rulează `npm install`.
5. Rulează `npm start`.
6. Deschide `http://localhost:3000` în browser.
7. Introdu un nume, creează o cameră, apasă `Completează până la 5`, bifează `Mod rapid pentru test` dacă vrei o partidă mai scurtă, apasă `Sunt pregătit` și `Începe partida`.

Important: `localhost` funcționează pe calculatorul tău, nu pe internet. Pentru ca prietenii să intre din altă locație, urmează pașii de deploy.

## Cum îl publici gratuit pe internet

1. Creează cont pe [GitHub](https://github.com/) și un repository nou, de exemplu `mafia-orasul-umbrelor`.
2. Apasă **Add file → Upload files**. Urcă **conținutul folderului `mafia-power`**, adică `package.json`, `server.js`, `public`, `tests` și `README.md`, NU doar arhiva ZIP. Confirmă cu **Commit changes**. Nu încărca `node_modules`.
3. Creează un cont pe [Render](https://render.com/), apoi conectează GitHub.
4. Selectează **New → Web Service**, repository-ul tău și planul **Free** (dacă disponibil).
5. Folosește setările:
   - Runtime / Language: **Node**
   - Build Command: `npm install`
   - Start Command: `npm start`
   - Environment variable opțională: `NODE_ENV=production`
6. Apasă **Deploy Web Service**. Dacă apare `Live`, deschide adresa oferită de Render, de forma `https://numele-tau.onrender.com`.
7. Creează o cameră, copiază linkul, trimite-l prin WhatsApp/Telegram. Prietenii trebuie doar să deschidă linkul și să introducă un nickname.

**Limitări hosting gratuit:** instanța Render poate intra în repaus după 15 minute fără trafic, iar camerele sunt păstrate momentan doar în memoria serverului, deci se pierd la restart sau redeploy. La prima accesare după pauză, pornirea poate dura. Acesta este un demo, nu o infrastructură persistentă sau sigură pentru competiții mari. Configurațiile de hosting se pot schimba.

## Actualizarea versiunii pe GitHub

Dacă ai deja un repository, înlocuiește în repository fișierele vechi cu cele din arhiva nouă (inclusiv `public/voice.js` și `tests/rules.cjs`) și fă **Commit changes**. Render redeployează automat dacă ai configurat Auto-Deploy.

## Regulile rolurilor

Deschide butonul **Regulile și rolurile** din antet. Sunt explicații pentru fiecare rol din Oraș și Mafia; în timpul jocului, cartea rolului primit arată abilitatea și numărul rămas de utilizări.

## Teste

`npm test` rulează simularea unei partide cu boți și testele de configurație, faze, proporții și informații private. Testele nu validează balansul în partide reale.

## Probleme cunoscute

- Nu toate interacțiunile dintre superputeri au fost evaluate cu oameni; jocul este un **MVP de test**.
- Voice chat este experimental, P2P, fără TURN și fără mecanism de moderare vocală; poate eșua între anumite rețele. Recomandă căști și acord explicit pentru folosirea microfonului.
- Încă nu există conturi, istoric persistent, moderare avansată sau stocarea camerelor după repornirea serverului.
- Boții votează simplificat și pot face greșeli. La numai 5 jucători, 2 Mafia / 3 Oraș este un format foarte volatil; procentul 33% este aproximativ, nu o garanție de echilibru.
