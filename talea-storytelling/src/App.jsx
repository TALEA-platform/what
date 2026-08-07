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
    // Il provider tiene la scia del glossario: quali parole il lettore ha già
    // incontrato scorrendo e quali ha già aperto. Serve al pannello, che le
    // rimette in elenco, quindi deve stare sopra sia alla storia sia al
    // pannello stesso.
    <GlossaryTrailProvider>
      <ScrollStem />
      <Header onOpenMethod={openMethod} />
      <main className="page-main">
        <Hero />
        <SummerTrendSection />
        <HotspotIntro onGlossary={setGlossaryId} />
        <HotspotMapScene />
        {/* Section 2 (causes) starts here and contains the shadow sub-chapter. */}
        <PhysicalDriversSection onGlossary={setGlossaryId} />
        <ShadowFocusSection />
        <VulnerabilitySection />
        {/* Closing chapter: rifugi climatici → NBS → corridoi → portici, as one
            continuous flowing section (spec beats 7–10). */}
        <ClimateReliefSection onGlossary={setGlossaryId} />
        {/* Closing arc: from the story's diagnosis to Bologna's real work.
            L'ordine risponde alle domande del lettore nell'ordine in cui se le
            fa: che cos'è questo progetto → dove agisce → come ci si entra →
            chi lo firma. La partecipazione stava prima della mappa, cioè fra
            la promessa e la sua verifica; ora la segue. */}
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
