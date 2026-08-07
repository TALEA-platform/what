// Il sito non vive sulla radice del dominio: su GitHub Pages sta sotto
// https://talea-platform.github.io/what/, e in locale sotto "/". Vite riscrive
// da solo i riferimenti che riesce a vedere — i tag di index.html, le `url()`
// del CSS, gli import con `?url`, le `new URL(…, import.meta.url)` — ma NON le
// stringhe scritte a mano: quelle finiscono nel bundle così come sono, e in
// produzione puntano fuori dal sito dando 404.
//
// Quindi ogni URL di un file dentro public/ passa di qui. `BASE_URL` vale "/"
// in sviluppo e "/what/" nel build, e finisce sempre con "/".
export function assetUrl(path) {
  return `${import.meta.env.BASE_URL}${String(path).replace(/^\/+/, "")}`;
}
