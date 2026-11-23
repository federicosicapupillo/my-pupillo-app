# Regia Pupillo dal cappello — prova isolata (solo piano)

Nessuna modifica alla homepage pubblica, nessuna pubblicazione. La prova vive in una pagina interna separata, accanto a /demo-home, che resta com'è.

## 1. Ancoraggi reali della homepage (src/routes/index.tsx)
- **Partenza:** il cappello del logo grande nella hero (`img` sopra il titolo, 1041x649). Il cappello è decentrato nel logo: il punto di uscita va misurato sull'immagine autentica (coordinate in pixel del bordo del cappello, convertite in percentuale), senza valori presunti, e ricalcolato al ridimensionamento.
- **Sosta 1 — Per i lavoratori:** card `#per-lavoratori` (lato sinistro desktop), fumetto su candidatura e Academy facoltativa.
- **Sosta 2 — Per i locali:** card `#per-locali` (lato destro desktop), fumetto neutro sul trovare personale, oppure la formula esatta: «Paghi una sola volta per sbloccare un nuovo contatto; poi puoi ricontattarlo senza costi aggiuntivi.» Mai «per candidatura», «per turno» o «paghi solo alla conferma».
- **Sosta 3 — Come funziona:** `#come-funziona`, titolo «Come funziona, in pratica.»
- **Sosta 4 — Domande frequenti:** `#faq` (eventualmente blocco Academy ristoratori).
- **Arrivo:** inizio di HomeReviews, dove Pupillo saluta e si ferma.
- **Mobile:** le card sono una sola alla volta (selettore «Cerco turni / Cerco personale»), quindi le soste 1-2 diventano una sola sulla card visibile; Pupillo si appoggia al bordo alto delle sezioni, non ai lati.

## 2. Cosa manca
Esistono il logo completo (PNG circa 1,1 MB), una mascotte PNG (circa 2 MB) e il GLB base (circa 2,85 MB, 28.722 triangoli) senza rig né clip; questi dati descrivono solo il modello base, non un obiettivo di peso.
- **Modello:** rig sul GLB base, con un punto «bocca» per agganciare la coda del fumetto; peso finale da definire dopo le prove sui dispositivi.
- **Animazioni:** `idle_read` (in loop, fermo durante la lettura), `emerge_from_hat`, `jump_anticipation`, `jump_air` (arco), `land`, `settle`, `turn_left` e `turn_right`, `wave`, oltre a una posa statica per il movimento ridotto.
- **Logo diviso in livelli:** il cappello separato dal resto (bordo davanti e dietro), così Pupillo esce «da dentro». Questo non esiste ancora.
- **Immagini di riserva:** sequenze PNG o WebP (o pose fisse) per i dispositivi lenti, per il movimento ridotto e finché il GLB non è pronto.
- **Testi dei fumetti:** uno per sosta, approvati. Senza testi approvati uso segnaposto marcati «esempio».

## 3. Prova isolata e responsive
- Pagina interna nuova `/demo-pupillo` (noindex) che copia la struttura della home con gli stessi ancoraggi, senza toccare index.tsx né le sue funzioni.
- **Motore:** lo scroll in entrambe le direzioni muove l'avanzamento. Ogni tratto tra due soste ha preparazione, arco, atterraggio e assestamento; nelle soste Pupillo resta fermo per un'altezza di scroll dedicata.
- **Fase A (oggi, senza rig):** Pupillo come immagine 2D. La pagina di prova userà la mascotte PNG già esistente (da alleggerire), in attesa della versione leggera da preparare. L'«anticipo» e l'«atterraggio» si ottengono schiacciando e allungando l'immagine. Così si prova subito il percorso.
- **Fase B:** si sostituisce con il GLB caricato solo nel browser e solo dopo la visualizzazione, quando arrivano le animazioni.
- **Due varianti** scelte con un parametro: `?regia=cappello` (uscita dal logo) e `?regia=semplice` (Pupillo già presente vicino alla hero, solo discese).
- **Fumetti:** coda orientata verso la bocca. La posizione si calcola per non coprire il volto, i titoli e i pulsanti; i pulsanti restano sempre cliccabili.
- **Mobile (320/390):** percorso a zig-zag stretto vicino ai bordi, Pupillo più piccolo, fumetto sopra o sotto invece che di lato, una sola sosta per la card scelta.
- **Movimento ridotto:** niente salti; Pupillo fermo accanto a ogni sezione con il suo fumetto, testi completi.
- **Verifiche:** schermate a 320, 390 e desktop nelle due varianti, scroll avanti e indietro, pulsanti cliccabili, movimento ridotto, peso della pagina.
