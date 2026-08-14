import { useContent } from "../../content";
import { resolveTaleaLink, taleaFooterAssets } from "../../data/taleaProject";
import { assetUrl } from "../../lib/assetUrl";

const taleaLogoUrl = assetUrl("/assets/talea-logo.svg");
export function Footer({ onOpenMethod }) {
  const { content, locale, methodContent } = useContent();
  const footerContent = content.talea.footer;
  const footerLinks = footerContent.navigation.links.map((link) => ({
    ...link,
    href: resolveTaleaLink(link.linkId),
  }));

  return (
    <footer className="footer" lang={locale}>
      <div className="footer-inner">
        <div className="footer-top">
          <a
            className="footer-brand"
            href={resolveTaleaLink(footerContent.brand.linkId)}
            target="_blank"
            rel="noreferrer"
          >
            <img className="footer-logo" src={taleaLogoUrl} alt={footerContent.brand.alt} />
            <span className="footer-label">{footerContent.brand.label}</span>
          </a>

          <nav className="footer-nav" aria-label={footerContent.navigation.ariaLabel}>
            <ul className="footer-links">
              {footerLinks.map((link) => (
                <li key={link.id}>
                  <a className="footer-link" href={link.href} target="_blank" rel="noreferrer">
                    {link.label}
                  </a>
                </li>
              ))}
              <li>
                <button
                  className="footer-link footer-link--button"
                  type="button"
                  onClick={onOpenMethod}
                >
                  {methodContent.title}
                </button>
              </li>
            </ul>
          </nav>
        </div>

        <div className="footer-funding">
          <img
            className="footer-cofunded"
            src={taleaFooterAssets.fundingEmblem}
            alt={footerContent.funding.emblemAlt}
          />
          <div className="footer-funding-copy">
            <p className="footer-funding-text">{footerContent.funding.text}</p>
            <p className="footer-disclaimer">{footerContent.funding.disclaimer}</p>
          </div>
          <a
            className="footer-eui"
            href={resolveTaleaLink(footerContent.funding.linkId)}
            target="_blank"
            rel="noreferrer"
          >
            <img className="footer-eui-logo" src={taleaFooterAssets.euiLogo} alt={footerContent.funding.euiLabel} />
          </a>
        </div>
      </div>
    </footer>
  );
}
