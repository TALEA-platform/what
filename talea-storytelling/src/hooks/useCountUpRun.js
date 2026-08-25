import { useEffect, useState } from "react";

export function prefersReducedMotion() {
  return (
    typeof window !== "undefined" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

export function useCountUpRun(elementRef) {
  const [run, setRun] = useState(prefersReducedMotion);

  useEffect(() => {
    const element = elementRef.current;
    if (!element || run) return undefined;
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          observer.unobserve(entry.target);
          setRun(true);
        });
      },
      { threshold: 0, rootMargin: "0px 0px -22% 0px" },
    );
    observer.observe(element);
    return () => observer.disconnect();
  }, [elementRef, run]);

  return run;
}
