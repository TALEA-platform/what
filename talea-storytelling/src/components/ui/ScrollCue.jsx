/**
 * Il segnale «c'è dell'altro sotto».
 *
 * Il punto critico di questa storia non è l'inizio — l'hero dice già «Scorri
 * per iniziare» — ma la fine delle sequenze automatiche: chi ha appena
 * guardato una mappa che si racconta da sola non sa se è finita, e resta fermo.
 *
 * Un chevron sottile che pulsa DUE volte e poi si ferma. Mai un loop infinito:
 * un'animazione che non finisce mai è ansia, due impulsi sono un invito. Il
 * componente viene montato quando la sequenza si conclude, quindi i due
 * impulsi partono nel momento in cui servono.
 *
 * `variant` sceglie la tavolozza: "dark" (sopra una mappa o un fondo scuro) o
 * "light" (su carta). L'etichetta è facoltativa e arriva sempre dai dati.
 *
 * `loop` fa oscillare il chevron senza fermarsi. È l'eccezione, non la regola:
 * vale dove il cue non chiude una sequenza ma sta in fondo a un blocco che il
 * lettore può guardare a lungo (l'intro degli hotspot), e dove fermarsi dopo
 * due impulsi vorrebbe dire che chi si è fermato a leggere trova una freccia
 * morta. Sotto una sequenza automatica appena finita si usa il default.
 */
export function ScrollCue({ label, variant = "dark", loop = false, className = "" }) {
  return (
    <div
      className={`scroll-cue scroll-cue--${variant}${loop ? " scroll-cue--loop" : ""}${className ? ` ${className}` : ""}`}
      aria-hidden="true"
    >
      {label ? <span className="scroll-cue-label">{label}</span> : null}
      <svg className="scroll-cue-chevron" viewBox="0 0 24 24" focusable="false">
        <path
          d="M5 9l7 7 7-7"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </div>
  );
}
