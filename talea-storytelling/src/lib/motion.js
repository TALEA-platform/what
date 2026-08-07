/**
 * Il tempo delle camere.
 *
 * Prima ogni scena sceglieva il suo: 1300, 1600, 1800, 2200 ms. Da vicino non
 * si nota; una dietro l'altra, sì — è una delle ragioni per cui la pagina
 * sembrava un'antologia di scene invece che un film. Un solo tempo, una sola
 * easing, e le mappe si muovono tutte con la stessa mano.
 *
 * Gemello JS di --dur-camera / --ease-cine in theme.css: se cambia uno,
 * cambiano entrambi.
 */
export const CAMERA_MS = 2000;

/**
 * Breve protezione all'ingresso delle scene auto-riprodotte.
 *
 * Lo scroll resta sempre nativo, ma per questo intervallo non può accelerare la
 * timeline o saltare tappe. Copre l'inerzia residua di rotella/trackpad con cui
 * si arriva nella scena, senza ritardare un gesto deliberato fatto poco dopo.
 */
export const SCROLL_ACCELERATION_GRACE_MS = 1400;

/** Decelerazione cubica: parte decisa, si posa. */
export const cameraEasing = (t) => 1 - Math.pow(1 - t, 3);
