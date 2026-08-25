import { motion } from "framer-motion";

const VIGNETTE_EASE = [0.22, 1, 0.36, 1];

const VIGNETTE_SEQUENCE = {
  hidden: {},
  show: {
    transition: {
      staggerChildren: 0.085,
      delayChildren: 0.04,
    },
  },
};

const VIGNETTE_FADE = {
  hidden: { opacity: 0, y: 8 },
  show: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.6, ease: VIGNETTE_EASE },
  },
};

const VIGNETTE_DRAW = {
  hidden: { opacity: 0, pathLength: 0 },
  show: {
    opacity: 1,
    pathLength: 1,
    transition: { duration: 0.68, ease: VIGNETTE_EASE },
  },
};

const HAND_FROM_LEFT = {
  hidden: { opacity: 0, x: -18, y: 5 },
  show: {
    opacity: 1,
    x: 0,
    y: 0,
    transition: { duration: 0.58, ease: VIGNETTE_EASE },
  },
};

const HAND_FROM_RIGHT = {
  hidden: { opacity: 0, x: 18, y: -5 },
  show: {
    opacity: 1,
    x: 0,
    y: 0,
    transition: { duration: 0.58, ease: VIGNETTE_EASE },
  },
};

const HAND_FROM_BOTTOM = {
  hidden: { opacity: 0, y: 18 },
  show: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.58, ease: VIGNETTE_EASE },
  },
};

const MARKER_REVEAL = {
  hidden: { opacity: 0, y: -5 },
  show: (index) => ({
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.36,
      delay: 0.16 + index * 0.06,
      ease: VIGNETTE_EASE,
    },
  }),
};

const PASSIVE_MARKERS = [
  { x: 390, y: 128, tone: "sage" },
  { x: 468, y: 144, tone: "green" },
  { x: 453, y: 192, tone: "green" },
  { x: 340, y: 224, tone: "sage" },
  { x: 282, y: 258, tone: "sage" },
  { x: 176, y: 266, tone: "green" },
  { x: 416, y: 286, tone: "green" },
];

function MapMarker({ x, y, tone = "green", index = 0 }) {
  return (
    <g transform={`translate(${x} ${y})`}>
      <motion.g
        className={`tpv-marker tpv-marker--${tone}`}
        custom={index}
        variants={MARKER_REVEAL}
      >
        <path d="M0 11 C-10 1 -13 -5 -13 -12 A13 13 0 1 1 13 -12 C13 -5 10 1 0 11 Z" />
        <circle cx="0" cy="-12" r="4" />
      </motion.g>
    </g>
  );
}

export function TaleaParticipationVignette({ ariaLabel, description, reduceMotion }) {
  return (
    <motion.svg
      className="talea-participation-vignette-svg"
      viewBox="0 0 640 400"
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
      </defs>

      <motion.ellipse
        className="tpv-wash"
        cx="322"
        cy="205"
        rx="282"
        ry="168"
        variants={VIGNETTE_FADE}
      />

      <motion.g className="tpv-map-base" variants={VIGNETTE_FADE}>
        <path
          className="tpv-paper-shadow"
          d="M111 65 Q115 55 128 57 L529 79 Q541 80 539 95 L516 333 Q514 346 500 345 L123 324 Q109 323 110 310 Z"
        />
        <path
          className="tpv-paper"
          d="M104 58 Q108 48 121 50 L522 72 Q534 73 532 88 L509 326 Q507 339 493 338 L116 317 Q102 316 103 303 Z"
        />
        <path
          className="tpv-paper-texture"
          d="M104 58 Q108 48 121 50 L522 72 Q534 73 532 88 L509 326 Q507 339 493 338 L116 317 Q102 316 103 303 Z"
        />
        <path className="tpv-fold" d="M492 338 L509 321 L507 326 Q506 338 493 338 Z" />
        <path className="tpv-block" d="M152 93 L238 98 L226 150 L142 145 Z" />
        <path className="tpv-block" d="M424 106 L492 110 L485 166 L418 162 Z" />
        <path className="tpv-block" d="M145 236 L213 240 L207 293 L139 288 Z" />
        <path className="tpv-park" d="M286 88 Q338 76 382 99 L372 166 Q326 178 280 152 Z" />
        <path className="tpv-route" d="M178 196 C250 180 303 204 360 190 C410 178 447 191 479 212" />
        <path className="tpv-street" d="M170 78 C217 112 241 167 242 219 C244 256 274 287 326 317" />
        <path className="tpv-street" d="M472 88 C435 133 413 170 410 225 C408 259 380 294 335 317" />
        <path className="tpv-street" d="M118 212 C184 209 235 219 290 236 C351 255 425 246 508 229" />
        <g className="tpv-crossing" transform="translate(407 225) rotate(-8)">
          <path d="M-19 -10 V10 M-9 -10 V10 M1 -10 V10 M11 -10 V10" />
        </g>
        <g className="tpv-map-hatch" aria-hidden="true">
          <path d="M154 105 l22 -10 M177 111 l30 -13 M201 117 l29 -12" />
          <path d="M151 251 l25 -11 M173 263 l31 -13 M154 282 l34 -14" />
          <path d="M297 112 q26 -17 59 -9 M294 134 q32 -18 68 -8" />
        </g>
      </motion.g>

      <g className="tpv-map-ink">
        <motion.path
          d="M104 58 Q108 48 121 50 L522 72 Q534 73 532 88 L509 326 Q507 339 493 338 L116 317 Q102 316 103 303 Z"
          variants={VIGNETTE_DRAW}
        />
        <motion.path d="M152 93 L238 98 L226 150 L142 145 Z" variants={VIGNETTE_DRAW} />
        <motion.path d="M424 106 L492 110 L485 166 L418 162 Z" variants={VIGNETTE_DRAW} />
        <motion.path d="M145 236 L213 240 L207 293 L139 288 Z" variants={VIGNETTE_DRAW} />
        <motion.path d="M286 88 Q338 76 382 99 L372 166 Q326 178 280 152 Z" variants={VIGNETTE_DRAW} />
      </g>

      <motion.g className="tpv-proposal-symbols" variants={VIGNETTE_FADE}>
        <circle className="tpv-symbol-plate" cx="331" cy="126" r="28" />
        <g className="tpv-tree" transform="translate(331 122)">
          <path d="M-3 13 H3 V29 H-3 Z" />
          <circle cx="0" cy="0" r="15" />
          <circle cx="-11" cy="9" r="11" />
          <circle cx="11" cy="9" r="11" />
        </g>

        <circle className="tpv-symbol-plate" cx="245" cy="272" r="27" />
        <g className="tpv-bench" transform="translate(245 273)">
          <rect x="-23" y="-7" width="46" height="7" rx="2" />
          <path d="M-18 0 V13 M18 0 V13" />
        </g>

        <circle className="tpv-symbol-plate" cx="464" cy="272" r="27" />
        <g className="tpv-water" transform="translate(464 272)">
          <path d="M0 -18 C9 -7 14 -1 14 7 A14 14 0 0 1 -14 7 C-14 -1 -9 -7 0 -18 Z" />
          <path d="M-5 8 Q0 13 6 7" />
        </g>
      </motion.g>

      <motion.g className="tpv-passive-markers" variants={VIGNETTE_FADE} aria-hidden="true">
        {PASSIVE_MARKERS.map((marker, index) => (
          <MapMarker key={`${marker.x}-${marker.y}`} {...marker} index={index} />
        ))}
      </motion.g>

      <motion.g className="tpv-hand tpv-hand--observe" variants={HAND_FROM_LEFT}>
        <path className="tpv-skin" d="M0 238 C62 222 112 213 163 199 L191 198 L199 211 L174 222 C118 237 72 257 0 276 Z" />
        <path className="tpv-sleeve" d="M0 231 C48 223 76 222 109 216 L126 252 C81 264 44 277 0 288 Z" />
        <path className="tpv-skin" d="M160 199 L230 181 L238 187 L231 195 L174 222 Z" />
        <g className="tpv-hand-ink">
          <motion.path d="M0 238 C62 222 112 213 163 199 L191 198 L199 211 L174 222 C118 237 72 257 0 276" variants={VIGNETTE_DRAW} />
          <motion.path d="M160 199 L230 181 L238 187 L231 195 L174 222" variants={VIGNETTE_DRAW} />
          <motion.path className="tpv-hand-detail" d="M174 205 Q187 207 198 211 M181 201 Q194 202 205 206" variants={VIGNETTE_DRAW} />
        </g>
      </motion.g>

      <motion.g className="tpv-hand tpv-hand--place" variants={HAND_FROM_RIGHT}>
        <path className="tpv-skin-alt" d="M640 102 C588 116 548 132 506 151 L486 171 L474 164 L489 139 C531 113 575 89 640 68 Z" />
        <path className="tpv-sleeve-alt" d="M640 62 C596 80 561 98 531 116 L549 151 C584 133 612 121 640 111 Z" />
        <path className="tpv-skin-alt" d="M486 171 L456 201 L447 195 L446 187 L474 164 Z" />
        <g className="tpv-hand-ink">
          <motion.path d="M640 102 C588 116 548 132 506 151 L486 171 L474 164 L489 139 C531 113 575 89 640 68" variants={VIGNETTE_DRAW} />
          <motion.path d="M486 171 L456 201 L447 195 L446 187 L474 164" variants={VIGNETTE_DRAW} />
          <motion.path className="tpv-hand-detail" d="M477 170 Q469 180 461 187 M484 176 Q477 187 468 194" variants={VIGNETTE_DRAW} />
        </g>
      </motion.g>

      <motion.g className="tpv-hand tpv-hand--propose" variants={HAND_FROM_BOTTOM}>
        <path className="tpv-skin" d="M296 400 C297 361 302 333 312 304 L328 285 L342 293 L337 318 C335 346 338 371 346 400 Z" />
        <path className="tpv-sleeve" d="M282 400 C284 360 289 339 297 320 L338 329 C338 352 344 376 356 400 Z" />
        <path className="tpv-skin" d="M312 304 L332 276 L343 282 L342 293 Z" />
        <path className="tpv-pencil" d="M329 289 L370 232 L378 238 L339 299 Z" />
        <path className="tpv-pencil-band" d="M366 238 L370 232 L378 238 L374 244 Z" />
        <path className="tpv-pencil-tip" d="M370 232 L383 222 L378 238 Z" />
        <g className="tpv-hand-ink">
          <motion.path d="M296 400 C297 361 302 333 312 304 L328 285 L342 293 L337 318 C335 346 338 371 346 400" variants={VIGNETTE_DRAW} />
          <motion.path d="M312 304 L332 276 L343 282 L342 293" variants={VIGNETTE_DRAW} />
          <motion.path d="M329 289 L370 232 L378 238 L339 299 Z" variants={VIGNETTE_DRAW} />
          <motion.path className="tpv-hand-detail" d="M320 300 Q330 306 338 309 M316 307 Q326 313 336 316" variants={VIGNETTE_DRAW} />
        </g>
      </motion.g>
    </motion.svg>
  );
}
