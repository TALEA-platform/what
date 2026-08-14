import { useState } from "react";
import { Header } from "./components/layout/Header";
import { Footer } from "./components/layout/Footer";
import { ScrollStem } from "./components/layout/ScrollStem";
import { Hero } from "./components/story/Hero";
import { SummerTrendSection } from "./components/story/SummerTrendSection";
import { HotspotIntro } from "./components/story/HotspotIntro";
import { HotspotMapScene } from "./components/story/HotspotMapScene";
import { PhysicalDriversSection } from "./components/story/PhysicalDriversSection";
import { ShadowFocusSection } from "./components/story/ShadowFocusSection";
import { VulnerabilitySection } from "./components/story/VulnerabilitySection";
import { ClimateReliefSection } from "./components/story/ClimateReliefSection";
import {
  TaleaPartnersSection,
  TaleaParticipationSection,
  TaleaProjectSection,
} from "./components/story/TaleaProjectSection";
import { ZonesMapScene } from "./components/story/ZonesMapScene";
import { ClosingSection } from "./components/story/ClosingSection";
import { GlossaryDrawer, GlossaryTrailProvider } from "./components/ui/GlossaryDrawer";
import { MethodDrawer } from "./components/ui/MethodDrawer";

function App() {
  const [glossaryId, setGlossaryId] = useState(null);
  const [methodOpen, setMethodOpen] = useState(false);
  const openMethod = () => setMethodOpen(true);

  return (
    <GlossaryTrailProvider>
      <ScrollStem />
      <Header onOpenMethod={openMethod} />
      <main className="page-main">
        <Hero />
        <SummerTrendSection />
        <HotspotIntro onGlossary={setGlossaryId} />
        <HotspotMapScene />
        <PhysicalDriversSection onGlossary={setGlossaryId} />
        <ShadowFocusSection />
        <VulnerabilitySection />
        <ClimateReliefSection onGlossary={setGlossaryId} />
        <TaleaProjectSection onGlossary={setGlossaryId} />
        <ZonesMapScene />
        <TaleaParticipationSection />
        <TaleaPartnersSection />
        <ClosingSection />
      </main>
      <Footer onOpenMethod={openMethod} />
      <GlossaryDrawer
        activeId={glossaryId}
        onSelect={setGlossaryId}
        onClose={() => setGlossaryId(null)}
      />
      <MethodDrawer open={methodOpen} onClose={() => setMethodOpen(false)} />
      <section id="spacer"></section>
    </GlossaryTrailProvider>
  )
}

export default App
