import { useCallback, useEffect, useRef, useState } from "react";

const now = () =>
  typeof performance !== "undefined" ? performance.now() : Date.now();

/**
 * Timed reveal state machine shared by the self-playing story scenes — the
 * shadow map and the rifugio "sticky vignette" — the same family as the hotspot
 * sequence (HotspotMapScene), factored out so all three behave identically.
 *
 * Given an `engaged` flag (the scene has scrolled into view), it advances a head
 * through `count` stages on a timer: first a `startDelay` orientation beat so the
 * reader takes in the map/figure, then `readMs` between stages, then `complete`
 * a `tailMs` after the last one.
 *
 * `readMs` è un numero — lo stesso tempo per tutte le tappe — oppure un array di
 * durate, una per tappa. La seconda forma serve dove le tappe non si leggono
 * nello stesso tempo perché non sono lunghe uguali (05 § 5.4): passandogli un
 * array calcolato dai testi, la sequenza si accorcia da sola quando i testi si
 * accorciano. Se è un array, dev'essere una costante di modulo o memoizzato: qui
 * entra nelle dipendenze di un effetto.
 *
 * ── La pausa ────────────────────────────────────────────────────────────────
 * La sequenza si mette in PAUSA quando il lettore esce dalla scena (`engaged`
 * torna falso) o manda la scheda in secondo piano, e riprende da dov'era. Prima
 * i timer non si fermavano mai: chi risaliva un momento, o cambiava scheda per
 * venti secondi, tornava e trovava la sequenza già giocata — una scena che si
 * racconta da sola si era raccontata alla stanza vuota. E in secondo piano il
 * browser strozza i timer a un secondo l'uno, quindi non era nemmeno la
 * sequenza giusta.
 *
 * Il perno è `playedRef`: quanto della sequenza è già stato giocato. I timer si
 * buttano a ogni pausa e si ripianificano alla ripresa sul tempo che resta; le
 * tappe il cui istante è passato durante una pausa lunga si recuperano subito,
 * senza rigiocare l'attesa. Qui prima non c'era proprio cleanup, per non
 * congelare la costruzione a metà — il motivo era giusto, il rimedio no.
 *
 *   `activeIndex` — the stage currently on show. It follows the auto-play head
 *   (`revealed - 1`) until the reader takes over with the arrows
 *   (`goPrev`/`goNext`/`goTo`), which only work once the sequence has finished.
 *   `advanceTo` — porta la testa almeno a una tappa, mai indietro: è come lo
 *   scorrimento dentro l'hold fa avanzare la scena senza aspettare il timer.
 *   `forceComplete` — snap to the end (fast scroll past the hold, or a reader who
 *   would otherwise be stuck mid-play).
 *
 * `playbackRate` speeds up the same virtual timeline. Changing it reschedules
 * the remaining timers from the elapsed virtual time, so every stage still
 * fires instead of snapping the reveal head to the end.
 *
 * The stagger plays regardless of the OS "reduce motion" setting (Windows
 * Enterprise ships it ON by default, which would otherwise dump every stage at
 * once) — the same call the hero zoom makes. The CSS keeps the entrance too.
 */
export function useTimedSequence({
  count,
  engaged,
  startDelay = 1500,
  readMs = 5200,
  tailMs = 700,
  pickDuringPlay = false,
  playbackRate = 1,
}) {
  const [revealed, setRevealed] = useState(0); // how many stages have entered (0..count)
  const [complete, setComplete] = useState(false);
  const [selected, setSelected] = useState(null); // reader's arrow pick; null → follow auto-play
  const completeRef = useRef(false);
  const timersRef = useRef([]);
  // Millisecondi di sequenza già giocati. È l'unica cosa che sopravvive a una
  // pausa: i timer si rifanno da capo ogni volta, questo no.
  const playedRef = useRef(0);
  const rate =
    Number.isFinite(playbackRate) && playbackRate > 0 ? playbackRate : 1;

  const activeIndex = selected != null ? selected : Math.max(0, revealed - 1);

  // Porta la testa dell'autoplay ad almeno la tappa `index`, senza mai tornare
  // indietro. Serve alle scene in cui lo scorrimento dentro l'hold deve far
  // avanzare la sequenza invece di lasciare il lettore ad aspettare il timer
  // (09 § 9.2): chi scorre chiede di andare avanti, ed è la ragione principale
  // per cui una scena agganciata «sembra bloccata».
  //
  // I timer restano vivi apposta: arrivano dopo con lo stesso `Math.max`, quindi
  // non riportano mai indietro ciò che lo scroll ha già scoperto. Chi chiama
  // resta responsabile della fine: arrivati all'ultima tappa si chiama
  // `forceComplete`, altrimenti `complete` aspetterebbe il tempo pieno.
  const advanceTo = useCallback(
    (index) => {
      if (completeRef.current) return;
      const next = Math.min(count, index + 1);
      if (next <= 0) return;
      setRevealed((current) => (next > current ? next : current));
    },
    [count],
  );

  const forceComplete = useCallback(() => {
    if (completeRef.current) return;
    completeRef.current = true;
    // Senza questo i timer pendenti restano vivi e riportano `revealed`
    // INDIETRO: due secondi dopo essere saltati a 3, un setRevealed(1) in
    // ritardo faceva sparire due schede su tre.
    timersRef.current.forEach(clearTimeout);
    timersRef.current = [];
    setRevealed(count);
    setComplete(true);
  }, [count]);

  // Once the scene engages, reveal the stages one by one on a timer (no scroll
  // needed) — e si ferma appena la scena non è più davanti al lettore.
  useEffect(() => {
    if (!engaged || completeRef.current) return undefined;

    const readAt = (index) =>
      Array.isArray(readMs) ? readMs[index] ?? readMs[readMs.length - 1] : readMs;

    // Istante di ingresso di ogni tappa, misurato sul tempo giocato: la prima
    // dopo l'orientamento, ognuna delle altre quando la precedente ha finito il
    // suo tempo di lettura.
    const entries = [];
    let at = startDelay;
    for (let i = 0; i < count; i += 1) {
      entries.push(at);
      at += readAt(i);
    }
    const endAt = entries[count - 1] + tailMs;

    // Ripresa dopo una pausa lunga: quello che era già arrivato è arrivato.
    const caught = entries.filter((time) => time <= playedRef.current).length;
    if (caught > 0) setRevealed((current) => Math.max(current, caught));
    if (endAt <= playedRef.current) {
      completeRef.current = true;
      setComplete(true);
      return undefined;
    }

    let startedAt = null;

    const play = () => {
      if (startedAt != null) return;
      startedAt = now();
      const played = playedRef.current;
      const timers = [];
      entries.forEach((time, i) => {
        if (time <= played) return;
        timers.push(
          setTimeout(
            () => setRevealed((current) => Math.max(current, i + 1)),
            (time - played) / rate,
          ),
        );
      });
      timers.push(
        setTimeout(() => {
          completeRef.current = true;
          setComplete(true);
        }, (endAt - played) / rate),
      );
      timersRef.current = timers;
    };

    const halt = () => {
      if (startedAt == null) return;
      playedRef.current += (now() - startedAt) * rate;
      startedAt = null;
      timersRef.current.forEach(clearTimeout);
      timersRef.current = [];
    };

    const onVisibility = () => {
      if (document.hidden) halt();
      else play();
    };

    if (!document.hidden) play();
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      halt();
    };
  }, [engaged, count, startDelay, readMs, tailMs, rate]);

  useEffect(() => () => timersRef.current.forEach(clearTimeout), []);

  // `pickDuringPlay` apre la scelta prima della fine. Serve dove le tappe sono
  // tutte già a schermo e il timer sposta solo l'evidenza (la mappa hotspot):
  // lì aspettare la fine per poter scegliere sarebbe tenere chiuso un contenuto
  // che il lettore ha già davanti agli occhi, e una scelta durante la
  // riproduzione è anche l'unico modo che ha di FERMARLA — `selected` scavalca
  // la testa dell'autoplay, quindi da quel momento l'evidenza non si muove più.
  // Dove invece le tappe si costruiscono una sull'altra (la vignetta del
  // rifugio, la mappa dell'ombra) resta chiusa: scegliere a metà costruzione
  // vorrebbe dire saltare a un disegno che non è ancora stato fatto.
  // ── E quando non c'è più niente da scoprire ─────────────────────────────
  // `complete` arriva un `tailMs` DOPO l'ultima tappa, ed è giusto per il testo
  // di chiusura. Ma per la scelta è tardi: chi si è portato avanti (scorrendo
  // dentro l'hold, per esempio) arriva all'ultima tappa molto prima che il
  // cronometro finisca di contare, e fino a lì restava con le frecce spente
  // davanti a una sequenza che non aveva più niente da rivelare. Se `revealed`
  // ha toccato il fondo, scegliere non può più saltare nulla.
  const canPick = useCallback(
    () => completeRef.current || pickDuringPlay || revealed >= count,
    [pickDuringPlay, revealed, count],
  );

  const goTo = useCallback(
    (index) => {
      if (!canPick()) return;
      setSelected(Math.max(0, Math.min(count - 1, index)));
    },
    [count, canPick],
  );

  const goPrev = useCallback(() => {
    if (!canPick()) return;
    setSelected((current) => Math.max(0, (current == null ? count - 1 : current) - 1));
  }, [count, canPick]);

  const goNext = useCallback(() => {
    if (!canPick()) return;
    setSelected((current) => Math.min(count - 1, (current == null ? count - 1 : current) + 1));
  }, [count, canPick]);

  return {
    revealed,
    complete,
    completeRef,
    activeIndex,
    selected,
    advanceTo,
    forceComplete,
    goTo,
    goPrev,
    goNext,
  };
}
