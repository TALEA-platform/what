import { TitleSprig } from "../ui/TitleSprig";
import { dataSources, closingFinal } from "../../data/taleaProject";

// Minimal line icons for the five public tools, drawn from what each shows:
// the platform hub, heat, history, refuges and shadow.
const ICONS = {
  hub: (
    <>
      <circle cx="12" cy="12" r="2.4" />
      <circle cx="12" cy="4.2" r="1.7" />
      <circle cx="12" cy="19.8" r="1.7" />
      <circle cx="4.2" cy="8" r="1.7" />
      <circle cx="19.8" cy="8" r="1.7" />
      <circle cx="4.2" cy="16" r="1.7" />
      <circle cx="19.8" cy="16" r="1.7" />
      <path d="M12 9.6V6M12 14.4v3.6M9.9 10.8 5.7 8.6M14.1 10.8l4.2-2.2M9.9 13.2l-4.2 2.2M14.1 13.2l4.2 2.2" />
    </>
  ),
  heat: (
    <>
      <path d="M11 13.6V5a2 2 0 0 1 4 0v8.6a3.4 3.4 0 1 1-4 0Z" />
      <path d="M13 14.4a1.4 1.4 0 1 0 0 2.8 1.4 1.4 0 0 0 0-2.8Z" fill="currentColor" stroke="none" />
    </>
  ),
  history: (
    <>
      <path d="M3.6 12a8.4 8.4 0 1 1 2.5 6" />
      <path d="M3.4 20v-3.4H6.8" />
      <path d="M12 7.6V12l3 1.8" />
    </>
  ),
  refuge: (
    <>
      <path d="M4 11 12 4l8 7" />
      <path d="M12 4v16" />
      <path d="M6.5 11v9h11v-9" />
    </>
  ),
  shadow: (
    <>
      <circle cx="10" cy="9" r="4.4" />
      <path d="M10 3.2v1.6M10 13.2v1.6M4.2 9H2.6M17.4 9h-1.6M5.9 4.9 4.8 3.8M15.2 4.9l1.1-1.1" />
      <path d="M8 16.5c3.5 0 6.5 1 10 2.7-3.5 1.2-6.9 1.6-10 1.1" fill="currentColor" stroke="none" opacity="0.28" />
    </>
  ),
};

function SourceIcon({ name }) {
  return (
    <svg
      className="source-icon-svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {ICONS[name] || ICONS.hub}
    </svg>
  );
}

/**
 * The open-data close. Participation now belongs to TaleaProjectSection, where
 * it sits with the project that makes it possible.
 */
export function ClosingSection() {
  return (
    <section className="closing-chapter" aria-labelledby="sources-title" lang="it">
      {/* ── La chiusura ──
          Una schermata sola, su un fondo suo, con sopra la talea disegnata con
          cui la storia si era aperta. Il perché sta in `.closing-final`
          (story.css): qui basta sapere che questo blocco non è l'introduzione
          della griglia che segue, è la fine del racconto. */}
      <div className="closing-final">
        {/* Le due foglie ai lati sono lo stesso disegno che apre il capitolo
            delle cause (`.causes-intro-leaf`): stesso file, stessa porzione
            dello sprite, quella di destra specchiata. Là annunciava un
            capitolo, qui ne chiude uno, e usare due volte la stessa figura è il
            modo più economico che la pagina ha di dire che è la stessa mano. */}
        <span className="closing-final-leaf closing-final-leaf--left" aria-hidden="true" />
        <span className="closing-final-leaf closing-final-leaf--right" aria-hidden="true" />
        <div className="closing-final-inner">
          <TitleSprig className="closing-final-sprig" />
          <p className="closing-final-standout">{closingFinal.standout}</p>
        </div>
      </div>

      {/* ── The open data behind every map ── */}
      <div className="sources-band">
        <div className="sources-inner">
          <div className="sources-head">
            <h2 id="sources-title" className="sources-title">{dataSources.title}</h2>
            <p className="sources-intro">{dataSources.intro}</p>
          </div>
          <div className="sources-grid">
            {dataSources.apps.map((app) => (
              <a
                key={app.id}
                className={`source-card${app.feature ? " source-card--feature" : ""}`}
                href={app.href}
                target="_blank"
                rel="noreferrer"
              >
                {/* Il nome PRIMA della sigla. La sigla è il nome dello
                    strumento sulla piattaforma (SCI, CRAF, HistorySUHI): serve
                    a ritrovarlo, non a capire che cosa fa, e stampata sopra in
                    maiuscoletto era la prima cosa che si leggeva su ogni
                    scheda — quattro acronimi in fila prima di una sola parola
                    di italiano. */}
                <span className="source-card-head">
                  <span className="source-icon" aria-hidden="true">
                    <SourceIcon name={app.icon} />
                  </span>
                  <span className="source-heading">
                    <span className="source-name">{app.name}</span>
                    <span className="source-tag">{app.tag}</span>
                  </span>
                </span>
                <span className="source-desc">{app.desc}</span>
                {/* L'invito si vede sempre. Stava in posizione assoluta
                    nell'angolo e compariva solo al passaggio del mouse: su un
                    telefono non compariva mai, e per non finirgli addosso la
                    descrizione era tagliata a una riga con i puntini. Adesso
                    sta in fondo alla colonna, la descrizione va a capo quanto
                    le serve, e al mouse si muove solo la freccia. */}
                <span className="source-open">
                  {dataSources.openLabel}
                  <span className="source-open-arrow" aria-hidden="true">→</span>
                </span>
              </a>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
