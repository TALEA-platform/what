import { useEffect, useRef, useState } from "react";

/**
 * Il logo TALEA che si disegna, uguale a quello della schermata d'ingresso.
 *
 * È lo stesso tracciato dello schermo di caricamento (`#talea-boot`, in
 * index.html): stessi path, stesso ordine, stesse durate. Cambia solo il momento
 * in cui parte — lì al primo fotogramma della pagina, qui quando il lettore
 * arriva sul capitolo del progetto. Chi apre la storia e chi ci arriva scorrendo
 * vedono nascere la stessa cosa.
 *
 * Non riusa le classi `.tb-*` del loader: quelle regole stanno in <head>, sono
 * globali e restano nel documento anche dopo che il loader è stato rimosso.
 * Riusarle vorrebbe dire far partire il disegno al montaggio del componente,
 * cioè mentre il capitolo è ancora tre schermate più in basso. Qui il prefisso è
 * `tl-` e l'animazione si accende con `.is-drawn` (src/styles/story.css).
 *
 * L'ordine del disegno è quello del nome: prima il ramo, poi le venature che
 * spuntano, poi i due cerchi che si chiudono attorno e la scritta che emerge.
 */
export function TaleaLogoDraw({ className = "", title = "TALEA" }) {
  const ref = useRef(null);
  const [drawn, setDrawn] = useState(false);

  useEffect(() => {
    const node = ref.current;
    if (!node) return undefined;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry?.isIntersecting) return;
        setDrawn(true);
        observer.disconnect();
      },
      { threshold: 0.4 },
    );
    observer.observe(node);

    // Chi ricarica la pagina già fermo su questo punto non riceve nessun
    // ingresso: l'osservatore non scatta su ciò che è già a schermo al primo giro.
    const rect = node.getBoundingClientRect();
    if (rect.top < window.innerHeight && rect.bottom > 0) {
      setDrawn(true);
      observer.disconnect();
    }

    return () => observer.disconnect();
  }, []);

  return (
    <svg
      ref={ref}
      className={`talea-logomark${drawn ? " is-drawn" : ""}${className ? ` ${className}` : ""}`}
      viewBox="0 0 680.3147 604.724"
      xmlns="http://www.w3.org/2000/svg"
      role="img"
      aria-label={title}
    >
      {/* La matrice ribalta l'asse Y: è il sistema di coordinate del file
          originale. Le animazioni non toccano mai `transform` sui path proprio
          per questo (una transform CSS sostituirebbe in blocco quella
          dell'elemento); dove serve una scala, sta sul gruppo. */}
      <g transform="matrix(1.3333333,0,0,-1.3333333,0,604.724)">
        <path className="tl-blue tl-p0" pathLength="1" transform="translate(249.5695,438.511)" d="m 0,0 c -89,19.351 -192.986,-9.738 -228.765,-113.385 -50.63,-209.04 108.469,-245.217 145.851,-256.79" />
        <path className="tl-yellow tl-p1" pathLength="1" transform="translate(363.015,355.3655)" d="m 0,0 c 162.417,-24.5 134.432,-201.531 134.432,-201.531 0,0 -11.219,-69.697 -69.396,-109.456 -68.837,-47.25 -177.848,-49.251 -256.856,18.957" />
        <path className="tl-blue tl-p2" pathLength="1" transform="translate(363.5553,353.9207)" d="m 0,0 c 0,0 -33.669,66.267 -113.986,84.59 -89,19.352 -192.986,-9.737 -228.764,-113.384" />
        <path className="tl-vein tl-p3" pathLength="1" transform="translate(168.8589,74.45)" d="M 0,0 C 0,0 4.626,18.037 40.14,67.893" />
        <path className="tl-vein tl-p4" pathLength="1" transform="translate(308.3044,293.4781)" d="M 0,0 34.359,8.061" />
        <path className="tl-vein tl-p5" pathLength="1" transform="translate(180.2941,98.3387)" d="M 0,0 -27.277,55.296" />
        <path className="tl-vein tl-p6" pathLength="1" transform="translate(180.294,97.0287)" d="M 0,0 103.913,38.114" />
        <path className="tl-vein tl-p7" pathLength="1" transform="translate(281.6133,261.7339)" d="M 0,0 C 18.309,23.664 37.471,44.908 61.859,71.292" />
        <g className="tl-word-g">
          <path className="tl-word tl-p8" transform="translate(65.2252,256.2314)" d="M 0,0 H 34.938 V -89.029 H 57.816 V 0 H 92.931 V 19.863 H 0 Z m 156.381,-89.029 v 50.544 c 0,18.977 -12.237,30.504 -33.342,30.504 -18.089,0 -31.036,-10.995 -33.341,-25.361 h 20.927 c 1.773,4.612 5.498,7.449 11.705,7.449 8.867,0 12.946,-5.498 12.946,-12.237 v -5.852 c -3.192,2.305 -11.173,4.611 -18.089,4.611 -17.203,0 -30.682,-10.287 -30.682,-25.361 0,-16.494 13.479,-25.716 29.44,-25.716 8.69,0 16.671,3.015 19.331,5.675 v -4.256 z m -21.105,21.636 c -1.951,-4.256 -7.98,-6.916 -14.365,-6.916 -6.917,0 -14.011,2.837 -14.011,9.754 0,6.739 7.094,9.754 14.011,9.754 6.385,0 12.414,-2.66 14.365,-6.916 z m 57.239,93.641 H 170.524 V -89.029 h 21.991 z m 63.624,-89.384 c -1.773,-6.739 -7.271,-9.932 -14.72,-9.932 -9.754,0 -16.493,7.094 -17.203,18.977 h 52.85 v 6.739 c 0,23.233 -12.769,39.371 -36.001,39.371 -22.169,0 -38.13,-17.557 -38.13,-41.499 0,-24.474 15.429,-41.323 38.484,-41.323 19.863,0 32.278,10.819 35.115,27.667 z m -14.897,37.243 c 9.045,0 14.011,-6.562 14.188,-14.897 h -30.681 c 1.95,9.754 7.98,14.897 16.493,14.897 m 111.33,-63.136 v 50.544 c 0,18.977 -12.237,30.504 -33.342,30.504 -18.089,0 -31.036,-10.995 -33.341,-25.361 h 20.927 c 1.773,4.612 5.498,7.449 11.705,7.449 8.867,0 12.946,-5.498 12.946,-12.237 v -5.852 c -3.192,2.305 -11.173,4.611 -18.089,4.611 -17.203,0 -30.682,-10.287 -30.682,-25.361 0,-16.494 13.479,-25.716 29.44,-25.716 8.69,0 16.671,3.015 19.331,5.675 v -4.256 z m -21.105,21.636 c -1.951,-4.256 -7.98,-6.916 -14.365,-6.916 -6.917,0 -14.011,2.837 -14.011,9.754 0,6.739 7.094,9.754 14.011,9.754 6.385,0 12.414,-2.66 14.365,-6.916 z" />
        </g>
        <path className="tl-branch tl-p9" pathLength="1" transform="translate(391.3435,273.1924)" d="M 0,0 C -1.506,20.692 -10.774,56.532 -28.729,82.473 -61.132,91.474 -224.688,99.975 -270.313,24.536" />
        <path className="tl-yellow-fill tl-p10" transform="translate(162.7085,61.4033)" d="m 0,0 -2.435,5.732 13.042,-3.281 -1.2,-4.88 c 0,0 -4.258,-3.342 -5.993,-1.531 C 1.68,-2.149 0,0 0,0" />
        <path className="tl-branch tl-p11" pathLength="1" transform="translate(112.2371,144.0049)" d="m 0,0 c 12.953,-31.365 21.334,-46.706 53.637,-75.109 146.252,-14.602 207.342,60.246 215.43,73.392" />
        <path className="tl-vein tl-p12" pathLength="1" transform="translate(308.3042,326.9795)" d="M 0,0 V -32.463" />
        <path className="tl-vein tl-p13" pathLength="1" transform="translate(212.8814,311.8008)" d="M 0,0 1.2,-28.836" />
      </g>
    </svg>
  );
}
