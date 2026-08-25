
import { assetUrl } from "../lib/assetUrl";
import { editorialLinks, siteConfig } from "../content";

const TALEA_LINK_TARGETS = {
  "talea-platform": siteConfig.platformUrl,
  "talea-about": `${siteConfig.platformUrl}#about`,
  "talea-atlas": `${siteConfig.platformUrl}#gallery`,
  "history-suhi": editorialLinks.talea.historySuhi,
  "shadow-focus-data": editorialLinks.shadowFocus.data,
  "craf-map": editorialLinks.climateRelief.crafMap,
  "european-urban-initiative": editorialLinks.talea.europeanUrbanInitiative,
};

export function resolveTaleaLink(linkId) {
  const target = TALEA_LINK_TARGETS[linkId];
  if (!target) throw new Error(`Unknown TALEA link ID: ${linkId}`);
  return target;
}

export const taleaPartnerSpecs = [
  { id: "comune-bologna", href: "https://www.comune.bologna.it/", logo: assetUrl("/assets/partners/team-1.jpg"), lead: true },
  { id: "universita-bologna", href: "https://www.unibo.it/it", logo: assetUrl("/assets/partners/team-2.jpg") },
  { id: "fondazione-iu", href: "https://fondazioneiu.it/", logo: assetUrl("/assets/partners/team-3.jpg") },
  { id: "fondazione-bruno-kessler", href: "https://www.fbk.eu/it/", logo: assetUrl("/assets/partners/team-5.jpg") },
  { id: "cineca", href: "https://www.cineca.it/", logo: assetUrl("/assets/partners/team-4.jpg") },
  { id: "r2m-solutions", href: "https://www.r2msolution.com/", logo: assetUrl("/assets/partners/team-6.jpg") },
  { id: "r3gis", href: "https://www.r3gis.com/it/", logo: assetUrl("/assets/partners/team-7.jpg") },
  { id: "cluj-napoca", href: "https://primariaclujnapoca.ro/", logo: assetUrl("/assets/partners/team-8.jpg") },
  { id: "marseille", href: "https://www.marseille.fr/", logo: assetUrl("/assets/partners/team-9.jpg") },
  { id: "riga", href: "https://www.riga.lv/en", logo: assetUrl("/assets/partners/team-10.jpg") },
];

export const taleaOtherPartnerCount = taleaPartnerSpecs.length - 2;

// Derived from the PROPOSTE folders in the two project KML files. Existing
// furnishings, perceptions and reports are intentionally excluded.
export const taleaParticipationData = {
  categories: [
    { id: "greenComfort" },
    { id: "servicesAmenities" },
    { id: "accessibilityRoutes" },
  ],
  areas: [
    {
      id: "historicCentreNorth",
      categoryCounts: {
        greenComfort: 20,
        servicesAmenities: 13,
        accessibilityRoutes: 1,
      },
    },
    {
      id: "fossolo",
      categoryCounts: {
        greenComfort: 15,
        servicesAmenities: 34,
        accessibilityRoutes: 12,
      },
    },
  ],
};

export const zonesMap = {
  intro: {
    bounds: [
      [11.3345, 44.4855],
      [11.3908, 44.5086],
    ],
  },
  zones: [
    {
      id: 0,
      center: [11.3838, 44.4906],
      zoom: 15.15,
      radius_m: 470,
    },
    {
      id: 1,
      center: [11.341, 44.5038],
      zoom: 15.25,
      radius_m: 420,
    },
  ],
};

export const taleaSourceSpecs = [
  { id: "portale", icon: "hub", feature: true },
  { id: "historysuhi", icon: "history" },
  { id: "sci", icon: "shadow" },
  { id: "craf", icon: "refuge" },
];

export const taleaFooterAssets = {
  fundingEmblem: assetUrl("/assets/eu/cofunded-eu.svg"),
  euiLogo: assetUrl("/assets/eu/eui.svg"),
};
