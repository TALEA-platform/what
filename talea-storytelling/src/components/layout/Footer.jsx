import { footerContent } from "../../data/taleaProject";
import { assetUrl } from "../../lib/assetUrl";

const taleaLogoUrl = assetUrl("/assets/talea-logo.svg");

/**
 * Il footer, con le stesse informazioni di quello della piattaforma TALEA.
 *
 * Erano tre cose in fila: il marchio, due link e una riga di licenza. Mancava
 * tutto quello che il footer del progetto dice e che un progetto europeo è
 * tenuto a dire: il titolo per esteso con il suo codice (`EUI102-064`), chi lo
 * cofinanzia e con che programma, chi sono i partner e le città di replica, e
 * il disclaimer che scarica l'Unione Europea dalle opinioni di chi scrive.
 *
 * Due righe e basta, perché un footer alto mezza schermata è una seconda
 * sezione, non un piede di pagina: sopra il marchio e i link, sotto la
 * dichiarazione fra i due marchi che le competono. I due marchi sono i file
 * ufficiali della piattaforma (`/assets/eu/`), non ridisegnati: «Co-funded by
 * the European Union» e il logo della European Urban Initiative si usano nella
 * forma in cui il programma li distribuisce.
 */
export function Footer({ onOpenMethod }) {
  return (
    <footer className="footer">
      <div className="footer-inner">
        <div className="footer-top">
          <a
            className="footer-brand"
            href={footerContent.brand.href}
            target="_blank"
            rel="noreferrer"
          >
            <img className="footer-logo" src={taleaLogoUrl} alt={footerContent.brand.alt} />
            <span className="footer-label">{footerContent.brand.label}</span>
          </a>

          <nav className="footer-nav" aria-label={footerContent.linksLabel}>
            <ul className="footer-links">
              {footerContent.links.map((link) => (
                <li key={link.href}>
                  <a className="footer-link" href={link.href} target="_blank" rel="noreferrer">
                    {link.label}
                  </a>
                </li>
              ))}
              {/* «Metodo e fonti» apre un pannello di questa webapp, non una
                  pagina: resta un bottone, in fondo alla fila dove il lettore
                  cerca comunque i link di servizio. */}
              <li>
                <button
                  className="footer-link footer-link--button"
                  type="button"
                  onClick={onOpenMethod}
                >
                  {footerContent.methodLabel}
                </button>
              </li>
            </ul>
          </nav>
        </div>

        <div className="footer-funding">
          <img
            className="footer-cofunded"
            src={footerContent.funding.emblem}
            alt={footerContent.funding.emblemLabel}
          />
          <div className="footer-funding-copy">
            <p className="footer-funding-text">{footerContent.funding.text}</p>
            <p className="footer-disclaimer">{footerContent.funding.disclaimer}</p>
          </div>
          <a
            className="footer-eui"
            href={footerContent.eui.href}
            target="_blank"
            rel="noreferrer"
          >
            <img className="footer-eui-logo" src={footerContent.eui.logo} alt={footerContent.eui.label} />
          </a>
        </div>
      </div>
    </footer>
  );
}
