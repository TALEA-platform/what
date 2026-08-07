import { useCallback, useEffect, useRef, useState } from "react";
import {
  geocodeSuggestions,
  loadRifugiData,
  loadRifugiUfficiali,
  suggestRifugi,
  suggestUfficiali,
} from "../../data/reliefMaps";

/**
 * Search field with lightweight suggestions, used by the climate-refuge map.
 * Three sources, one list, in the order that answers fastest:
 *  - the Comune's recognised refuges: instant, local, offered first;
 *  - the city's green spaces: instant, local;
 *  - addresses (via e civico): geocoded, debounced so we stay gentle with the
 *    geocoder while the citizen is still typing.
 * Keyboard: frecce per scorrere, Invio per scegliere, Esc per chiudere.
 * (Le aree statistiche del 3-30-300 sono uscite con quella sezione — `11`.)
 */
export function SearchSuggest({ placeholder, ariaLabel, onSubmit, onPick, autoId }) {
  const [value, setValue] = useState("");
  const [items, setItems] = useState([]);
  const [open, setOpen] = useState(false);
  const [hi, setHi] = useState(-1);
  const rootRef = useRef(null);
  const timerRef = useRef(null);
  const seqRef = useRef(0);

  // Make sure both tiers of refuge names are available for instant local matching.
  useEffect(() => {
    loadRifugiData().catch(() => {});
    loadRifugiUfficiali().catch(() => {});
  }, []);

  useEffect(
    () => () => {
      if (timerRef.current) window.clearTimeout(timerRef.current);
    },
    [],
  );

  const close = useCallback(() => {
    setOpen(false);
    setHi(-1);
  }, []);

  // Close on outside click/tap.
  useEffect(() => {
    const onDown = (e) => {
      if (rootRef.current && !rootRef.current.contains(e.target)) close();
    };
    document.addEventListener("pointerdown", onDown);
    return () => document.removeEventListener("pointerdown", onDown);
  }, [close]);

  const refreshSuggestions = useCallback((query) => {
    const seq = (seqRef.current += 1);
    // Instant local matches: the Comune's refuges first, then green spaces.
    const local = [...suggestUfficiali(query, 3), ...suggestRifugi(query, 2)];
    setItems(local);
    setOpen(local.length > 0);
    setHi(-1);
    if (timerRef.current) window.clearTimeout(timerRef.current);
    if (query.trim().length < 3) return;
    timerRef.current = window.setTimeout(async () => {
      try {
        // Real streets, squares, parks and civic addresses from OpenStreetMap.
        const remote = await geocodeSuggestions(query, 5);
        if (seq !== seqRef.current) return; // stale response, a newer query won
        const merged = [...local, ...remote].slice(0, 7);
        setItems(merged);
        setOpen(merged.length > 0);
      } catch {
        /* suggestions are best-effort */
      }
    }, 340);
  }, []);

  const handleChange = (e) => {
    const next = e.target.value;
    setValue(next);
    if (next.trim().length >= 2) refreshSuggestions(next);
    else {
      setItems([]);
      close();
    }
  };

  const pick = (item) => {
    setValue(item.label);
    close();
    onPick?.(item);
  };

  const handleKeyDown = (e) => {
    if (!open || !items.length) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHi((h) => (h + 1) % items.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHi((h) => (h <= 0 ? items.length - 1 : h - 1));
    } else if (e.key === "Enter" && hi >= 0) {
      e.preventDefault();
      pick(items[hi]);
    } else if (e.key === "Escape") {
      close();
    }
  };

  const listId = `${autoId || "relief-suggest"}-list`;

  return (
    <div ref={rootRef} className="relief-search-wrap">
      <form
        className="relief-map-search"
        onSubmit={(e) => {
          e.preventDefault();
          close();
          onSubmit?.(value);
        }}
      >
        <input
          type="search"
          role="combobox"
          aria-expanded={open}
          aria-controls={listId}
          aria-autocomplete="list"
          autoComplete="off"
          value={value}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          onFocus={() => items.length && setOpen(true)}
          placeholder={placeholder}
          aria-label={ariaLabel || placeholder}
        />
        <button type="submit">Cerca</button>
      </form>
      {open && items.length > 0 && (
        <ul id={listId} className="relief-suggest" role="listbox">
          {items.map((item, i) => (
            <li key={`${item.type}-${item.label}`} role="option" aria-selected={hi === i}>
              <button
                type="button"
                className={`relief-suggest-item${hi === i ? " relief-suggest-item--hi" : ""}`}
                onMouseEnter={() => setHi(i)}
                onClick={() => pick(item)}
              >
                <span className="relief-suggest-label">{item.label}</span>
                <span className="relief-suggest-tag">{item.sub}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
