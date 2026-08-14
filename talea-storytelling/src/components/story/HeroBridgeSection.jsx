import { useContent } from "../../content";
import { CopySegments } from "./CopySegments";

export function HeroBridgeSection() {
  const { content } = useContent();
  const { heroBridge } = content;

  return (
    <div className="hero-bridge-inner">
      <p className="hero-bridge-body">
        <CopySegments parts={heroBridge.body} kwClass="hero-kw" />
      </p>

      <div className="hero-bridge-callout">
        <p className="hero-bridge-callout-text">
          {heroBridge.callout.lead}
          <strong> {heroBridge.callout.pivot}</strong>
        </p>
      </div>
    </div>
  );
}
