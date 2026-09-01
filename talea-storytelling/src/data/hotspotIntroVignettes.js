
const escapeSvgText = (value) =>
  value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");

export function renderSuperficieSvg({ ariaLabel, description, labels }) {
  return `
<svg viewBox="0 0 640 460" role="img" aria-label="${escapeSvgText(ariaLabel)}" xmlns="http://www.w3.org/2000/svg">
<desc>${escapeSvgText(description)}</desc>
<defs>
  <filter id="hsi-a-pencil" x="-4%" y="-4%" width="108%" height="108%">
    <feTurbulence type="fractalNoise" baseFrequency="0.015" numOctaves="2" seed="5" result="n"/>
    <feDisplacementMap in="SourceGraphic" in2="n" scale="1.7"/>
  </filter>
  <linearGradient id="hsi-a-heat" gradientUnits="userSpaceOnUse" x1="0" y1="460" x2="0" y2="318">
    <stop offset="0" stop-color="#C2551F" stop-opacity=".34"/>
    <stop offset=".55" stop-color="#C2551F" stop-opacity=".18"/>
    <stop offset="1" stop-color="#C2551F" stop-opacity=".07"/>
  </linearGradient>
  <filter id="hsi-a-soft" x="-30%" y="-30%" width="160%" height="160%">
    <feGaussianBlur stdDeviation="19"/>
  </filter>
  <mask id="hsi-a-edge" maskUnits="userSpaceOnUse" x="-80" y="-80" width="800" height="620">
    <rect x="18" y="-80" width="604" height="520" fill="#FFFFFF" filter="url(#hsi-a-soft)"/>
  </mask>
</defs>

<g class="scene" filter="url(#hsi-a-pencil)">
  <g class="color">
    <g transform="translate(0,-24)">
      <circle cx="556" cy="90" r="30" fill="#E8A23C"/>
      <g fill="none" stroke="#F1B345" stroke-width="3" stroke-linecap="round" opacity=".55">
        <path d="M556 44 L556 30"/><path d="M556 136 L556 150"/>
        <path d="M510 90 L496 90"/><path d="M602 90 L616 90"/>
        <path d="M523 57 L513 47"/><path d="M589 57 L599 47"/>
        <path d="M523 123 L513 133"/><path d="M589 123 L599 133"/>
      </g>
    </g>

    <path d="M110 78 L44 318 L452 318 Z" fill="#F4CE86" opacity=".26"/>

    <path d="M92 30 L128 30 L128 64 L92 64 Z" fill="#ABA292"/>
    <path d="M52 36 L90 36 L90 58 L52 58 Z" fill="#93A6AE"/>
    <path d="M130 36 L168 36 L168 58 L130 58 Z" fill="#93A6AE"/>
    <path d="M104 64 L116 64 L124 78 L96 78 Z" fill="#D6DAD2"/>

    <path d="M20 318 L20 156 L194 156 L194 318 Z" fill="#E6DBC3"/>
    <path d="M12 156 L107 118 L202 156 Z" fill="#C9975F"/>
    <path d="M40 180 h30 v32 h-30 z" fill="#E9DFC9"/>
    <path d="M92 180 h30 v32 h-30 z" fill="#E9DFC9"/>
    <path d="M144 180 h30 v32 h-30 z" fill="#E9DFC9"/>
    <path d="M36 318 L36 290 A28 28 0 0 1 92 290 L92 318 Z" fill="#C7B896"/>
    <path d="M106 318 L106 290 A28 28 0 0 1 162 290 L162 318 Z" fill="#C7B896"/>

    <g mask="url(#hsi-a-edge)">
      <path d="M468 318 L468 200 L700 200 L700 318 Z" fill="#E6DBC3"/>
      <path d="M460 190 L700 190 L700 200 L460 200 Z" fill="#CFC0A0"/>
      <path d="M484 222 h26 v26 h-26 z" fill="#E9DFC9"/>
      <path d="M528 222 h26 v26 h-26 z" fill="#E9DFC9"/>
      <path d="M572 222 h26 v26 h-26 z" fill="#E9DFC9"/>
      <path d="M616 222 h26 v26 h-26 z" fill="#E9DFC9"/>
      <path d="M660 222 h26 v26 h-26 z" fill="#E9DFC9"/>
    </g>

    <path d="M386 318 L386 246 L398 246 L398 318 Z" fill="#8E7250"/>
    <path d="M332 230 Q336 190 372 178 Q404 168 434 182 Q460 196 456 230 Q440 262 404 258 Q368 268 340 254 Q328 244 332 230 Z" fill="#7E9C63"/>
    <ellipse cx="378" cy="206" rx="34" ry="18" fill="#A9C68A" opacity=".62"/>

    <g mask="url(#hsi-a-edge)">
      <path d="M-46 318 L700 318 L700 486 L-46 486 Z" fill="#DFCFB2"/>
      <path d="M-46 318 L700 318 L700 486 L-46 486 Z" fill="url(#hsi-a-heat)"/>
      <path d="M-46 318 L700 318 L700 340 L-46 340 Z" fill="#C6B18E" opacity=".45"/>
      <g stroke="#AD8F68" stroke-width="2" fill="none" opacity=".42">
        <path d="M-46 353 Q320 348 700 353"/>
        <path d="M-46 399 Q320 393 700 399"/>
        <path d="M-46 447 Q320 441 700 447"/>
        <path d="M96 353 L88 399"/><path d="M232 353 L226 399"/>
        <path d="M368 353 L366 399"/><path d="M504 353 L508 399"/>
        <path d="M-24 353 L-32 399"/><path d="M660 353 L668 399"/>
        <path d="M160 399 L150 447"/><path d="M340 399 L336 447"/>
        <path d="M520 399 L528 447"/><path d="M-10 399 L-22 447"/>
        <path d="M676 399 L686 447"/>
      </g>
    </g>
    <ellipse cx="300" cy="452" rx="43" ry="7" fill="#4a4234" opacity=".14"/>
    <ellipse cx="541" cy="428" rx="88" ry="8" fill="#4a4234" opacity=".14"/>

    <path d="M470 356 L612 356 L612 366 L470 366 Z" fill="#8E7250"/>
    <path d="M466 386 L616 386 L616 396 L466 396 Z" fill="#8E7250"/>
    <path d="M480 366 h8 v20 h-8 z" fill="#7C8269"/>
    <path d="M594 366 h8 v20 h-8 z" fill="#7C8269"/>
    <path d="M478 396 h10 v28 h-10 z" fill="#7C8269"/>
    <path d="M594 396 h10 v28 h-10 z" fill="#7C8269"/>

    <g transform="translate(-75,-120) scale(1.25)">
    <g transform="translate(300,352) scale(0.72) translate(-300,-352)">
      <path d="M288 336 Q289 322 300 321 Q311 322 312 336 Q306 329 300 329 Q294 329 288 336 Z" fill="#3A2B22"/>
      <path d="M290 341 C290 333 294 328 300 328 C306 328 310 333 310 341 C310 348 306 352 300 352 C294 352 290 348 290 341 Z" fill="#E9C6A0"/>
      <path d="M317 329 C319.6 333 320 335.4 317 335.4 C314 335.4 314.4 333 317 329 Z" fill="#A9CBDE"/>
      <path d="M283 335 C285.6 339 286 341.4 283 341.4 C280 341.4 280.4 339 283 335 Z" fill="#A9CBDE"/>
    </g>
    <path d="M296 352 h8 v9 h-8 z" fill="#E9C6A0"/>
    <path d="M288 362 Q300 356 312 362 Q316 384 312 404 L288 404 Q284 384 288 362 Z" fill="#7E9CB0"/>
    <path d="M289 404 L286 454 L296 454 L300 412 L304 454 L314 454 L311 404 Z" fill="#8C9A6E"/>
    <path d="M285 450 L282 457 L297 457 L297 450 Z" fill="#5E564A"/>
    <path d="M315 450 L318 457 L303 457 L303 450 Z" fill="#5E564A"/>
    <path d="M282 366 L290 366 L289 388 L281 387 Z" fill="#7E9CB0"/>
    <path d="M310 366 L318 366 L319 387 L311 388 Z" fill="#7E9CB0"/>
    <path d="M281 387 L289 388 L288 418 L280 416 Z" fill="#E9C6A0"/>
    <path d="M311 388 L319 387 L320 416 L312 418 Z" fill="#E9C6A0"/>
    <circle cx="284" cy="421" r="3.8" fill="#E9C6A0"/>
    <circle cx="316" cy="421" r="3.8" fill="#E9C6A0"/>

    <g transform="translate(0,26)">
      <path d="M338 314 L348 314 L348 348 L338 348 Z" fill="#F1E8D5"/>
      <circle cx="343" cy="356" r="9" fill="#F1E8D5"/>
      <circle cx="343" cy="356" r="6" fill="#CE3B1E"/>
      <path d="M341 334 h5 v22 h-5 z" fill="#CE3B1E"/>
    </g>
    </g>

    <g class="material-hatch" aria-hidden="true">
      <g class="material-hatch--roof">
        <path d="M30 151 Q70 137 112 121"/><path d="M50 155 Q91 139 130 126"/>
        <path d="M76 155 Q112 141 149 133"/><path d="M108 155 Q137 145 169 141"/>
        <path d="M140 155 Q159 150 184 148"/>
      </g>
      <g class="material-hatch--wall">
        <path d="M27 171 l12 -8 M27 193 l13 -8 M76 177 l12 -8 M76 205 l13 -8"/>
        <path d="M128 174 l12 -7 M128 207 l12 -8 M171 176 l14 -8 M170 223 l14 -8"/>
        <path d="M476 213 l15 -8 M516 214 l14 -8 M563 214 l14 -8 M609 214 l14 -8"/>
      </g>
      <g class="material-hatch--foliage">
        <path d="M345 225 q15 -20 32 -27 M350 242 q20 -22 42 -40 M377 251 q20 -25 45 -54"/>
        <path d="M409 247 q13 -21 30 -40 M430 235 q8 -14 18 -20"/>
      </g>
      <g class="material-hatch--ground">
        <path d="M14 344 l22 -13 M48 347 l25 -15 M84 345 l22 -13 M121 348 l25 -15"/>
        <path d="M163 345 l22 -13 M201 349 l26 -15 M249 346 l23 -13 M286 349 l27 -16"/>
        <path d="M375 350 l26 -16 M420 346 l23 -13 M455 350 l27 -16 M630 348 l25 -15"/>
        <path d="M19 389 l25 -15 M66 391 l26 -15 M113 389 l24 -14 M204 392 l27 -16"/>
        <path d="M251 390 l24 -14 M337 392 l27 -16 M383 390 l25 -15 M630 390 l26 -15"/>
        <path d="M21 437 l27 -16 M72 437 l25 -15 M183 440 l28 -17 M271 438 l25 -15"/>
        <path d="M366 440 l28 -17 M453 438 l25 -15 M618 439 l28 -16"/>
      </g>
    </g>
  </g>

  <g class="ink">
    <g class="il" data-d="0" mask="url(#hsi-a-edge)">
      <path d="M-46 320 Q140 314 284 317" pathLength="1"/>
      <path d="M316 318 Q332 318 344 318" pathLength="1"/>
      <path d="M370 319 Q500 322 700 317" pathLength="1"/>
    </g>
    <g class="il" data-d="1">
      <g transform="translate(0,-24)">
        <circle cx="556" cy="90" r="30" pathLength="1"/>
        <path d="M556 44 L556 30" pathLength="1"/><path d="M556 136 L556 150" pathLength="1"/>
        <path d="M510 90 L496 90" pathLength="1"/><path d="M602 90 L616 90" pathLength="1"/>
        <path d="M523 57 L513 47" pathLength="1"/><path d="M589 57 L599 47" pathLength="1"/>
        <path d="M523 123 L513 133" pathLength="1"/><path d="M589 123 L599 133" pathLength="1"/>
      </g>
      <path d="M92 30 L128 30 L128 64 L92 64 Z" pathLength="1"/>
      <path d="M52 36 L90 36 L90 58 L52 58 Z" pathLength="1"/>
      <path d="M130 36 L168 36 L168 58 L130 58 Z" pathLength="1"/>
      <path d="M90 42 L92 42 M90 52 L92 52 M128 42 L130 42 M128 52 L130 52" pathLength="1"/>
      <path d="M104 64 L116 64 L124 78 L96 78 Z" pathLength="1"/>
      <path d="M110 78 L44 318" pathLength="1"/>
      <path d="M110 78 L452 318" pathLength="1"/>
    </g>
    <g class="il" data-d="2">
      <path d="M20 318 L20 156 L194 156 L194 318" pathLength="1"/>
      <path d="M12 156 L107 118 L202 156 Z" pathLength="1"/>
      <path d="M40 180 h30 v32 h-30 z" pathLength="1"/>
      <path d="M92 180 h30 v32 h-30 z" pathLength="1"/>
      <path d="M144 180 h30 v32 h-30 z" pathLength="1"/>
      <path d="M36 318 L36 290 A28 28 0 0 1 92 290 L92 318" pathLength="1"/>
      <path d="M106 318 L106 290 A28 28 0 0 1 162 290 L162 318" pathLength="1"/>
      <path d="M20 262 L194 262" pathLength="1"/>
    </g>
    <g class="il" data-d="3" mask="url(#hsi-a-edge)">
      <path d="M468 318 L468 200 L700 200" pathLength="1"/>
      <path d="M460 200 L460 190 L700 190" pathLength="1"/>
      <path d="M484 222 h26 v26 h-26 z" pathLength="1"/>
      <path d="M528 222 h26 v26 h-26 z" pathLength="1"/>
      <path d="M572 222 h26 v26 h-26 z" pathLength="1"/>
      <path d="M616 222 h26 v26 h-26 z" pathLength="1"/>
      <path d="M660 222 h26 v26 h-26 z" pathLength="1"/>
      <path d="M386 318 L386 246" pathLength="1"/><path d="M398 318 L398 246" pathLength="1"/>
      <path d="M390 280 Q378 270 368 266" pathLength="1"/>
      <path d="M394 268 Q406 258 416 254" pathLength="1"/>
      <path d="M332 230 Q336 190 372 178 Q404 168 434 182 Q460 196 456 230" pathLength="1"/>
      <path d="M456 230 Q440 262 404 258 Q368 268 340 254 Q328 244 332 230" pathLength="1"/>
      <path d="M352 200 q5 -6 12 -5" pathLength="1"/><path d="M400 190 q7 -5 13 -2" pathLength="1"/>
    </g>
    <g class="il" data-d="4">
      <path d="M470 356 L612 356 L612 366 L470 366 Z" pathLength="1"/>
      <path d="M466 386 L616 386 L616 396 L466 396 Z" pathLength="1"/>
      <path d="M480 366 L480 386" pathLength="1"/><path d="M488 366 L488 386" pathLength="1"/>
      <path d="M594 366 L594 386" pathLength="1"/><path d="M602 366 L602 386" pathLength="1"/>
      <path d="M478 396 L478 424" pathLength="1"/><path d="M488 396 L488 424" pathLength="1"/>
      <path d="M594 396 L594 424" pathLength="1"/><path d="M604 396 L604 424" pathLength="1"/>
    </g>
    <g class="il" data-d="5" transform="translate(-75,-120) scale(1.25)">
      <g transform="translate(300,352) scale(0.72) translate(-300,-352)">
        <path d="M288 336 Q289 322 300 321 Q311 322 312 336" pathLength="1"/>
        <path d="M288 336 Q294 329 300 329 Q306 329 312 336" pathLength="1"/>
        <path d="M290 341 C290 333 294 328 300 328 C306 328 310 333 310 341 C310 348 306 352 300 352 C294 352 290 348 290 341 Z" pathLength="1"/>
        <path d="M295 340 q2 0 3 0" pathLength="1"/><path d="M303 340 q2 0 3 0" pathLength="1"/>
        <path d="M296 348 L304 348" pathLength="1"/>
        <path d="M317 329 C319.6 333 320 335.4 317 335.4 C314 335.4 314.4 333 317 329 Z" pathLength="1"/>
        <path d="M283 335 C285.6 339 286 341.4 283 341.4 C280 341.4 280.4 339 283 335 Z" pathLength="1"/>
      </g>
      <path d="M296 352 L296 360" pathLength="1"/><path d="M304 352 L304 360" pathLength="1"/>
      <path d="M288 362 Q300 356 312 362" pathLength="1"/>
      <path d="M288 362 Q284 384 288 404" pathLength="1"/><path d="M312 362 Q316 384 312 404" pathLength="1"/>
      <path d="M288 404 Q300 400 312 404" pathLength="1"/>
      <path d="M284 366 Q278 392 280 416" pathLength="1"/><path d="M316 366 Q322 392 320 416" pathLength="1"/>
      <path d="M281 387 L289 388" pathLength="1"/><path d="M311 388 L319 387" pathLength="1"/>
      <circle cx="284" cy="421" r="3.8" pathLength="1"/><circle cx="316" cy="421" r="3.8" pathLength="1"/>
      <path d="M286 454 L289 404" pathLength="1"/><path d="M296 454 L300 412 L304 454" pathLength="1"/>
      <path d="M314 454 L311 404" pathLength="1"/>
      <path d="M285 450 L282 457 L297 457" pathLength="1"/><path d="M315 450 L318 457 L303 457" pathLength="1"/>
      <g transform="translate(0,26)">
        <path d="M338 348 L338 314 L348 314 L348 348" pathLength="1"/>
        <circle cx="343" cy="356" r="9" pathLength="1"/>
        <path d="M348 322 L354 322" pathLength="1"/><path d="M348 330 L354 330" pathLength="1"/>
        <path d="M348 338 L354 338" pathLength="1"/>
      </g>
    </g>
    <g class="il rise" data-d="6">
      <path d="M70 452 q-8 -14 0 -26 q8 -14 0 -26" pathLength="1"/>
      <path d="M64 406 L70 398 L76 406" pathLength="1"/>
      <path d="M228 448 q8 -14 0 -26 q-8 -14 0 -26" pathLength="1"/>
      <path d="M222 402 L228 394 L234 402" pathLength="1"/>
      <path d="M416 452 q-8 -14 0 -26 q8 -14 0 -26" pathLength="1"/>
      <path d="M410 406 L416 398 L422 406" pathLength="1"/>
    </g>
  </g>
</g>

<g class="labels">
  <g class="tag tag--surface">
    <rect x="212" y="106" width="58" height="30" rx="8"/>
    <text x="241" y="127" text-anchor="middle">48°</text>
  </g>
  <path class="lead" d="M212 124 L186 144"/>

  <g class="tag tag--surface">
    <rect x="122" y="356" width="58" height="30" rx="8"/>
    <text x="151" y="377" text-anchor="middle">52°</text>
  </g>

  <g class="tag tag--surface">
    <rect x="512" y="310" width="58" height="30" rx="8"/>
    <text x="541" y="331" text-anchor="middle">41°</text>
  </g>
  <path class="lead" d="M541 340 L541 356"/>

  <g class="tag tag--air">
    <rect x="407" y="262" width="58" height="30" rx="8"/>
    <text x="436" y="283" text-anchor="middle">34°</text>
  </g>
  <text class="tag-word" x="436" y="310" text-anchor="middle">${escapeSvgText(labels.air)}</text>
  <path class="lead" d="M407 280 L366 307"/>
</g>
</svg>`;
}

export function renderRicorrenzaSvg({ ariaLabel, description, labels }) {
  return `
<svg viewBox="0 0 640 460" role="img" aria-label="${escapeSvgText(ariaLabel)}" xmlns="http://www.w3.org/2000/svg">
<desc>${escapeSvgText(description)}</desc>
<defs>
  <filter id="hsi-b-pencil" x="-4%" y="-4%" width="108%" height="108%">
    <feTurbulence type="fractalNoise" baseFrequency="0.015" numOctaves="2" seed="11" result="n"/>
    <feDisplacementMap in="SourceGraphic" in2="n" scale="1.5"/>
  </filter>
  <clipPath id="hsi-b-clip0"><path d="M166.7 64.0 L215.6 42.5 L240.2 62.4 L276.5 48.6 L309.5 65.3 L330.1 48.9 L370.8 53.4 L433.3 42.0 L512.3 55.9 L489.2 65.7 L524.3 79.0 L421.7 123.6 L371.9 125.6 L228.7 158.0 L205.1 147.5 L175.8 154.0 L251.4 99.0 L155.1 87.5 Z"/></clipPath>
  <clipPath id="hsi-b-clip1"><path d="M166.7 186.0 L215.6 164.5 L240.2 184.4 L276.5 170.6 L309.5 187.3 L330.1 170.9 L370.8 175.4 L433.3 164.0 L512.3 177.9 L489.2 187.7 L524.3 201.0 L421.7 245.6 L371.9 247.6 L228.7 280.0 L205.1 269.5 L175.8 276.0 L251.4 221.0 L155.1 209.5 Z"/></clipPath>
  <clipPath id="hsi-b-clip2"><path d="M166.7 308.0 L215.6 286.5 L240.2 306.4 L276.5 292.6 L309.5 309.3 L330.1 292.9 L370.8 297.4 L433.3 286.0 L512.3 299.9 L489.2 309.7 L524.3 323.0 L421.7 367.6 L371.9 369.6 L228.7 402.0 L205.1 391.5 L175.8 398.0 L251.4 343.0 L155.1 331.5 Z"/></clipPath>
</defs>

<g class="scene" filter="url(#hsi-b-pencil)">
  <g class="color">
    <path d="M166.7 71.0 L215.6 49.5 L240.2 69.4 L276.5 55.6 L309.5 72.3 L330.1 55.9 L370.8 60.4 L433.3 49.0 L512.3 62.9 L489.2 72.7 L524.3 86.0 L421.7 130.6 L371.9 132.6 L228.7 165.0 L205.1 154.5 L175.8 161.0 L251.4 106.0 L155.1 94.5 Z" fill="#DCCEB2"/>
    <path d="M166.7 64.0 L215.6 42.5 L240.2 62.4 L276.5 48.6 L309.5 65.3 L330.1 48.9 L370.8 53.4 L433.3 42.0 L512.3 55.9 L489.2 65.7 L524.3 79.0 L421.7 123.6 L371.9 125.6 L228.7 158.0 L205.1 147.5 L175.8 154.0 L251.4 99.0 L155.1 87.5 Z" fill="#F2E9D7"/>
    <g clip-path="url(#hsi-b-clip0)">
      <path d="M197.0 129.0 L290.0 129.0 L262.0 158.0 L169.0 158.0 Z" fill="#A9C58C"/>
      <path d="M318.0 100.0 L411.0 100.0 L383.0 129.0 L290.0 129.0 Z" fill="#E08A4A"/>
      <path d="M439.0 71.0 L532.0 71.0 L504.0 100.0 L411.0 100.0 Z" fill="#E08A4A"/>
      <path d="M253.0 71.0 L346.0 71.0 L318.0 100.0 L225.0 100.0 Z" fill="#C8502A"/>
      <path d="M346.0 71.0 L439.0 71.0 L411.0 100.0 L318.0 100.0 Z" fill="#C8502A"/>
    </g>
    <path d="M166.7 193.0 L215.6 171.5 L240.2 191.4 L276.5 177.6 L309.5 194.3 L330.1 177.9 L370.8 182.4 L433.3 171.0 L512.3 184.9 L489.2 194.7 L524.3 208.0 L421.7 252.6 L371.9 254.6 L228.7 287.0 L205.1 276.5 L175.8 283.0 L251.4 228.0 L155.1 216.5 Z" fill="#DCCEB2"/>
    <path d="M166.7 186.0 L215.6 164.5 L240.2 184.4 L276.5 170.6 L309.5 187.3 L330.1 170.9 L370.8 175.4 L433.3 164.0 L512.3 177.9 L489.2 187.7 L524.3 201.0 L421.7 245.6 L371.9 247.6 L228.7 280.0 L205.1 269.5 L175.8 276.0 L251.4 221.0 L155.1 209.5 Z" fill="#F2E9D7"/>
    <g clip-path="url(#hsi-b-clip1)">
      <path d="M197.0 251.0 L290.0 251.0 L262.0 280.0 L169.0 280.0 Z" fill="#A9C58C"/>
      <path d="M374.0 164.0 L467.0 164.0 L439.0 193.0 L346.0 193.0 Z" fill="#E08A4A"/>
      <path d="M253.0 193.0 L346.0 193.0 L318.0 222.0 L225.0 222.0 Z" fill="#C8502A"/>
      <path d="M346.0 193.0 L439.0 193.0 L411.0 222.0 L318.0 222.0 Z" fill="#C8502A"/>
    </g>
    <path d="M166.7 315.0 L215.6 293.5 L240.2 313.4 L276.5 299.6 L309.5 316.3 L330.1 299.9 L370.8 304.4 L433.3 293.0 L512.3 306.9 L489.2 316.7 L524.3 330.0 L421.7 374.6 L371.9 376.6 L228.7 409.0 L205.1 398.5 L175.8 405.0 L251.4 350.0 L155.1 338.5 Z" fill="#DCCEB2"/>
    <path d="M166.7 308.0 L215.6 286.5 L240.2 306.4 L276.5 292.6 L309.5 309.3 L330.1 292.9 L370.8 297.4 L433.3 286.0 L512.3 299.9 L489.2 309.7 L524.3 323.0 L421.7 367.6 L371.9 369.6 L228.7 402.0 L205.1 391.5 L175.8 398.0 L251.4 343.0 L155.1 331.5 Z" fill="#F2E9D7"/>
    <g clip-path="url(#hsi-b-clip2)">
      <path d="M197.0 373.0 L290.0 373.0 L262.0 402.0 L169.0 402.0 Z" fill="#A9C58C"/>
      <path d="M225.0 344.0 L318.0 344.0 L290.0 373.0 L197.0 373.0 Z" fill="#E08A4A"/>
      <path d="M253.0 315.0 L346.0 315.0 L318.0 344.0 L225.0 344.0 Z" fill="#C8502A"/>
      <path d="M346.0 315.0 L439.0 315.0 L411.0 344.0 L318.0 344.0 Z" fill="#C8502A"/>
    </g>
  </g>

  <g class="ink">
    <g class="il" data-d="0">
      <path d="M166.7 64.0 L215.6 42.5 L240.2 62.4 L276.5 48.6 L309.5 65.3 L330.1 48.9 L370.8 53.4 L433.3 42.0 L512.3 55.9 L489.2 65.7 L524.3 79.0 L421.7 123.6 L371.9 125.6 L228.7 158.0 L205.1 147.5 L175.8 154.0 L251.4 99.0 L155.1 87.5 Z" pathLength="1"/>
      <path d="M166.7 186.0 L215.6 164.5 L240.2 184.4 L276.5 170.6 L309.5 187.3 L330.1 170.9 L370.8 175.4 L433.3 164.0 L512.3 177.9 L489.2 187.7 L524.3 201.0 L421.7 245.6 L371.9 247.6 L228.7 280.0 L205.1 269.5 L175.8 276.0 L251.4 221.0 L155.1 209.5 Z" pathLength="1"/>
      <path d="M166.7 308.0 L215.6 286.5 L240.2 306.4 L276.5 292.6 L309.5 309.3 L330.1 292.9 L370.8 297.4 L433.3 286.0 L512.3 299.9 L489.2 309.7 L524.3 323.0 L421.7 367.6 L371.9 369.6 L228.7 402.0 L205.1 391.5 L175.8 398.0 L251.4 343.0 L155.1 331.5 Z" pathLength="1"/>
    </g>
    <g class="il street" data-d="1">
      <path d="M281.0 42.0 L169.0 158.0" pathLength="1"/>
      <path d="M160.0 71.0 L532.0 71.0" pathLength="1"/>
      <path d="M374.0 42.0 L262.0 158.0" pathLength="1"/>
      <path d="M132.0 100.0 L504.0 100.0" pathLength="1"/>
      <path d="M467.0 42.0 L355.0 158.0" pathLength="1"/>
      <path d="M104.0 129.0 L476.0 129.0" pathLength="1"/>
    </g>
    <g class="il street" data-d="2">
      <path d="M281.0 164.0 L169.0 280.0" pathLength="1"/>
      <path d="M160.0 193.0 L532.0 193.0" pathLength="1"/>
      <path d="M374.0 164.0 L262.0 280.0" pathLength="1"/>
      <path d="M132.0 222.0 L504.0 222.0" pathLength="1"/>
      <path d="M467.0 164.0 L355.0 280.0" pathLength="1"/>
      <path d="M104.0 251.0 L476.0 251.0" pathLength="1"/>
    </g>
    <g class="il street" data-d="3">
      <path d="M281.0 286.0 L169.0 402.0" pathLength="1"/>
      <path d="M160.0 315.0 L532.0 315.0" pathLength="1"/>
      <path d="M374.0 286.0 L262.0 402.0" pathLength="1"/>
      <path d="M132.0 344.0 L504.0 344.0" pathLength="1"/>
      <path d="M467.0 286.0 L355.0 402.0" pathLength="1"/>
      <path d="M104.0 373.0 L476.0 373.0" pathLength="1"/>
    </g>
    <g class="il" data-d="4">
      <g clip-path="url(#hsi-b-clip0)">
        <path d="M318.0 100.0 L411.0 100.0 L383.0 129.0 L290.0 129.0 Z" pathLength="1"/>
        <path d="M439.0 71.0 L532.0 71.0 L504.0 100.0 L411.0 100.0 Z" pathLength="1"/>
        <path d="M253.0 71.0 L346.0 71.0 L318.0 100.0 L225.0 100.0 Z" pathLength="1"/>
        <path d="M346.0 71.0 L439.0 71.0 L411.0 100.0 L318.0 100.0 Z" pathLength="1"/>
      </g>
      <g clip-path="url(#hsi-b-clip1)">
        <path d="M374.0 164.0 L467.0 164.0 L439.0 193.0 L346.0 193.0 Z" pathLength="1"/>
        <path d="M253.0 193.0 L346.0 193.0 L318.0 222.0 L225.0 222.0 Z" pathLength="1"/>
        <path d="M346.0 193.0 L439.0 193.0 L411.0 222.0 L318.0 222.0 Z" pathLength="1"/>
      </g>
      <g clip-path="url(#hsi-b-clip2)">
        <path d="M225.0 344.0 L318.0 344.0 L290.0 373.0 L197.0 373.0 Z" pathLength="1"/>
        <path d="M253.0 315.0 L346.0 315.0 L318.0 344.0 L225.0 344.0 Z" pathLength="1"/>
        <path d="M346.0 315.0 L439.0 315.0 L411.0 344.0 L318.0 344.0 Z" pathLength="1"/>
      </g>
    </g>
    <g class="il drop" data-d="5">
      <path d="M285.5 85.5 L285.5 412" pathLength="1"/>
      <path d="M378.5 85.5 L378.5 412" pathLength="1"/>
      <path d="M277.5 207.5 L293.5 207.5" pathLength="1"/>
      <path d="M370.5 207.5 L386.5 207.5" pathLength="1"/>
      <path d="M277.5 329.5 L293.5 329.5" pathLength="1"/>
      <path d="M370.5 329.5 L386.5 329.5" pathLength="1"/>
    </g>
    <g class="il ring" data-d="6">
      <ellipse cx="332.0" cy="85.5" rx="115.0" ry="26" pathLength="1"/>
      <ellipse cx="331.0" cy="86.5" rx="119.0" ry="29" pathLength="1"/>
      <path d="M285.5 412 L285.5 422 L378.5 422 L378.5 412" pathLength="1"/>
      <path d="M332.0 422 L332.0 432" pathLength="1"/>
    </g>
  </g>
</g>

<g class="labels">
  <text class="lab-year" x="118" y="106" text-anchor="end">2026</text>
  <circle class="lab-dot" cx="96" cy="222" r="2.6"/>
  <circle class="lab-dot" cx="107" cy="222" r="2.6"/>
  <circle class="lab-dot" cx="118" cy="222" r="2.6"/>
  <text class="lab-year" x="118" y="350" text-anchor="end">2013</text>
  <text class="lab-count" x="332.0" y="454" text-anchor="middle">${escapeSvgText(labels.recurring)}</text>
</g>
</svg>`;
}
