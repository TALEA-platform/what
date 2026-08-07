/* Ombra — la scena trasparente dietro il testo d'apertura.

   Due facciate stringono il vicolo ai lati, lasciando libera la colonna
   centrale per il testo in sovrimpressione. Le campiture sono lavate e il
   disegno vive soprattutto sul tratto, così in `multiply` resta parte della
   carta e non diventa un riquadro illustrato.

   Gli id nei <defs> sono prefissati `sfv-` perché in pagina convivono più SVG.
   Tutti i tratti animati hanno `pathLength="1"` e sono raggruppati in `.il`,
   secondo la stessa meccanica delle altre vignette della storia. */

export const vicoloSvg = `
<svg viewBox="0 0 1600 800" role="img" preserveAspectRatio="xMidYMid slice" xmlns="http://www.w3.org/2000/svg">
<desc>Due facciate alte stringono un vicolo del centro di Bologna. Un sole pieno illumina il selciato; dallo spigolo del palazzo una lunga ombra blu attraversa diagonalmente la strada, mentre dal suolo il calore continua a salire.</desc>
<defs>
  <filter id="sfv-pencil" x="-3%" y="-3%" width="106%" height="106%">
    <feTurbulence type="fractalNoise" baseFrequency="0.012" numOctaves="2" seed="9" result="n"/>
    <feDisplacementMap in="SourceGraphic" in2="n" scale="2.6"/>
  </filter>
  <linearGradient id="sfv-fade" x1="0" y1="0" x2="0" y2="1">
    <stop offset="0" stop-color="#fff" stop-opacity="1"/>
    <stop offset="0.62" stop-color="#fff" stop-opacity="1"/>
    <stop offset="1" stop-color="#fff" stop-opacity="0"/>
  </linearGradient>
  <mask id="sfv-mask">
    <rect x="0" y="0" width="1600" height="800" fill="url(#sfv-fade)"/>
  </mask>
  <linearGradient id="sfv-heat" x1="0" y1="1" x2="0" y2="0">
    <stop offset="0" stop-color="#C2551F" stop-opacity=".30"/>
    <stop offset="1" stop-color="#C2551F" stop-opacity="0"/>
  </linearGradient>
  <!-- ── IL CONTRASTO È IL SOGGETTO ─────────────────────────────────────────
       Questa vignetta racconta una cosa sola: metà strada al sole, metà in
       ombra. Se le due metà si somigliano non resta niente da guardare, ed è
       quello che succedeva — il selciato illuminato partiva da 12 % di ambra e
       l'ombra scendeva fino al 10 % di blu, cioè tutte e due quasi carta.
       Il lato al sole si scalda un po' e il lato in ombra scende molto: non si
       tratta di scurire il disegno (alzare l'opacità del gruppo impasta anche
       le facciate), ma di allargare la forbice fra le due metà. -->
  <linearGradient id="sfv-street-light" x1="0" y1="0" x2="0" y2="1">
    <stop offset="0" stop-color="#D9AA70" stop-opacity=".16"/>
    <stop offset="1" stop-color="#D9AA70" stop-opacity=".38"/>
  </linearGradient>
  <linearGradient id="sfv-cast-shadow" x1="0" y1="0" x2="1" y2=".25">
    <stop offset="0" stop-color="#1E3E56" stop-opacity=".82"/>
    <stop offset=".58" stop-color="#264861" stop-opacity=".54"/>
    <stop offset="1" stop-color="#294D69" stop-opacity=".22"/>
  </linearGradient>
  <radialGradient id="sfv-sun">
    <stop offset="0" stop-color="#E8B85A" stop-opacity=".52"/>
    <stop offset=".7" stop-color="#E2A94A" stop-opacity=".36"/>
    <stop offset="1" stop-color="#E2A94A" stop-opacity="0"/>
  </linearGradient>
</defs>

<g mask="url(#sfv-mask)">
  <g class="scene" filter="url(#sfv-pencil)">
    <g class="color">
      <!-- Un disco pieno e morbido: resta tutto dentro la vignetta e non
           sembra un pittogramma appoggiato al bordo. -->
      <circle cx="430" cy="270" r="62" fill="url(#sfv-sun)"/>
      <circle cx="430" cy="270" r="36" fill="#E2A94A" opacity=".3"/>

      <!-- Il contrasto rende leggibile l'azione: la strada riceve una luce
           calda molto tenue, poi il palazzo di sinistra vi proietta sopra una
           fascia fredda, lunga e diagonale. -->
      <path d="M330 438 C610 420 1000 420 1270 426 L1540 800 L60 800 Z" fill="url(#sfv-street-light)"/>
      <path d="M330 416 L330 800 L1370 800 L1040 646 L716 500 Z" fill="url(#sfv-cast-shadow)"/>
      <!-- Il cuore dell'ombra, subito sotto lo spigolo che la proietta: è la
           zona più fredda e più scura di tutto il disegno, ed è quella che dà
           al resto la scala del buio. -->
      <path d="M330 416 L330 548 L560 566 L716 500 Z" fill="#173B55" opacity=".54"/>
      <path d="M330 536 L330 670 L940 800 L1160 800 L560 566 Z" fill="#203F59" opacity=".2"/>

      <path d="M0 30 L330 300 L330 800 L0 800 Z" fill="#B9A88C" opacity=".5"/>
      <path d="M1600 8 L1270 288 L1270 800 L1600 800 Z" fill="#BFAE92" opacity=".5"/>
      <path d="M1600 8 L1270 288 L1270 322 L1600 46 Z" fill="#E4BC77" opacity=".6"/>

      <path d="M0 30 L330 300 L330 800 L0 800 Z" fill="#38506B" opacity=".22"/>
      <path d="M1600 46 L1270 322 L1270 800 L1600 800 Z" fill="#38506B" opacity=".2"/>

      <g fill="#6E5F49" opacity=".34">
        <path d="M40 214 L146 300 L146 452 L40 388 Z"/>
        <path d="M212 356 L306 432 L306 546 L212 490 Z"/>
        <path d="M40 502 L146 542 L146 690 L40 690 Z"/>
        <path d="M1560 186 L1454 274 L1454 430 L1560 366 Z"/>
        <path d="M1388 330 L1294 406 L1294 522 L1388 466 Z"/>
        <path d="M1560 478 L1454 520 L1454 668 L1560 668 Z"/>
      </g>

      <path d="M380 800 L1230 800 L1230 470 L380 470 Z" fill="url(#sfv-heat)"/>
    </g>

    <g class="ink">
      <g class="il" data-d="0">
        <path d="M0 30 L330 300" pathLength="1"/>
        <path d="M1600 8 L1270 288" pathLength="1"/>
      </g>
      <g class="il" data-d="1">
        <path d="M330 300 L330 800" pathLength="1"/>
        <path d="M1270 288 L1270 800" pathLength="1"/>
      </g>
      <g class="il sun" data-d="2">
        <circle cx="430" cy="270" r="36" pathLength="1"/>
      </g>
      <g class="il" data-d="3">
        <path d="M40 214 L146 300 L146 452 L40 388 Z" pathLength="1"/>
        <path d="M212 356 L306 432 L306 546 L212 490 Z" pathLength="1"/>
        <path d="M40 502 L146 542 L146 690 L40 690 Z" pathLength="1"/>
        <path d="M1560 186 L1454 274 L1454 430 L1560 366 Z" pathLength="1"/>
        <path d="M1388 330 L1294 406 L1294 522 L1388 466 Z" pathLength="1"/>
        <path d="M1560 478 L1454 520 L1454 668 L1560 668 Z" pathLength="1"/>
      </g>
      <!-- La linea del selciato dà un piano alla campitura: subito dopo, il
           bordo freddo nasce esattamente dallo spigolo del palazzo. -->
      <g class="il paving" data-d="4">
        <path d="M330 438 C610 420 1000 420 1270 426" pathLength="1"/>
      </g>
      <g class="il cast-shadow" data-d="5">
        <path d="M330 416 L716 500 L1040 646 L1370 800" pathLength="1"/>
        <path d="M330 536 L560 566 L940 800" pathLength="1"/>
      </g>
      <g class="il rise" data-d="6">
        <path d="M470 776 c -18 -44 18 -66 0 -110 c -15 -36 12 -56 0 -86" pathLength="1"/>
        <path d="M690 760 c -16 -40 16 -60 0 -100 c -13 -32 10 -50 0 -76" pathLength="1"/>
        <path d="M910 772 c -18 -44 18 -66 0 -110 c -15 -36 12 -56 0 -86" pathLength="1"/>
        <path d="M1130 756 c -16 -40 16 -60 0 -100 c -13 -32 10 -50 0 -76" pathLength="1"/>
        <path d="M580 690 c -13 -32 13 -50 0 -80" pathLength="1"/>
        <path d="M1020 684 c -13 -32 13 -50 0 -80" pathLength="1"/>
      </g>
    </g>
  </g>
</g>
</svg>`;
