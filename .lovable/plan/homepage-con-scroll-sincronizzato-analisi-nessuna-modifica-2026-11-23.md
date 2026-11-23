# Homepage con scroll sincronizzato — analisi (nessuna modifica)

## 1. Fatti verificati
- Homepage: `src/routes/index.tsx` (239 righe). TanStack Start v1 + React 19, Vite 7, Tailwind v4 con token in `src/styles.css`.
- Animazioni presenti: solo transizioni Tailwind con `motion-reduce:`, Embla + Auto Scroll per le recensioni (`HomeReviews`), video in `AudienceVideo` configurati in `src/lib/home-videos.ts`. Nessuna libreria di scroll (niente framer-motion, GSAP, Lenis); un solo `@keyframes` nel CSS.
- Struttura attuale: header, hero con titolo, selettore mobile «Cerco turni / Cerco personale», due AudienceCard (lavoratori con blocco Academy, locali), FAQ, recensioni, suggerimenti, footer legale.
- CTA reali: `/auth?role=worker` («Cerco turni») e `/auth?role=restaurant` («Cerco personale»); `/auth` valida `role`, `ref`, `redirect`. Academy: `/academy` locale + esterno `https://accademy.pupillo.life/`.

## 2. Asset esistenti
- `pupillo-logo-completo.png.asset.json` (logo completo, PNG con trasparenza, 1,1 MB) e `pupillo_logo.png.asset.json` (logo precedente).
- `src/assets/pupillo-mascot.png`: 1254×1254 **RGB senza canale alpha** (non scontornata), file binario nel repo, usata da AudienceVideo.
- Poster e video lavoratori/ristoratori (v1–v4, «finale», stream): scene composite con sfondo, non riutilizzabili come mascotte isolata.
- `partner_restaurant_logo.jpg`: logo partner, non pertinente.
- Conclusione: **nessuna posa della mascotte trasparente** disponibile; va creata.

## 3. Cosa creare davvero
Minimo necessario:
- Telefono in CSS/HTML (cornice + UI reale con classi Tailwind): inclinazione e raddrizzamento con `transform` 3D, schede mansione/zona/esperienza come elementi HTML modificabili e traducibili. Nessuna sequenza fotografica.
- 4 pose mascotte PNG/WebP con alpha: (1) saluto in hero, (2) indica il telefono, (3) porge/accompagna la scheda verso «I miei contatti», (4) festeggia sul CTA finale. Opzionale 5a: cappello Academy/libro.
- Specifiche pose: 1600×1600 px, soggetto ~80% dell'altezza, margine trasparente ≥8% per lato, piedi/base sulla stessa linea, vista 3/4 verso sinistra coerente con il logo, luce da alto-sinistra, ombra a terra separata (layer CSS), stesso giallo logo e viola. Export WebP alpha ≤150 KB ciascuna + PNG sorgente.
Opzionale: modello 3D riggato (Three.js) — sconsigliato: peso, tempi, nessun beneficio per 4 momenti. Un character sheet statico serve solo come riferimento per l'illustratore, non è animazione.

## 4. Proposta scenica (prototipo separato)
Route demo isolata, es. `/demo-home`, `noindex`, senza dati reali; la home live resta invariata.
```text
Scena 1 Hero bianca: «Il turno giusto. La persona giusta.» + CTA subito cliccabili, mascotte posa 1, telefono inclinato a destra
Scena 2 Scroll: telefono si raddrizza e centra; schede Mansione / Zona / Esperienza entrano e compongono un profilo esempio
Scena 3 Sfondo viola: la scheda esce dal telefono e vola in «I miei contatti»; testo: «Sblocchi un nuovo contatto una sola volta. Poi lo ricontatti senza costi di sblocco.» (29,70 € = 7 crediti, mascotte posa 3)
Scena 4 Accenno Academy: «Gratuita e facoltativa · due moduli in anteprima», link esterno
Scena 5 Finale: CTA «Cerco personale» / «Cerco lavoro», mascotte posa 4
```
- Tecnica: CSS scroll-driven animations (`animation-timeline: view()`) con fallback IntersectionObserver + classi; solo `transform`/`opacity`; sezioni `position: sticky`. Nessuna libreria nuova necessaria.
- Mobile: telefono più piccolo, una sola traiettoria verticale, niente parallasse laterale.
- `prefers-reduced-motion`: stati finali statici, nessuna scheda volante.
- Contenuti demo (profilo, nome, contatti) marcati come esempio, fuori da auth, pagamenti, ricerca e database.

## 5. Criticità rilevate
- Mascotte senza alpha e binario fuori da Lovable Assets.
- Copy: la home usa «Cerco turni», lo storyboard «Cerco lavoro»: decidere un'etichetta unica. Testi dashboard/billing «Paghi solo alla conferma del turno: 7 crediti» possono far pensare a un costo per turno; la regola reale (migrazione 0027) addebita solo la prima conferma della coppia locale–lavoratore. Allineare la demo a «nuovo contatto».
- Nota «A pagamento dal lancio» nella card locali: verificare coerenza con lancio già a pagamento.
- Logo completo da 1,1 MB: usare una versione WebP ottimizzata nella hero animata.

## Prossimo passo (se approvato)
Prototipo `/demo-home` con telefono CSS e segnaposto mascotte, in attesa delle 4 pose.
