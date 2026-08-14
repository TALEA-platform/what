import { useCallback, useEffect, useRef } from "react";

export function useStoryReach() {
  const reachRef = useRef(0);

  useEffect(() => {
    const update = () => {
      const reach = window.scrollY + window.innerHeight * 0.5;
      if (reach > reachRef.current) reachRef.current = reach;
    };
    update();
    window.addEventListener("scroll", update, { passive: true });
    window.addEventListener("resize", update);
    return () => {
      window.removeEventListener("scroll", update);
      window.removeEventListener("resize", update);
    };
  }, []);

  return useCallback((selector) => {
    if (!selector) return true;
    const node = document.querySelector(selector);
    if (!node) return true;
    return node.getBoundingClientRect().top + window.scrollY < reachRef.current;
  }, []);
}
