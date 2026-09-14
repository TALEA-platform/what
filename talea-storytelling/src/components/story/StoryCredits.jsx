import { useState } from "react";
import { useContent } from "../../content";
import { resolveTaleaLink } from "../../data/taleaProject";
import { assetUrl } from "../../lib/assetUrl";

const githubIconUrl = assetUrl("/assets/icons/github.svg");

export function StoryCredits() {
  const { content, locale } = useContent();
  const credits = content.talea.credits;
  const [open, setOpen] = useState(false);
  const panelId = `${credits.id}-panel`;

  return (
    <aside className="story-credits" lang={locale} aria-label={credits.title}>
      <div className="story-credits-inner">
        <div className="story-credits-bar">
          <span className="story-credits-title story-credits-title--long">
            {credits.title}
          </span>
          <span className="story-credits-title story-credits-title--short">
            {credits.shortTitle}
          </span>

          <a
            className="story-credits-site-link"
            href={resolveTaleaLink(credits.linkId)}
            target="_blank"
            rel="noreferrer"
          >
            <span className="story-credits-group story-credits-group--long">
              {credits.group}
            </span>
            <span className="story-credits-group story-credits-group--short">
              {credits.shortGroup}
            </span>
            <span className="story-credits-external" aria-hidden="true">↗</span>
          </a>

          <span className="story-credits-separator" aria-hidden="true">·</span>

          <button
            className="story-credits-trigger"
            type="button"
            aria-expanded={open}
            aria-controls={panelId}
            onClick={() => setOpen((current) => !current)}
          >
            <span className="story-credits-action">
              {open ? credits.closeLabel : credits.openLabel}
            </span>
            <span
              className={`story-credits-chevron${open ? " is-open" : ""}`}
              aria-hidden="true"
            />
          </button>
        </div>

        <div className="story-credits-panel" id={panelId} hidden={!open}>
          <ul className="story-credits-list">
            {credits.people.map((person) => (
              <li className="story-credit-person" key={person.id}>
                <span className="story-credit-name-row">
                  <span className="story-credit-name">{person.name}</span>
                  {person.github ? (
                    <a
                      className="story-credit-github"
                      href={person.github}
                      target="_blank"
                      rel="noreferrer"
                      aria-label={`GitHub: ${person.name}`}
                      title={`GitHub: ${person.name}`}
                    >
                      <img
                        className="story-credit-github-icon"
                        src={githubIconUrl}
                        alt=""
                      />
                    </a>
                  ) : null}
                </span>
                <span className="story-credit-description">{person.description}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </aside>
  );
}
