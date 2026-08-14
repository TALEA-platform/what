# what
Talea Storytelling

La webapp React/Vite si trova in `talea-storytelling/`.

## Development

```sh
cd talea-storytelling
npm install
npm run dev
```

Durante `npm run dev`, il salvataggio di YAML o Markdown sotto `content/` (e delle configurazioni editoriali condivise) ricompila automaticamente il bundle e ricarica il browser. Il selettore nell'Header cambia IT/EN senza ricaricare la pagina; `?lang=it` e `?lang=en` sono URL condivisibili e la preferenza viene ricordata localmente.

## Build

Da `talea-storytelling/`, `npm run build` esegue data build runtime, compilazione e validazione bilingue del content e build Vite. Entrambe le lingue entrano nello stesso artifact `dist/`.

## Deploy

I push su `main` avviano `.github/workflows/deploy-pages.yml`: dipendenze, lint e build devono terminare correttamente prima che `dist/` venga pubblicata su GitHub Pages. Nelle impostazioni del repository, la sorgente di Pages deve essere **GitHub Actions**. Il flusso editoriale completo è descritto nella [Content guide](talea-storytelling/docs/CONTENT_GUIDE.md).

## Contenuti

Il content layer bilingue italiano/inglese comprende tutte le macrosezioni narrative, Metodo e fonti, Glossario e microcopy globale. Le istruzioni per modificare YAML e Markdown, gestire gli ID e mantenere la parità tra le lingue sono in [docs/CONTENT_GUIDE.md](talea-storytelling/docs/CONTENT_GUIDE.md).

## Dati

I testi traducibili vivono in `content/`; dataset, geometrie, raster e asset browser-ready restano distinti fra `public/data/`, `src/data/` e gli input esterni richiesti dalle pipeline. Provenienza, parametri, consumer, limiti e procedure note sono inventariati in [docs/DATA_SOURCES.md](talea-storytelling/docs/DATA_SOURCES.md).

La build normale (`npm run dev`, `npm run build` e `npm run data:build`) usa gli output runtime già presenti e non richiede `external/`. La rigenerazione delle pipeline scientifiche richiede invece gli input elencati in `config/data-inputs.json`: la root predefinita è `talea-storytelling/external/` e può essere sostituita con `TALEA_EXTERNAL_DATA`. Da `talea-storytelling/`, `npm run data:check-inputs` verifica presenza e checksum senza generare dati.

Molti file runtime sono output derivati. Non modificare direttamente CSV, JSON, GeoJSON, PNG o manifest senza aver prima verificato nel documento quale script e quale input li generano.
