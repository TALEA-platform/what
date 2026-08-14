
export const rifugioSvg = `
<svg role="img" viewbox="0 0 1040 430" aria-label="Cos'e' un rifugio climatico" xmlns="http://www.w3.org/2000/svg">
<defs><filter height="106%" id="rifugio-pz" width="106%" x="-3%" y="-3%">
<feturbulence basefrequency="0.014" numoctaves="2" result="n" seed="7" type="fractalNoise"></feturbulence>
<fedisplacementmap in="SourceGraphic" in2="n" scale="1.4"></fedisplacementmap></filter>


<lineargradient gradientunits="userSpaceOnUse" id="rif-heat" x1="0" x2="0" y1="510" y2="330">
  <stop offset="0" stop-color="#C2551F" stop-opacity=".30"></stop>
  <stop offset=".55" stop-color="#C2551F" stop-opacity=".16"></stop>
  <stop offset="1" stop-color="#C2551F" stop-opacity=".06"></stop>
</lineargradient>

<filter height="160%" id="rifugio-soft" width="160%" x="-30%" y="-30%">
<fegaussianblur stddeviation="24"></fegaussianblur></filter>
<mask height="430" id="rifugio-edge" maskunits="userSpaceOnUse" width="1040" x="0" y="0">
<rect fill="#FFFFFF" filter="url(#rifugio-soft)" height="526" width="988" x="26" y="-120"></rect></mask>

</defs>
<g class="scene" filter="url(#rifugio-pz)">
<g class="hotsun">
<circle cx="540" cy="70" fill="#E8A23C" r="38"></circle>
<g opacity=".55" stroke="#F1B345" stroke-linecap="round" stroke-width="4">
<path d="M586 70 L610 70"></path><path d="M494 70 L470 70"></path><path d="M540 116 L540 140"></path><path d="M540 24 L540 0"></path>
<path d="M573 103 L589 119"></path><path d="M507 37 L491 21"></path><path d="M507 103 L491 119"></path><path d="M573 37 L589 21"></path>
</g>
</g>
<g class="bolo">
<path class="bolo-hills" d="M130 330 Q189 272 267 280 Q349 248 431 272 Q521 244 596 266 Q655 276 700 330 Z" fill="#9CAF88" opacity=".18"></path>
<g class="bolo-torri">
<path d="M34 330 L42 176 L70 171 L79 330 Z" fill="#B8A98F" opacity=".33"></path>
<path d="M44 176 L68 171 L67 162 L46 166 Z" fill="#B8A98F" opacity=".33"></path>
<path d="M76 330 L90 218 L113 222 L111 330 Z" fill="#B8A98F" opacity=".29"></path>
<path d="M90 218 L113 222 L111 213 L92 210 Z" fill="#B8A98F" opacity=".29"></path>
</g>
<g class="bolo-portico" fill="none" opacity=".29" stroke="#B8A98F" stroke-linecap="round" stroke-width="12">
<path d="M730 330 L730 246 L906 246 L906 330"></path>
<path d="M734 328 V278 Q734 254 756 254 Q778 254 778 278 V328"></path>
<path d="M780 328 V278 Q780 254 802 254 Q824 254 824 278 V328"></path>
<path d="M826 328 V278 Q826 254 848 254 Q870 254 870 278 V328"></path>
<path d="M872 328 V278 Q872 254 894 254 Q906 254 906 278 V328"></path>
</g>
<g class="bolo-ink">
<path d="M34 330 L42 176 L70 171 L79 330"></path>
<path d="M44 176 L68 171 L67 162 L46 166 Z"></path>
<path d="M76 330 L90 218 L113 222 L111 330"></path>
<path d="M90 218 L113 222 L111 213 L92 210 Z"></path>
<path d="M50 198 L65 195 M49 220 L67 217 M47 243 L69 240 M46 266 L71 263"></path>
<path d="M90 239 L108 241 M87 259 L107 261 M84 279 L106 281"></path>
<path d="M130 330 Q189 272 267 280 Q349 248 431 272 Q521 244 596 266 Q655 276 700 330"></path>
<path d="M730 330 L730 246 L906 246 L906 330"></path>
<path d="M734 328 V278 Q734 254 756 254 Q778 254 778 278 V328"></path>
<path d="M780 328 V278 Q780 254 802 254 Q824 254 824 278 V328"></path>
<path d="M826 328 V278 Q826 254 848 254 Q870 254 870 278 V328"></path>
<path d="M872 328 V278 Q872 254 894 254 Q906 254 906 278 V328"></path>
</g>
</g>
<g class="base"><g class="c"><g mask="url(#rifugio-edge)">
<rect fill="#DFCFB2" height="180" width="1240" x="-100" y="330"></rect>
<rect fill="url(#rif-heat)" height="180" width="1240" x="-100" y="330"></rect>
<rect fill="#C6B18E" height="22" opacity=".42" width="1240" x="-100" y="330"></rect>
<g fill="none" opacity=".34" stroke="#AD8F68" stroke-width="2">
<path d="M-100 362 Q520 356 1140 362"></path>
<path d="M-100 408 Q520 401 1140 408"></path>
<path d="M-100 458 Q520 451 1140 458"></path>
<path d="M60 362 L48 408"></path><path d="M260 362 L252 408"></path><path d="M460 362 L456 408"></path>
<path d="M660 362 L664 408"></path><path d="M860 362 L868 408"></path><path d="M1040 362 L1050 408"></path>
<path d="M-40 408 L-54 458"></path><path d="M160 408 L150 458"></path><path d="M360 408 L354 458"></path>
<path d="M560 408 L562 458"></path><path d="M760 408 L768 458"></path><path d="M960 408 L972 458"></path>
</g>
</g></g><g class="i"><g mask="url(#rifugio-edge)"><path d="M-100 330 L1140 330" pathlength="1"></path></g></g></g>
<g class="layer" data-layer="5"><g class="c">
<g mask="url(#rifugio-edge)">
<path d="M-100 330 L1140 330 L1140 510 L-100 510 Z" fill="#BCD1A2"></path>
<ellipse cx="160" cy="338" fill="#9CAF88" opacity=".26" rx="120" ry="9"></ellipse><ellipse cx="900" cy="338" fill="#9CAF88" opacity=".26" rx="120" ry="9"></ellipse>
</g>
<path d="M442 360 L442 388 M482 360 L482 388 M522 360 L522 388 M562 360 L562 388 M420 374 L584 374" stroke="#A9C68A" stroke-width="3"></path>
</g><g class="i">
<path d="M420 360 L584 360 L584 388 L420 388 Z" pathlength="1"></path>
<path d="M442 360 L442 388" pathlength="1"></path><path d="M482 360 L482 388" pathlength="1"></path><path d="M522 360 L522 388" pathlength="1"></path><path d="M562 360 L562 388" pathlength="1"></path><path d="M420 374 L584 374" pathlength="1"></path>
</g></g>
<g class="layer" data-layer="6"><g class="c access-path" transform="translate(100 0)"><path d="M474 430 L600 430 L576 330 L500 330 Z" fill="#D5C9AC" opacity=".92"></path></g><g class="i access-path" transform="translate(100 0)"><path d="M500 330 L474 430 M576 330 L600 430" pathlength="1"></path></g></g>
<g class="layer" data-layer="2"><g class="c"><ellipse class="shad" cx="858" cy="334" fill="#4a4234" opacity=".11" rx="64" ry="6"></ellipse><ellipse class="shad" cx="380" cy="328" fill="#4a4234" opacity=".1" rx="90" ry="6"></ellipse><path d="M630 120 L826 120 L826 330 L630 330 Z" fill="#DDC49E"></path><path d="M648 330 L648 184 A38 38 0 0 1 724 184 L724 330 Z" fill="#B09877"></path><path d="M742 330 L742 184 A38 38 0 0 1 818 184 L818 330 Z" fill="#B09877"></path><path d="M630 120 L640 120 L640 330 L630 330 Z" fill="#BFA179" opacity=".5"></path><path d="M816 120 L826 120 L826 330 L816 330 Z" fill="#BFA179" opacity=".5"></path><path d="M724 184 L734 184 L734 330 L724 330 Z" fill="#BFA179" opacity=".4"></path><path d="M680 138 L692 138 L690 150 L682 150 Z" fill="#B5825A"></path><path d="M774 138 L786 138 L784 150 L776 150 Z" fill="#B5825A"></path><rect fill="#9A7B58" height="200" width="9" x="306" y="130"></rect><rect fill="#9A7B58" height="200" width="9" x="446" y="130"></rect><rect fill="#B0966A" height="9" width="166" x="298" y="124"></rect><rect fill="#B0966A" height="12" width="5" x="312" y="120"></rect><rect fill="#B0966A" height="12" width="5" x="330" y="120"></rect><rect fill="#B0966A" height="12" width="5" x="348" y="120"></rect><rect fill="#B0966A" height="12" width="5" x="366" y="120"></rect><rect fill="#B0966A" height="12" width="5" x="384" y="120"></rect><rect fill="#B0966A" height="12" width="5" x="402" y="120"></rect><rect fill="#B0966A" height="12" width="5" x="420" y="120"></rect><rect fill="#B0966A" height="12" width="5" x="438" y="120"></rect><path d="M304 122 Q312 108 320 122 Z" fill="#7E9C63"></path><path d="M330 122 Q338 108 346 122 Z" fill="#7E9C63"></path><path d="M356 122 Q364 108 372 122 Z" fill="#7E9C63"></path><path d="M382 122 Q390 108 398 122 Z" fill="#7E9C63"></path><path d="M408 122 Q416 108 424 122 Z" fill="#7E9C63"></path><path d="M434 122 Q442 108 450 122 Z" fill="#7E9C63"></path><path d="M320 126 q-3 14 1 26" fill="none" stroke="#7E9C63" stroke-width="2"></path><path d="M360 126 q-3 14 1 26" fill="none" stroke="#7E9C63" stroke-width="2"></path><path d="M400 126 q-3 14 1 26" fill="none" stroke="#7E9C63" stroke-width="2"></path><path d="M440 126 q-3 14 1 26" fill="none" stroke="#7E9C63" stroke-width="2"></path><ellipse cx="338" cy="112" fill="#A9C68A" opacity=".7" rx="30" ry="14"></ellipse><ellipse cx="412" cy="112" fill="#A9C68A" opacity=".7" rx="28" ry="13"></ellipse></g><g class="i"><path d="M630 120 L826 120 L826 330 L630 330" pathlength="1"></path><path d="M648 330 L648 184 A38 38 0 0 1 724 184 L724 330" pathlength="1"></path><path d="M742 330 L742 184 A38 38 0 0 1 818 184 L818 330" pathlength="1"></path><path d="M640 120 L640 330 M816 120 L816 330" pathlength="1"></path><path d="M306 130 L306 330 M315 130 L315 330" pathlength="1"></path><path d="M446 130 L446 330 M455 130 L455 330" pathlength="1"></path><path d="M298 124 L464 124 L464 133 L298 133 Z" pathlength="1"></path><path d="M320 133 L320 126 M360 133 L360 126 M400 133 L400 126 M440 133 L440 126" pathlength="1"></path><path d="M300 122 Q380 112 462 122" pathlength="1"></path><path d="M320 126 q-3 14 1 26 M400 126 q-3 14 1 26" pathlength="1"></path></g></g>
<g class="layer" data-layer="1"><g class="c"><ellipse class="shad" cx="132" cy="334" fill="#4a4234" opacity=".13" rx="104" ry="7"></ellipse><ellipse class="shad" cx="924" cy="334" fill="#4a4234" opacity=".13" rx="104" ry="7"></ellipse><path d="M32 104 Q40 46 98 28 Q160 14 222 28 Q280 46 288 104 Q262 170 202 164 Q160 178 118 164 Q58 170 32 104 Z" fill="#7E9C63"></path><ellipse cx="140" cy="84" fill="#A9C68A" opacity=".6" rx="52" ry="30"></ellipse><path d="M154 162 L155 330 L165 330 L166 162 Z" fill="#9A7B58"></path><path d="M772 104 Q780 46 838 28 Q900 14 962 28 Q1020 46 1028 104 Q1002 170 942 164 Q900 178 858 164 Q798 170 772 104 Z" fill="#7E9C63"></path><ellipse cx="880" cy="84" fill="#A9C68A" opacity=".6" rx="52" ry="30"></ellipse><path d="M894 162 L895 330 L905 330 L906 162 Z" fill="#9A7B58"></path></g><g class="i"><path d="M32 104 Q40 46 98 28 Q160 14 222 28 Q280 46 288 104 Q262 170 202 164 Q160 178 118 164 Q58 170 32 104 Z" pathlength="1"></path><path d="M155 162 L155 330" pathlength="1"></path><path d="M165 162 L165 330" pathlength="1"></path><path d="M772 104 Q780 46 838 28 Q900 14 962 28 Q1020 46 1028 104 Q1002 170 942 164 Q900 178 858 164 Q798 170 772 104 Z" pathlength="1"></path><path d="M895 162 L895 330" pathlength="1"></path><path d="M905 162 L905 330" pathlength="1"></path></g></g>
<g class="layer" data-layer="4"><g class="c"><ellipse class="shad" cx="489" cy="333" fill="#4a4234" opacity=".12" rx="20" ry="3.5"></ellipse><ellipse class="shad" cx="504" cy="331" fill="#4a4234" opacity=".12" rx="16" ry="3"></ellipse><rect fill="#98A08E" height="78" width="5" x="478" y="252"></rect><circle cx="480" cy="250" fill="#7C8474" r="5"></circle>
<g class="mist">
<ellipse cx="494" cy="244" fill="#E2EEF2" opacity=".5" rx="22" ry="12"></ellipse>
<ellipse cx="508" cy="232" fill="#E2EEF2" opacity=".45" rx="16" ry="9"></ellipse>
<ellipse cx="486" cy="228" fill="#E2EEF2" opacity=".4" rx="13" ry="8"></ellipse>
</g><g transform="translate(-40,0)"><path d="M536 292 L536 322 L548 322 L548 292 Z" fill="#A2A995"></path>
<path d="M533 290 L551 290 L551 296 L533 296 Z" fill="#98A08E"></path>
<path d="M548 300 Q558 300 558 306 L552 306 Q552 302 548 302 Z" fill="#98A08E"></path>
<path d="M556 306 Q556 314 556 320" fill="none" stroke="#A9C9D6" stroke-linecap="round" stroke-width="3"></path>
<ellipse class="water" cx="556" cy="328" fill="#A9C9D6" opacity=".6" rx="14" ry="4"></ellipse></g><ellipse cx="600" cy="330" fill="#A9C9D6" opacity=".7" rx="28" ry="6"></ellipse>
<g class="jets">
<path d="M588 330 L588 300" stroke="#9CC2D2" stroke-linecap="round" stroke-width="3"></path>
<path d="M600 330 L600 288" stroke="#9CC2D2" stroke-linecap="round" stroke-width="3"></path>
<path d="M612 330 L612 302" stroke="#9CC2D2" stroke-linecap="round" stroke-width="3"></path>
<circle cx="588" cy="298" fill="#BFE0EA" r="2.4"></circle><circle cx="600" cy="286" fill="#BFE0EA" r="2.6"></circle><circle cx="612" cy="300" fill="#BFE0EA" r="2.4"></circle>
</g></g><g class="i"><path d="M478 252 L478 330 M483 252 L483 330" pathlength="1"></path><circle cx="480" cy="250" pathlength="1" r="5"></circle><g transform="translate(-40,0)"><path d="M536 292 L536 322 L548 322 L548 292 Z" pathlength="1"></path><path d="M533 290 L551 290" pathlength="1"></path>
<path d="M548 300 Q558 300 558 306" pathlength="1"></path><path d="M556 307 Q556 314 556 320" pathlength="1"></path></g><path d="M574 330 Q600 326 626 330" pathlength="1"></path></g></g>
<g class="layer" data-layer="3"><g class="c"><ellipse class="shad" cx="160" cy="333" fill="#4a4234" opacity=".12" rx="62" ry="5"></ellipse><ellipse class="shad" cx="378" cy="334" fill="#4a4234" opacity=".12" rx="56" ry="5"></ellipse><path d="M104 272 L214 272 L214 278 L104 278 Z" fill="#A0855F"></path>
<path d="M104 300 L214 300 L214 307 L104 307 Z" fill="#8E7250"></path>
<path d="M110 307 L110 330 L116 330 L116 307 Z" fill="#6F6A55"></path><path d="M202 307 L202 330 L208 330 L208 307 Z" fill="#6F6A55"></path>
<path d="M110 278 L110 300 L116 300 L116 278 Z" fill="#7C7660"></path><path d="M202 278 L202 300 L208 300 L208 278 Z" fill="#7C7660"></path><path d="M334 314 L420 314 L420 322 L334 322 Z" fill="#C0B49A"></path><path d="M328 322 L426 322 L426 330 L328 330 Z" fill="#AFA48C" opacity=".6"></path></g><g class="i"><path d="M104 272 L214 272 L214 278 L104 278 Z" pathlength="1"></path><path d="M104 300 L214 300 L214 307 L104 307 Z" pathlength="1"></path>
<path d="M110 307 L110 330" pathlength="1"></path><path d="M116 307 L116 330" pathlength="1"></path><path d="M202 307 L202 330" pathlength="1"></path><path d="M208 307 L208 330" pathlength="1"></path>
<path d="M112 278 L112 300" pathlength="1"></path><path d="M206 278 L206 300" pathlength="1"></path><path d="M334 314 L420 314 L420 322 L334 322 Z" pathlength="1"></path><path d="M328 322 L426 322 L426 330 L328 330 Z" pathlength="1"></path></g></g>

<g class="layer" data-layer="0"><g class="c">
<g class="shad"><ellipse cx="149" cy="332" fill="#4a4234" opacity=".13" rx="28" ry="4"></ellipse><ellipse cx="352" cy="334" fill="#4a4234" opacity=".13" rx="30" ry="4.5"></ellipse><ellipse cx="390" cy="331" fill="#4a4234" opacity=".12" rx="14" ry="3"></ellipse><ellipse cx="520" cy="334" fill="#4a4234" opacity=".13" rx="38" ry="5"></ellipse><ellipse cx="712" cy="333" fill="#4a4234" opacity=".13" rx="24" ry="4"></ellipse></g>

<g class="eld-stand" transform="translate(0,8)">
<g transform="translate(145,195) scale(0.9) translate(-145,-195)">
<ellipse cx="145" cy="166" fill="#D9C79B" rx="27" ry="7"></ellipse>
<path d="M131 166 Q132 150 145 149 Q158 150 159 166 Z" fill="#D9C79B"></path>
<path d="M134 180 C134 171 138 165 145 165 C152 165 156 171 156 180 C156 189 151 195 145 195 C139 195 134 189 134 180 Z" fill="#E9C6A0"></path>
<path d="M134 176 Q130 190 137 196 L140 190 Z" fill="#B9B2A6"></path>
<path d="M156 176 Q160 190 153 196 L150 190 Z" fill="#B9B2A6"></path>
<g class="fx-g"><path class="fx" d="M138 179.8 L143.4 179.2"></path><path class="fx" d="M146.6 179.2 L152 179.8"></path>
<path class="fx fxa fx--flat" d="M140.5 189.6 L149.5 189.6"></path><path class="fx fxa fx--smile" d="M140.3 188.4 q4.7 3.4 9.4 0"></path></g>
</g>
<path d="M140 193 L140 205 L150 205 L150 193 Z" fill="#E9C6A0"></path>
<path d="M128 206 Q145 199 162 206 Q159 220 159 234 L131 234 Q131 220 128 206 Z" fill="#9FB09F"></path>
<path d="M130 228 Q119 272 124 315 L166 315 Q171 272 160 228 Q145 222 130 228 Z" fill="#BBAA8B"></path>
<path d="M126 313 Q124 323 133 323 L135 314 Z" fill="#5E564A"></path>
<path d="M164 313 Q166 323 157 323 L155 314 Z" fill="#5E564A"></path>
<rect fill="#9A7B58" height="64" rx="1.5" width="3" x="119" y="258"></rect>
<path d="M126 210 L135 212 L131 230 L122 228 Z" fill="#9FB09F"></path>
<path d="M164 210 L155 212 L159 230 L168 228 Z" fill="#9FB09F"></path>
<path d="M122 228 L131 230 L127 258 L118 256 Z" fill="#E9C6A0"></path>
<path d="M168 228 L159 230 L162 258 L171 256 Z" fill="#E9C6A0"></path>
<path d="M118 256 L127 258 Q128 266 122 268 Q116 266 116 261 Z" fill="#E9C6A0"></path>
<path d="M171 256 L162 258 Q161 266 167 268 Q173 266 173 261 Z" fill="#E9C6A0"></path>
</g>

<g transform="translate(50,0)">
<g transform="translate(300,194) scale(0.84) translate(-300,-194)">
<path d="M288 176 Q289 160 300 159 Q311 160 312 176 Q306 168 300 168 Q294 168 288 176 Z" fill="#3A2B22"></path>
<path d="M289 181 C289 172 293 166 300 166 C307 166 311 172 311 181 C311 189 306 194 300 194 C294 194 289 189 289 181 Z" fill="#B07A4E"></path>
<g class="fx-g"><path class="fx" d="M293 181 L298.4 180.4"></path><path class="fx" d="M301.6 180.4 L307 181"></path>
<path class="fx fxa fx--flat" d="M295.5 189.8 L304.5 189.8"></path><path class="fx fxa fx--smile" d="M295.3 188.6 q4.7 3.4 9.4 0"></path></g>
</g>
<path d="M295 192 L295 205 L305 205 L305 192 Z" fill="#B07A4E"></path>
<path d="M282 209 L292 212 L290 231 L280 229 Z" fill="#C48D74"></path>
<path d="M318 209 L308 212 L310 231 L320 229 Z" fill="#C48D74"></path>
<path d="M280 229 L290 231 L288 266 L279 264 Z" fill="#B07A4E"></path>
<path d="M320 229 L310 231 L317 259 L327 256 Z" fill="#B07A4E"></path>
<path d="M279 264 L288 266 Q289 275 283 277 Q278 276 278 270 Z" fill="#B07A4E"></path>
<path d="M327 256 L317 259 Q319 269 325 271 Q331 269 330 262 Z" fill="#B07A4E"></path>
<path d="M283 208 Q300 199 317 208 Q313 234 314 258 L286 258 Q287 234 283 208 Z" fill="#C48D74"></path>
<path d="M289 258 L285 328 L296 328 L300 265 L304 328 L315 328 L311 258 Q300 254 289 258 Z" fill="#7E8B93"></path>
<path d="M285 326 L283 333 L297 333 L297 326 Z" fill="#42403A"></path>
<path d="M315 326 L317 333 L303 333 L304 326 Z" fill="#42403A"></path>
<g transform="translate(338,247) scale(0.9) translate(-338,-247)">
<path d="M331 233 Q332 223 338 222 Q344 223 345 233 Q341 228 338 228 Q335 228 331 233 Z" fill="#2A2620"></path>
<path d="M332 237 C332 230 335 225 338 225 C341 225 344 230 344 237 C344 243 341 247 338 247 C335 247 332 243 332 237 Z" fill="#E9C6A0"></path>
<g class="fx-g"><path class="fx" d="M334.2 235.6 L337.5 235.2"></path><path class="fx" d="M338.5 235.2 L341.8 235.6"></path>
<path class="fx fxa fx--flat" d="M335 241.6 L341 241.6"></path><path class="fx fxa fx--smile" d="M334.9 240.6 q3.1 2.6 6.2 0"></path></g>
</g>
<path d="M335 245 L335 253 L341 253 L341 245 Z" fill="#E9C6A0"></path>
<path d="M330 253 L336 255 L334 266 L328 264 Z" fill="#DBB56C"></path>
<path d="M346 253 L340 255 L342 266 L348 264 Z" fill="#DBB56C"></path>
<path d="M328 264 L334 266 L331 272 L325 270 Z" fill="#E9C6A0"></path>
<path d="M348 264 L342 266 L345 278 L351 277 Z" fill="#E9C6A0"></path>
<path d="M351 277 L345 278 Q344 284 348 285 Q352 284 352 280 Z" fill="#E9C6A0"></path>
<path d="M330 251 Q338 247 346 251 Q348 266 345 280 L332 280 Q329 266 330 251 Z" fill="#DBB56C"></path>
<path d="M331 280 L330 302 L335 302 L336 282 Z" fill="#7E8B93"></path>
<path d="M340 282 L341 302 L346 302 L345 280 Z" fill="#7E8B93"></path>
<path d="M331 302 L330 324 L335 324 L335 302 Z" fill="#E9C6A0"></path>
<path d="M341 302 L341 324 L346 324 L345 302 Z" fill="#E9C6A0"></path>
<path d="M329 322 L328 328 L337 328 L336 322 Z" fill="#42403A"></path>
<path d="M340 322 L340 328 L348 328 L347 322 Z" fill="#42403A"></path>
</g>

<g transform="translate(40,0)">
<circle cx="478" cy="300" fill="none" r="29" stroke="#46423B" stroke-width="5"></circle>
<circle cx="478" cy="300" fill="none" r="26" stroke="#AEB4B8" stroke-width="2"></circle>
<circle cx="478" cy="300" fill="none" r="22" stroke="#8A9197" stroke-width="1.5"></circle>
<circle cx="478" cy="300" fill="#7C8474" r="4"></circle>
<circle cx="524" cy="322" fill="none" r="6" stroke="#46423B" stroke-width="3"></circle>
<g transform="translate(510,223) scale(0.88) translate(-510,-223)">
<path d="M500 207 Q501 198 510 197 Q519 198 520 207 Q514 201 510 201 Q506 201 500 207 Z" fill="#3A2B22"></path>
<path d="M500 210 C500 201 504 196 510 196 C516 196 521 201 521 210 C521 218 516 223 510 223 C504 223 500 218 500 210 Z" fill="#C68F62"></path>
<g class="fx-g"><path class="fx" d="M504 209.8 L509.4 209.2"></path><path class="fx" d="M512.6 209.2 L518 209.8"></path>
<path class="fx fxb fx--flat" d="M506 218.2 L515 218.2"></path><path class="fx fxb fx--smile" d="M505.8 217 q4.6 3.4 9.2 0"></path></g>
</g>
<path d="M506 221 L505 232 L514 232 L514 221 Z" fill="#C68F62"></path>
<path d="M496 233 Q510 227 524 233 Q521 260 517 289 L494 288 Q497 260 496 233 Z" fill="#7E9CB0"></path>
<path d="M494 288 Q509 290 521 295 L525 316 L515 318 Q503 301 492 292 Z" fill="#8C9A6E"></path>
<path d="M515 316 L527 316 L528 322 L516 322 Z" fill="#42403A"></path>
<path d="M497 235 L506 237 L502 256 L493 254 Z" fill="#7E9CB0"></path>
<path d="M493 254 L502 256 L499 276 L490 274 Z" fill="#C68F62"></path>
<path d="M490 274 L499 276 Q500 284 494 286 Q488 284 488 279 Z" fill="#C68F62"></path>
</g>

<g transform="translate(82,0)">
<g transform="translate(628,194) scale(0.8) translate(-628,-194)">
<ellipse cx="615" cy="166" fill="#2A2620" rx="6" ry="7"></ellipse>
<path d="M617 177 Q618 159 628 158 Q638 159 639 177 Q633 169 628 169 Q623 169 617 177 Z" fill="#2A2620"></path>
<path d="M617 181 C617 172 622 166 628 166 C634 166 639 172 639 181 C639 189 634 194 628 194 C622 194 617 189 617 181 Z" fill="#8E6443"></path>
<g class="fx-g"><path class="fx" d="M621 181 L626.4 180.4"></path><path class="fx" d="M629.6 180.4 L635 181"></path>
<path class="fx fxb fx--flat" d="M623.5 189.8 L632.5 189.8"></path><path class="fx fxb fx--smile" d="M623.3 188.6 q4.7 3.4 9.4 0"></path></g>
</g>
<path d="M623 192 L623 205 L633 205 L633 192 Z" fill="#8E6443"></path>
<path d="M613 208 Q628 199 643 208 Q646 224 649 238 Q660 252 657 268 Q654 288 650 300 L610 300 Q606 288 603 268 Q600 252 611 238 Q614 224 613 208 Z" fill="#C58C82"></path>
<path d="M617 300 L615 326 L622 326 L623 300 Z" fill="#8E6443"></path>
<path d="M637 300 L638 326 L645 326 L643 300 Z" fill="#8E6443"></path>
<path d="M613 324 L612 330 L624 330 L623 324 Z" fill="#6E5A47"></path>
<path d="M637 324 L638 330 L648 330 L646 324 Z" fill="#6E5A47"></path>
<path d="M643 209 L634 211 L637 230 L646 228 Z" fill="#C58C82"></path>
<path d="M646 228 L637 230 L636 252 L645 251 Z" fill="#8E6443"></path>
<path d="M645 251 L636 252 Q634 260 639 262 Q645 261 645 256 Z" fill="#8E6443"></path>
<path d="M617 207 L607 203 L603 211 L613 215 Z" fill="#C58C82"></path>
<path d="M608 209 L620 189 L612 185 L601 205 Z" fill="#8E6443"></path>
<path d="M612 185 L620 189 Q623 185 621 180 Q616 178 613 182 Z" fill="#8E6443"></path>
</g>

</g><g class="i">
<g class="eld-stand" transform="translate(0,8)">
<g transform="translate(145,195) scale(0.9) translate(-145,-195)">
<path d="M118 166 Q145 156 172 166 Q145 176 118 166" pathlength="1"></path>
<path d="M131 166 Q132 150 145 149 Q158 150 159 166" pathlength="1"></path>
<path d="M134 180 C134 171 138 165 145 165 C152 165 156 171 156 180 C156 189 151 195 145 195 C139 195 134 189 134 180 Z" pathlength="1"></path>
<path d="M134 177 Q130 190 137 196" pathlength="1"></path><path d="M156 177 Q160 190 153 196" pathlength="1"></path>
</g>
<path d="M140 194 L140 204" pathlength="1"></path><path d="M150 194 L150 204" pathlength="1"></path>
<path d="M128 206 Q145 199 162 206" pathlength="1"></path>
<path d="M128 206 Q131 220 131 234" pathlength="1"></path><path d="M162 206 Q159 220 159 234" pathlength="1"></path>
<path d="M145 202 L145 232" pathlength="1"></path>
<path d="M130 228 Q119 272 124 315" pathlength="1"></path><path d="M160 228 Q171 272 166 315" pathlength="1"></path>
<path d="M124 315 Q145 318 166 315" pathlength="1"></path>
<path d="M138 236 L135 313" pathlength="1"></path><path d="M152 236 L155 313" pathlength="1"></path>
<path d="M126 210 L122 228 L118 256" pathlength="1"></path>
<path d="M164 210 L168 228 L171 256" pathlength="1"></path>
<path d="M122 228 L131 230" pathlength="1"></path><path d="M168 228 L159 230" pathlength="1"></path>
<path d="M118 256 Q116 261 116 266 Q120 269 123 268 Q128 266 127 258" pathlength="1"></path>
<path d="M171 256 Q173 261 173 266 Q169 269 166 268 Q161 266 162 258" pathlength="1"></path>
<path d="M120 258 L120 322" pathlength="1"></path>
<path d="M126 313 Q124 323 133 323" pathlength="1"></path><path d="M164 313 Q166 323 157 323" pathlength="1"></path>
</g>
<g transform="translate(50,0)">
<g transform="translate(300,194) scale(0.84) translate(-300,-194)">
<path d="M288 176 Q289 160 300 159 Q311 160 312 176" pathlength="1"></path>
<path d="M288 176 Q294 169 300 169 Q306 169 312 176" pathlength="1"></path>
<path d="M289 181 C289 172 293 166 300 166 C307 166 311 172 311 181 C311 189 306 194 300 194 C294 194 289 189 289 181 Z" pathlength="1"></path>
</g>
<path d="M295 193 L295 204" pathlength="1"></path><path d="M305 193 L305 204" pathlength="1"></path>
<path d="M283 208 Q300 199 317 208" pathlength="1"></path>
<path d="M283 208 Q287 234 286 258" pathlength="1"></path><path d="M317 208 Q313 234 314 258" pathlength="1"></path>
<path d="M286 258 Q300 254 314 258" pathlength="1"></path>
<path d="M294 205 Q300 212 306 205" pathlength="1"></path>
<path d="M282 209 Q278 240 279 265" pathlength="1"></path>
<path d="M318 209 Q322 234 327 256" pathlength="1"></path>
<path d="M280 229 L286 230" pathlength="1"></path><path d="M320 229 L314 230" pathlength="1"></path>
<path d="M279 265 Q278 275 283 277 Q289 275 288 266" pathlength="1"></path>
<path d="M327 256 Q331 262 330 268 Q325 272 320 270" pathlength="1"></path>
<path d="M296 328 L300 265 L304 328" pathlength="1"></path>
<path d="M289 258 L285 328" pathlength="1"></path><path d="M311 258 L315 328" pathlength="1"></path>
<path d="M285 326 Q290 330 297 330" pathlength="1"></path><path d="M315 326 Q310 330 303 330" pathlength="1"></path>
<g transform="translate(338,247) scale(0.9) translate(-338,-247)">
<path d="M331 233 Q332 223 338 222 Q344 223 345 233" pathlength="1"></path>
<path d="M332 237 C332 230 335 225 338 225 C341 225 344 230 344 237 C344 243 341 247 338 247 C335 247 332 243 332 237 Z" pathlength="1"></path>
</g>
<path d="M335 246 L335 252" pathlength="1"></path><path d="M341 246 L341 252" pathlength="1"></path>
<path d="M330 251 Q329 266 332 280" pathlength="1"></path><path d="M346 251 Q348 266 345 280" pathlength="1"></path>
<path d="M330 251 Q338 247 346 251" pathlength="1"></path><path d="M332 280 L345 280" pathlength="1"></path>
<path d="M330 253 Q326 262 325 270" pathlength="1"></path><path d="M346 253 Q350 266 351 277" pathlength="1"></path>
<path d="M328 264 L333 265" pathlength="1"></path><path d="M348 264 L343 265" pathlength="1"></path>
<path d="M325 270 Q327 273 331 272" pathlength="1"></path>
<path d="M351 277 Q352 283 348 285 Q344 284 345 278" pathlength="1"></path>
<path d="M331 280 L330 324" pathlength="1"></path><path d="M345 280 L346 324" pathlength="1"></path><path d="M338 282 L338 322" pathlength="1"></path>
<path d="M329 322 Q333 328 337 328" pathlength="1"></path><path d="M347 322 Q344 328 340 328" pathlength="1"></path>
</g>
<g transform="translate(40,0)">
<circle cx="478" cy="300" pathlength="1" r="29"></circle>
<circle cx="478" cy="300" pathlength="1" r="22"></circle>
<circle cx="478" cy="300" pathlength="1" r="4"></circle>
<path d="M478 278 L478 322" pathlength="1"></path><path d="M456 300 L500 300" pathlength="1"></path>
<path d="M462 284 L494 316" pathlength="1"></path><path d="M462 316 L494 284" pathlength="1"></path>
<circle cx="524" cy="322" pathlength="1" r="6"></circle>
<g transform="translate(510,223) scale(0.88) translate(-510,-223)">
<path d="M500 207 Q501 198 510 197 Q519 198 520 207" pathlength="1"></path>
<path d="M500 210 C500 201 504 196 510 196 C516 196 521 201 521 210 C521 218 516 223 510 223 C504 223 500 218 500 210 Z" pathlength="1"></path>
</g>
<path d="M506 222 L506 231" pathlength="1"></path><path d="M514 222 L514 231" pathlength="1"></path>
<path d="M496 233 Q510 227 524 233" pathlength="1"></path>
<path d="M496 233 Q497 260 494 288" pathlength="1"></path><path d="M524 233 Q521 260 517 289" pathlength="1"></path>
<path d="M494 288 Q506 291 517 289" pathlength="1"></path>
<path d="M510 236 L509 286" pathlength="1"></path>
<path d="M497 235 L493 254 L490 274" pathlength="1"></path>
<path d="M493 254 L502 256" pathlength="1"></path>
<path d="M490 274 Q488 279 488 283 Q492 287 495 286 Q500 284 499 276" pathlength="1"></path>
<path d="M494 288 Q509 290 521 295" pathlength="1"></path>
<path d="M492 292 Q503 301 515 317" pathlength="1"></path>
<path d="M521 295 L525 316" pathlength="1"></path>
<path d="M515 316 L528 316" pathlength="1"></path>
<path d="M517 289 L519 317" pathlength="1"></path><path d="M494 289 L482 298" pathlength="1"></path>
</g>
<g transform="translate(82,0)">
<g transform="translate(628,194) scale(0.8) translate(-628,-194)">
<ellipse cx="615" cy="166" pathlength="1" rx="6" ry="7"></ellipse>
<path d="M617 177 Q618 159 628 158 Q638 159 639 177" pathlength="1"></path>
<path d="M617 177 Q623 170 628 170 Q633 170 639 177" pathlength="1"></path>
<path d="M617 181 C617 172 622 166 628 166 C634 166 639 172 639 181 C639 189 634 194 628 194 C622 194 617 189 617 181 Z" pathlength="1"></path>
</g>
<path d="M623 193 L623 204" pathlength="1"></path><path d="M633 193 L633 204" pathlength="1"></path>
<path d="M613 208 Q628 199 643 208" pathlength="1"></path>
<path d="M622 208 Q628 213 634 208" pathlength="1"></path>
<path d="M613 208 Q614 224 611 238 Q600 252 603 268 Q606 288 610 300" pathlength="1"></path>
<path d="M643 208 Q646 224 649 238 Q660 252 657 268 Q654 288 650 300" pathlength="1"></path>
<path d="M610 300 L650 300" pathlength="1"></path>
<path d="M611 239 Q630 245 649 239" pathlength="1"></path>
<path d="M620 252 Q616 276 620 292" pathlength="1"></path>
<path d="M636 252 Q642 274 638 292" pathlength="1"></path>
<path d="M643 209 L646 228 L645 251" pathlength="1"></path>
<path d="M634 211 L637 230 L636 252" pathlength="1"></path>
<path d="M646 228 L637 230" pathlength="1"></path>
<path d="M645 251 Q645 257 644 260 Q639 263 637 261 Q634 258 636 252" pathlength="1"></path>
<path d="M617 207 L607 203 Q602 204 601 205 L612 185" pathlength="1"></path>
<path d="M613 215 L608 209 L620 189" pathlength="1"></path>
<path d="M612 185 Q616 178 621 180 Q623 185 620 189" pathlength="1"></path>
<path d="M617 300 L615 326" pathlength="1"></path><path d="M623 300 L622 326" pathlength="1"></path>
<path d="M637 300 L638 326" pathlength="1"></path><path d="M643 300 L645 326" pathlength="1"></path>
<path d="M613 324 Q616 330 624 330" pathlength="1"></path>
<path d="M637 324 Q640 330 648 330" pathlength="1"></path>
</g>
</g></g>

<g class="eld-seat"><g class="c"><ellipse cx="150" cy="226" fill="#D9C79B" rx="24" ry="6"></ellipse>
<path d="M137 226 Q138 212 150 211 Q162 212 163 226 Z" fill="#D9C79B"></path>
<path d="M145 238 L144 250 L156 250 L155 238 Z" fill="#E9C6A0"></path>
<path d="M141 238 C141 229 145 223 151 223 C157 223 161 229 161 238 C161 246 156 251 151 251 C146 251 141 246 141 238 Z" fill="#E9C6A0"></path>
<path d="M141 234 Q137 246 144 252 L147 246 Z" fill="#B9B2A6"></path>
<path d="M140 256 Q150 250 162 256 Q166 270 160 282 L142 282 Q137 270 140 256 Z" fill="#9FB09F"></path>
<path d="M142 278 Q138 292 144 302 L150 308 L188 306 L188 298 Q190 280 184 262 Q163 254 142 278 Z" fill="#BBAA8B"></path>
<path d="M168 308 L170 330 L178 330 L176 308 Z" fill="#BBAA8B"></path><path d="M180 306 L182 330 L190 330 L188 306 Z" fill="#BBAA8B"></path>
<path d="M168 328 L167 332 L179 332 L178 328 Z" fill="#5E564A"></path><path d="M180 328 L179 332 L191 332 L190 328 Z" fill="#5E564A"></path>
<rect fill="#9A7B58" height="54" rx="1.5" transform="rotate(-7 117 300)" width="3" x="116" y="276"></rect>
<circle cx="170" cy="296" fill="#E9C6A0" r="4"></circle></g><g class="i"><path d="M126 226 Q150 217 174 226 Q150 234 126 226" pathlength="1"></path>
<path d="M137 226 Q138 212 150 211 Q162 212 163 226" pathlength="1"></path>
<path d="M141 238 C141 229 145 223 151 223 C157 223 161 229 161 238 C161 246 156 251 151 251 C146 251 141 246 141 238 Z" pathlength="1"></path>
<path d="M154 236 q3 0 4 1" pathlength="1"></path><path d="M153 244 Q156 246 159 244" pathlength="1"></path><path d="M161 238 q3 1 1 4" pathlength="1"></path>
<path d="M141 234 Q137 246 144 252" pathlength="1"></path><path d="M147 251 L146 256" pathlength="1"></path><path d="M156 251 L156 256" pathlength="1"></path>
<path d="M140 256 Q150 250 162 256 Q166 270 160 282 L142 282 Q137 270 140 256" pathlength="1"></path>
<path d="M142 278 Q138 292 144 302 L150 308 L188 306" pathlength="1"></path><path d="M188 306 Q190 282 182 260" pathlength="1"></path>
<path d="M150 282 Q150 296 152 306" pathlength="1"></path><path d="M150 308 Q168 310 188 306" pathlength="1"></path>
<path d="M168 308 L170 330" pathlength="1"></path><path d="M178 308 L176 330" pathlength="1"></path><path d="M180 306 L182 330" pathlength="1"></path><path d="M190 306 L188 330" pathlength="1"></path>
<path d="M168 328 Q173 332 179 332" pathlength="1"></path><path d="M180 328 Q185 332 191 332" pathlength="1"></path>
<path d="M160 268 Q166 284 170 296" pathlength="1"></path><circle cx="170" cy="296" pathlength="1" r="4"></circle>
<path d="M119 276 L114 330" pathlength="1"></path><path d="M119 276 Q124 273 126 278" pathlength="1"></path></g></g>
<g class="layer" data-layer="5"><g class="c"><path d="M92 312 L124 312 L121 330 L95 330 Z" fill="#B07A4E"></path><path d="M98 312 q-2 -16 3 -22 M106 312 q0 -18 3 -24 M114 312 q3 -15 7 -21" fill="none" stroke="#7E9C63" stroke-width="2.2"></path><circle cx="106" cy="288" fill="#E8C24A" r="3"></circle><circle cx="116" cy="292" fill="#C58AB0" r="3"></circle><path d="M836 312 L868 312 L865 330 L839 330 Z" fill="#B07A4E"></path><path d="M842 312 q-2 -16 3 -22 M850 312 q0 -18 3 -24 M858 312 q3 -15 7 -21" fill="none" stroke="#7E9C63" stroke-width="2.2"></path><circle cx="850" cy="288" fill="#E8C24A" r="3"></circle><circle cx="860" cy="292" fill="#C58AB0" r="3"></circle></g><g class="i"><path d="M92 312 L124 312 L121 330 L95 330 Z" pathlength="1"></path><path d="M98 312 q-2 -16 3 -22 M106 312 q0 -18 3 -24 M114 312 q3 -15 7 -21" pathlength="1"></path><path d="M836 312 L868 312 L865 330 L839 330 Z" pathlength="1"></path><path d="M842 312 q-2 -16 3 -22 M850 312 q0 -18 3 -24 M858 312 q3 -15 7 -21" pathlength="1"></path></g></g>
<g class="layer" data-layer="6"><g class="c">
<ellipse class="shad" cx="978" cy="334" fill="#4a4234" opacity=".13" rx="46" ry="5"></ellipse>
<path d="M932 246 L1024 246 L1024 254 L932 254 Z" fill="#A79E8B"></path>
<path d="M938 254 L938 330 L944 330 L944 254 Z" fill="#B3AA97"></path>
<path d="M1012 254 L1012 330 L1018 330 L1018 254 Z" fill="#B3AA97"></path>
<path d="M944 262 L1012 262 L1012 298 L944 298 Z" fill="#E4E5D8" opacity=".5"></path>
<rect fill="#B0966A" height="6" width="56" x="950" y="302"></rect>
<path d="M954 308 L954 330 M1002 308 L1002 330" stroke="#8A7A5E" stroke-width="3"></path>
<rect fill="#8A8271" height="92" width="4" x="925" y="238"></rect>
<rect fill="#E8A23C" height="24" rx="4" width="38" x="908" y="214"></rect>
<rect fill="#FCF7EA" height="10" rx="2" width="20" x="916" y="219"></rect>
<circle cx="921" cy="233" fill="#3a352a" r="2.2"></circle><circle cx="933" cy="233" fill="#3a352a" r="2.2"></circle>
</g><g class="i">
<path d="M932 246 L1024 246 L1024 254 L932 254 Z" pathlength="1"></path>
<path d="M938 254 L938 330" pathlength="1"></path><path d="M944 254 L944 330" pathlength="1"></path>
<path d="M1012 254 L1012 330" pathlength="1"></path><path d="M1018 254 L1018 330" pathlength="1"></path>
<path d="M950 305 L1006 305" pathlength="1"></path>
<path d="M927 238 L927 330" pathlength="1"></path>
<path d="M912 214 L942 214 Q946 214 946 218 L946 234 Q946 238 942 238 L912 238 Q908 238 908 234 L908 218 Q908 214 912 214 Z" pathlength="1"></path>
</g></g>
<g class="layer" data-layer="7"><g class="c">
<ellipse class="shad" cx="62" cy="333" fill="#4a4234" opacity=".12" rx="24" ry="4"></ellipse>
<rect fill="#7A6A52" height="14" width="6" x="56" y="318"></rect>
<rect fill="#5A8360" height="34" rx="5" width="40" x="40" y="250"></rect>
<path d="M60 258 Q66 264 60 272 Q54 264 60 258 Z" fill="#EAF3E6"></path><path d="M58 272 L62 272 L61 278 L59 278 Z" fill="#EAF3E6"></path><path d="M52 278 Q60 274 68 278" fill="none" stroke="#EAF3E6" stroke-width="2"></path>
<path class="bird" d="M300 78 Q308 72 316 78 Q324 72 332 78" fill="none" stroke="#7E7259" stroke-linecap="round" stroke-width="2"></path>
<path class="bird" d="M360 92 Q366 87 372 92 Q378 87 384 92" fill="none" stroke="#7E7259" stroke-linecap="round" stroke-width="1.8"></path>
<path class="bird" d="M690 74 Q696 69 702 74 Q708 69 714 74" fill="none" stroke="#7E7259" stroke-linecap="round" stroke-width="1.7"></path>
</g><g class="i">
<path d="M40 250 L80 250 L80 284 L40 284 Z" pathlength="1"></path><path d="M60 284 L60 318" pathlength="1"></path><path d="M54 318 L66 318" pathlength="1"></path>
<path d="M60 258 Q66 264 60 272 Q54 264 60 258 Z" pathlength="1"></path>
</g></g>
<g class="heat">
<g mask="url(#rifugio-edge)"><rect fill="#E8965A" height="180" opacity=".05" width="1240" x="-100" y="330"></rect></g>
<path d="M120 322 q18 -6 36 0 t36 0" fill="none" opacity=".4" stroke="#E0A268" stroke-width="2"></path>
<path d="M560 322 q18 -6 36 0 t36 0" fill="none" opacity=".38" stroke="#E0A268" stroke-width="2"></path>
<path d="M880 322 q18 -6 36 0 t36 0" fill="none" opacity=".35" stroke="#E0A268" stroke-width="2"></path>
<g transform="translate(0,8)"><ellipse cx="145" cy="178" fill="#E8865A" opacity=".22" rx="5" ry="3"></ellipse><path d="M159 168 c-2.5 3 -2.5 6 0 6 c2.5 0 2.5 -3 0 -6 Z" fill="#9CC2D2"></path><path d="M162 177 c-2.5 3 -2.5 6 0 6 c2.5 0 2.5 -3 0 -6 Z" fill="#9CC2D2"></path><path d="M137 119 q4 -6 0 -12 q-4 -6 0 -12" fill="none" opacity=".55" stroke="#D89A5E" stroke-linecap="round" stroke-width="1.6"></path><path d="M151 115 q4 -6 0 -12 q-4 -6 0 -12" fill="none" opacity=".55" stroke="#D89A5E" stroke-linecap="round" stroke-width="1.6"></path></g><g transform="translate(50,0)"><ellipse cx="300" cy="186" fill="#E8865A" opacity=".22" rx="5" ry="3"></ellipse><path d="M314 184 c-2.5 3 -2.5 6 0 6 c2.5 0 2.5 -3 0 -6 Z" fill="#9CC2D2"></path><path d="M317 193 c-2.5 3 -2.5 6 0 6 c2.5 0 2.5 -3 0 -6 Z" fill="#9CC2D2"></path><path d="M292 135 q4 -6 0 -12 q-4 -6 0 -12" fill="none" opacity=".55" stroke="#D89A5E" stroke-linecap="round" stroke-width="1.6"></path><path d="M306 131 q4 -6 0 -12 q-4 -6 0 -12" fill="none" opacity=".55" stroke="#D89A5E" stroke-linecap="round" stroke-width="1.6"></path></g><g transform="translate(40,0)"><ellipse cx="510" cy="215" fill="#E8865A" opacity=".22" rx="5" ry="3"></ellipse><path d="M524 213 c-2.5 3 -2.5 6 0 6 c2.5 0 2.5 -3 0 -6 Z" fill="#9CC2D2"></path><path d="M527 222 c-2.5 3 -2.5 6 0 6 c2.5 0 2.5 -3 0 -6 Z" fill="#9CC2D2"></path><path d="M502 164 q4 -6 0 -12 q-4 -6 0 -12" fill="none" opacity=".55" stroke="#D89A5E" stroke-linecap="round" stroke-width="1.6"></path><path d="M516 160 q4 -6 0 -12 q-4 -6 0 -12" fill="none" opacity=".55" stroke="#D89A5E" stroke-linecap="round" stroke-width="1.6"></path></g><g transform="translate(82,0)"><ellipse cx="628" cy="186" fill="#E8865A" opacity=".22" rx="5" ry="3"></ellipse><path d="M642 184 c-2.5 3 -2.5 6 0 6 c2.5 0 2.5 -3 0 -6 Z" fill="#9CC2D2"></path><path d="M645 193 c-2.5 3 -2.5 6 0 6 c2.5 0 2.5 -3 0 -6 Z" fill="#9CC2D2"></path><path d="M620 135 q4 -6 0 -12 q-4 -6 0 -12" fill="none" opacity=".55" stroke="#D89A5E" stroke-linecap="round" stroke-width="1.6"></path><path d="M634 131 q4 -6 0 -12 q-4 -6 0 -12" fill="none" opacity=".55" stroke="#D89A5E" stroke-linecap="round" stroke-width="1.6"></path></g>
</g>
</g></svg>`;
