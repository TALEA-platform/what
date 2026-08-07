import { heroBridge } from "../../data/heroCopy";
import { CopySegments } from "./CopySegments";

// Bridge content (original copy — decisione D8 = B: il testo non è stato
// riscritto). Rendered inside the Hero's sticky zoom as the
// .hero-bridge-preview that fades in as the hero zooms away; no longer a
// standalone <section> with its own background.
export function HeroBridgeSection() {
  return (
    <div className="hero-bridge-inner">
      <p className="hero-bridge-body">
        <CopySegments parts={heroBridge.body} kwClass="hero-kw" />
      </p>

      <div className="hero-bridge-callout">
        <p className="hero-bridge-callout-text">
          {heroBridge.calloutLead}
          <strong> {heroBridge.calloutPivot}</strong>
        </p>
      </div>
    </div>
  );
}
