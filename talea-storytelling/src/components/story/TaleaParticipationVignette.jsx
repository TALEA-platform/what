import { motion } from "framer-motion";

const VIGNETTE_EASE = [0.22, 1, 0.36, 1];

const VIGNETTE_SEQUENCE = {
  hidden: {},
  show: {
    transition: {
      staggerChildren: 0.1,
      delayChildren: 0.04,
    },
  },
};

const VIGNETTE_FADE = {
  hidden: { opacity: 0, y: 10 },
  show: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.68, ease: VIGNETTE_EASE },
  },
};

const VIGNETTE_DRAW = {
  hidden: { opacity: 0, pathLength: 0 },
  show: {
    opacity: 1,
    pathLength: 1,
    transition: { duration: 0.82, ease: VIGNETTE_EASE },
  },
};

const HAND_FROM_LEFT = {
  hidden: { opacity: 0, x: -24, y: 4 },
  show: {
    opacity: 1,
    x: 0,
    y: 0,
    transition: { duration: 0.64, delay: 0.48, ease: VIGNETTE_EASE },
  },
};

const HAND_FROM_RIGHT = {
  hidden: { opacity: 0, x: 24, y: -8 },
  show: {
    opacity: 1,
    x: 0,
    y: 0,
    transition: { duration: 0.64, delay: 0.76, ease: VIGNETTE_EASE },
  },
};

const HAND_FROM_BOTTOM = {
  hidden: { opacity: 0, y: 24 },
  show: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.64, delay: 1.02, ease: VIGNETTE_EASE },
  },
};

const MARKER_REVEAL = {
  hidden: { opacity: 0, y: -9, scale: 0.8 },
  show: (index) => ({
    opacity: 1,
    y: 0,
    scale: 1,
    transition: {
      duration: 0.42,
      delay: 0.66 + index * 0.09,
      ease: VIGNETTE_EASE,
    },
  }),
};

const MAP_MARKERS = [
  { x: 238, y: 160, tone: "sage" },
  { x: 344, y: 197, tone: "green" },
  { x: 492, y: 171, tone: "green" },
  { x: 286, y: 306, tone: "sage" },
  { x: 520, y: 305, tone: "green" },
];

function MapMarker({ x, y, tone = "green", index = 0 }) {
  return (
    <g transform={`translate(${x} ${y})`}>
      <motion.g
        className={`tpv-marker tpv-marker--${tone}`}
        custom={index}
        variants={MARKER_REVEAL}
      >
        <path d="M0 10 C-9 1 -12 -5 -12 -11 A12 12 0 1 1 12 -11 C12 -5 9 1 0 10 Z" />
        <circle cx="0" cy="-11" r="3.5" />
      </motion.g>
    </g>
  );
}

export function TaleaParticipationVignette({
  ariaLabel,
  description,
  reduceMotion,
}) {
  return (
    <motion.svg
      className="talea-participation-vignette-svg"
      viewBox="0 0 720 470"
      role="img"
      aria-label={ariaLabel}
      initial={reduceMotion ? false : "hidden"}
      whileInView="show"
      viewport={{ once: true, amount: 0.28 }}
      variants={VIGNETTE_SEQUENCE}
      xmlns="http://www.w3.org/2000/svg"
    >
      <desc>{description}</desc>

      <defs>
        <pattern id="tpv-paper-grain" width="18" height="18" patternUnits="userSpaceOnUse">
          <circle className="tpv-grain-dot" cx="3" cy="5" r="0.9" />
          <circle className="tpv-grain-dot" cx="13" cy="14" r="0.65" />
        </pattern>
        <filter id="tpv-soft-shadow" x="-20%" y="-20%" width="150%" height="160%">
          <feDropShadow dx="0" dy="8" stdDeviation="8" floodColor="#2d4334" floodOpacity="0.14" />
        </filter>
      </defs>

      <motion.ellipse
        className="tpv-wash"
        cx="360"
        cy="246"
        rx="325"
        ry="194"
        variants={VIGNETTE_FADE}
      />
      <motion.path
        className="tpv-wash-accent"
        d="M74 285 C121 134 260 71 423 82 C570 92 645 176 653 284 C659 359 584 415 478 426 C330 442 182 416 111 355 C85 333 69 309 74 285 Z"
        variants={VIGNETTE_FADE}
      />

      <motion.g className="tpv-map-base" variants={VIGNETTE_FADE}>
        <path
          className="tpv-paper-shadow"
          filter="url(#tpv-soft-shadow)"
          d="M127 88 Q132 75 148 76 L603 98 Q618 99 616 115 L594 378 Q592 394 576 393 L131 371 Q115 370 117 353 Z"
        />
        <path
          className="tpv-paper"
          d="M119 78 Q124 65 140 66 L595 88 Q610 89 608 105 L586 368 Q584 384 568 383 L123 361 Q107 360 109 343 Z"
        />
        <path
          className="tpv-paper-texture"
          d="M119 78 Q124 65 140 66 L595 88 Q610 89 608 105 L586 368 Q584 384 568 383 L123 361 Q107 360 109 343 Z"
        />
        <path className="tpv-fold" d="M550 382 L586 346 L584 369 Q582 382 568 383 Z" />

        <path className="tpv-block" d="M158 112 L260 117 L246 176 L145 171 Z" />
        <path className="tpv-block" d="M424 121 L566 128 L557 188 L415 181 Z" />
        <path className="tpv-block" d="M151 267 L238 271 L231 333 L144 329 Z" />
        <path className="tpv-block" d="M445 273 L558 279 L551 342 L438 336 Z" />
        <path className="tpv-park" d="M283 102 Q342 86 404 111 L393 180 Q336 199 276 169 Z" />
        <path className="tpv-pilot-area tpv-pilot-area--one" d="M270 218 Q321 198 367 216 L359 282 Q310 299 266 275 Z" />
        <path className="tpv-pilot-area tpv-pilot-area--two" d="M371 228 Q418 205 464 224 L455 287 Q410 305 367 282 Z" />

        <path className="tpv-street" d="M177 84 C221 130 247 181 246 240 C246 286 270 327 323 371" />
        <path className="tpv-street" d="M526 96 C478 143 451 186 448 238 C445 295 416 334 372 373" />
        <path className="tpv-street" d="M112 229 C184 223 244 233 310 252 C375 270 473 263 598 239" />
        <g className="tpv-crossing" transform="translate(454 251) rotate(-10)">
          <path d="M-20 -10 V10 M-10 -10 V10 M0 -10 V10 M10 -10 V10 M20 -10 V10" />
        </g>
        <g className="tpv-map-hatch" aria-hidden="true">
          <path d="M165 128 l28 -12 M190 137 l39 -16 M219 146 l31 -13" />
          <path d="M157 287 l31 -13 M181 300 l41 -17 M158 319 l38 -16" />
          <path d="M294 126 q35 -22 78 -10 M290 151 q43 -23 90 -10" />
          <path d="M455 139 l36 -13 M485 151 l44 -16 M518 162 l31 -11" />
        </g>
      </motion.g>

      <g className="tpv-map-ink">
        <motion.path
          d="M119 78 Q124 65 140 66 L595 88 Q610 89 608 105 L586 368 Q584 384 568 383 L123 361 Q107 360 109 343 Z"
          variants={VIGNETTE_DRAW}
        />
        <motion.path d="M158 112 L260 117 L246 176 L145 171 Z" variants={VIGNETTE_DRAW} />
        <motion.path d="M424 121 L566 128 L557 188 L415 181 Z" variants={VIGNETTE_DRAW} />
        <motion.path d="M151 267 L238 271 L231 333 L144 329 Z" variants={VIGNETTE_DRAW} />
        <motion.path d="M445 273 L558 279 L551 342 L438 336 Z" variants={VIGNETTE_DRAW} />
        <motion.path d="M283 102 Q342 86 404 111 L393 180 Q336 199 276 169 Z" variants={VIGNETTE_DRAW} />
      </g>

      <motion.g className="tpv-map-symbols" variants={VIGNETTE_FADE}>
        <g className="tpv-tree" transform="translate(340 139)">
          <path d="M-3 12 H3 V28 H-3 Z" />
          <circle cx="0" cy="0" r="14" />
          <circle cx="-10" cy="8" r="10" />
          <circle cx="10" cy="8" r="10" />
        </g>
        <g className="tpv-bench" transform="translate(193 306)">
          <rect x="-20" y="-7" width="40" height="7" rx="2" />
          <path d="M-15 0 V12 M15 0 V12" />
        </g>
        <g className="tpv-water" transform="translate(501 308)">
          <path d="M0 -17 C9 -7 13 -1 13 7 A13 13 0 0 1 -13 7 C-13 -1 -9 -7 0 -17 Z" />
          <path d="M-5 8 Q0 13 6 7" />
        </g>
      </motion.g>

      <motion.g className="tpv-markers" variants={VIGNETTE_FADE} aria-hidden="true">
        {MAP_MARKERS.map((marker, index) => (
          <MapMarker key={`${marker.x}-${marker.y}`} {...marker} index={index} />
        ))}
      </motion.g>

      <motion.g className="tpv-hand tpv-hand--observe" variants={HAND_FROM_LEFT}>
        <path className="tpv-sleeve" d="M0 218 C45 215 80 216 116 221 L127 270 C80 267 41 268 0 275 Z" />
        <path className="tpv-cuff" d="M108 219 L137 214 L149 263 L125 271 Z" />
        <path className="tpv-skin" d="M136 214 C176 210 208 207 239 208 C255 208 270 213 277 220 C279 225 275 230 268 230 L231 225 L264 237 C271 240 272 246 268 250 C264 254 258 253 252 251 L224 239 L248 253 C254 257 254 263 249 266 C244 269 238 266 232 263 L212 250 C219 258 219 264 214 267 C208 270 202 264 194 255 L176 235 L149 263 Z" />
        <path className="tpv-point-finger" d="M231 225 L312 233 C321 234 326 230 325 225 C324 219 318 216 309 215 L239 208" />
        <g className="tpv-hand-ink">
          <motion.path d="M0 218 C45 215 80 216 116 221 L127 270 C80 267 41 268 0 275" variants={VIGNETTE_DRAW} />
          <motion.path d="M136 214 C176 210 208 207 239 208 C255 208 270 213 277 220 C279 225 275 230 268 230 L231 225 L312 233 C321 234 326 230 325 225 C324 219 318 216 309 215 L239 208" variants={VIGNETTE_DRAW} />
          <motion.path d="M231 225 L264 237 C271 240 272 246 268 250 C264 254 258 253 252 251 L224 239 L248 253 C254 257 254 263 249 266 C244 269 238 266 232 263 L212 250 C219 258 219 264 214 267 C208 270 202 264 194 255 L176 235 L149 263" variants={VIGNETTE_DRAW} />
          <motion.path className="tpv-hand-detail" d="M178 219 Q193 225 202 237 M195 216 Q210 221 220 231 M215 213 Q228 217 239 225" variants={VIGNETTE_DRAW} />
        </g>
      </motion.g>

      <motion.g className="tpv-hand tpv-hand--place" variants={HAND_FROM_RIGHT}>
        <path className="tpv-sleeve-alt" d="M720 42 C680 59 649 77 620 98 L640 142 C669 124 694 114 720 105 Z" />
        <path className="tpv-cuff-alt" d="M620 97 L641 89 L660 129 L640 143 Z" />
        <path className="tpv-skin-alt" d="M620 100 C592 113 571 127 551 146 C539 158 529 172 521 188 L534 199 C547 184 559 174 575 165 C566 180 562 193 564 204 C568 208 574 207 578 201 L591 177 C591 192 595 201 602 202 C607 199 608 194 606 187 L603 166 C608 178 614 184 620 181 C624 177 623 172 619 166 L607 146 L641 128 Z" />
        <path className="tpv-pin-held" d="M526 187 C518 177 505 174 495 181 C484 188 481 202 487 213 C491 220 499 226 510 234 C521 222 529 213 532 204 C534 198 532 192 526 187 Z" />
        <circle className="tpv-pin-held-dot" cx="507" cy="198" r="5" />
        <g className="tpv-hand-ink">
          <motion.path d="M720 42 C680 59 649 77 620 98 L641 128 C669 112 695 97 720 87" variants={VIGNETTE_DRAW} />
          <motion.path d="M620 100 C592 113 571 127 551 146 C539 158 529 172 521 188 L534 199 C547 184 559 174 575 165 C566 180 562 193 564 204 C568 208 574 207 578 201 L591 177 C591 192 595 201 602 202 C607 199 608 194 606 187 L603 166 C608 178 614 184 620 181 C624 177 623 172 619 166 L607 146 L641 128" variants={VIGNETTE_DRAW} />
          <motion.path className="tpv-hand-detail" d="M565 148 Q577 153 591 158 M584 137 Q597 143 607 151 M542 173 Q550 181 558 185" variants={VIGNETTE_DRAW} />
        </g>
      </motion.g>

      <motion.g className="tpv-note" variants={HAND_FROM_BOTTOM}>
        <path className="tpv-note-shadow" d="M334 296 L430 303 L423 376 L329 369 Z" />
        <path className="tpv-note-paper" d="M329 290 L425 297 L418 370 L324 363 Z" />
        <path className="tpv-note-fold" d="M397 368 L419 348 L418 370 Z" />
        <motion.path className="tpv-note-line" d="M344 315 L399 319 M341 330 L386 334 M339 345 L374 348" variants={VIGNETTE_DRAW} />
      </motion.g>

      <motion.g className="tpv-hand tpv-hand--propose" variants={HAND_FROM_BOTTOM}>
        <path className="tpv-sleeve-bottom" d="M389 470 C388 437 391 410 399 389 L443 395 C441 421 445 445 454 470 Z" />
        <path className="tpv-cuff-bottom" d="M399 389 L409 369 L445 380 L443 396 Z" />
        <path className="tpv-skin" d="M409 369 C406 351 410 335 421 323 L436 314 C444 312 449 317 446 323 L434 332 C447 324 455 327 455 333 C455 337 450 341 442 346 C451 341 459 344 458 350 C457 355 448 359 438 364 C446 362 452 366 450 372 C448 378 439 381 429 382 L409 377 Z" />
        <path className="tpv-pencil" d="M416 351 L468 285 L477 292 L427 360 Z" />
        <path className="tpv-pencil-band" d="M463 291 L468 285 L477 292 L472 298 Z" />
        <path className="tpv-pencil-tip" d="M468 285 L482 275 L477 292 Z" />
        <g className="tpv-hand-ink">
          <motion.path d="M389 470 C388 437 391 410 399 389 L443 395 C441 421 445 445 454 470" variants={VIGNETTE_DRAW} />
          <motion.path d="M409 369 C406 351 410 335 421 323 L436 314 C444 312 449 317 446 323 L434 332 C447 324 455 327 455 333 C455 337 450 341 442 346 C451 341 459 344 458 350 C457 355 448 359 438 364 C446 362 452 366 450 372 C448 378 439 381 429 382 L409 377" variants={VIGNETTE_DRAW} />
          <motion.path d="M416 351 L468 285 L477 292 L427 360 Z" variants={VIGNETTE_DRAW} />
          <motion.path className="tpv-hand-detail" d="M421 333 Q430 339 438 346 M416 344 Q425 350 433 356" variants={VIGNETTE_DRAW} />
        </g>
      </motion.g>

    </motion.svg>
  );
}
