import { useCallback, useEffect, useRef } from "react";

/**
 * Fin dove è arrivata la lettura, misurata una volta sola per tutta la pagina.
 *
 * Tiene il punto più basso che la storia ha raggiunto: la metà dello schermo,
 * non il suo bordo inferiore, perché un capitolo che spunta dal fondo non è
 * ancora un capitolo letto. È un massimo, quindi risalire non lo riporta
 * indietro: chi torna su a rileggere una scena non si vede richiudere le cose
 * che aveva già visto.
 *
 * Un solo listener passivo e una ref: il valore non deve far ridisegnare
 * niente mentre si scorre, serve solo a chi lo chiede, quando lo chiede
 * (il pannello del metodo, all'apertura).
 *
 * Restituisce `hasReached(selettore)`: vero se quell'elemento è entrato nella
 * metà alta dello schermo almeno una volta. Un selettore vuoto, o che non
 * trova niente, risponde vero — vedi la nota in `src/data/method.js` sul
 * perché qui si sbaglia dalla parte del mostrare.
 */
export function useStoryReach() {
  const reachRef = useRef(0);

  useEffect(() => {
    const update = () => {
      const reach = window.scrollY + window.innerHeight * 0.5;
      if (reach > reachRef.current) reachRef.current = reach;
    };
    update();
    window.addEventListener("scroll", update, { passive: true });
    window.addEventListener("resize", update);
    return () => {
      window.removeEventListener("scroll", update);
      window.removeEventListener("resize", update);
    };
  }, []);

  return useCallback((selector) => {
    if (!selector) return true;
    const node = document.querySelector(selector);
    if (!node) return true;
    return node.getBoundingClientRect().top + window.scrollY < reachRef.current;
  }, []);
}
