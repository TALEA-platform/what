import { useCallback, useEffect, useRef, useState } from "react";

const now = () =>
  typeof performance !== "undefined" ? performance.now() : Date.now();

export function useTimedSequence({
  count,
  engaged,
  startDelay = 1500,
  readMs = 5200,
  tailMs = 700,
  pickDuringPlay = false,
  playbackRate = 1,
}) {
  const [revealed, setRevealed] = useState(0);
  const [complete, setComplete] = useState(false);
  const [selected, setSelected] = useState(null);
  const completeRef = useRef(false);
  const timersRef = useRef([]);
  // Virtual elapsed time survives scene and background-tab pauses; timers do not.
  const playedRef = useRef(0);
  const rate =
    Number.isFinite(playbackRate) && playbackRate > 0 ? playbackRate : 1;

  const activeIndex = selected != null ? selected : Math.max(0, revealed - 1);

  const advanceTo = useCallback(
    (index) => {
      if (completeRef.current) return;
      const next = Math.min(count, index + 1);
      if (next <= 0) return;
      setRevealed((current) => (next > current ? next : current));
    },
    [count],
  );

  const forceComplete = useCallback(() => {
    if (completeRef.current) return;
    completeRef.current = true;
    // Stale callbacks must not reduce `revealed` after a forced completion.
    timersRef.current.forEach(clearTimeout);
    timersRef.current = [];
    setRevealed(count);
    setComplete(true);
  }, [count]);

  useEffect(() => {
    if (!engaged || completeRef.current) return undefined;

    const readAt = (index) =>
      Array.isArray(readMs) ? readMs[index] ?? readMs[readMs.length - 1] : readMs;

    const entries = [];
    let at = startDelay;
    for (let i = 0; i < count; i += 1) {
      entries.push(at);
      at += readAt(i);
    }
    const endAt = entries[count - 1] + tailMs;

    const caught = entries.filter((time) => time <= playedRef.current).length;
    if (caught > 0) setRevealed((current) => Math.max(current, caught));
    if (endAt <= playedRef.current) {
      completeRef.current = true;
      setComplete(true);
      return undefined;
    }

    let startedAt = null;

    const play = () => {
      if (startedAt != null) return;
      startedAt = now();
      const played = playedRef.current;
      const timers = [];
      entries.forEach((time, i) => {
        if (time <= played) return;
        timers.push(
          setTimeout(
            () => setRevealed((current) => Math.max(current, i + 1)),
            (time - played) / rate,
          ),
        );
      });
      timers.push(
        setTimeout(() => {
          completeRef.current = true;
          setComplete(true);
        }, (endAt - played) / rate),
      );
      timersRef.current = timers;
    };

    const halt = () => {
      if (startedAt == null) return;
      playedRef.current += (now() - startedAt) * rate;
      startedAt = null;
      timersRef.current.forEach(clearTimeout);
      timersRef.current = [];
    };

    const onVisibility = () => {
      if (document.hidden) halt();
      else play();
    };

    if (!document.hidden) play();
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      halt();
    };
  }, [engaged, count, startDelay, readMs, tailMs, rate]);

  useEffect(() => () => timersRef.current.forEach(clearTimeout), []);

  const canPick = useCallback(
    () => completeRef.current || pickDuringPlay || revealed >= count,
    [pickDuringPlay, revealed, count],
  );

  const goTo = useCallback(
    (index) => {
      if (!canPick()) return;
      setSelected(Math.max(0, Math.min(count - 1, index)));
    },
    [count, canPick],
  );

  const goPrev = useCallback(() => {
    if (!canPick()) return;
    setSelected((current) => Math.max(0, (current == null ? count - 1 : current) - 1));
  }, [count, canPick]);

  const goNext = useCallback(() => {
    if (!canPick()) return;
    setSelected((current) => Math.min(count - 1, (current == null ? count - 1 : current) + 1));
  }, [count, canPick]);

  return {
    revealed,
    complete,
    completeRef,
    activeIndex,
    selected,
    advanceTo,
    forceComplete,
    goTo,
    goPrev,
    goNext,
  };
}
