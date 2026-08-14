import {
  createContext,
  createElement,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import compiledContent from "./generated/content.json";

export const defaultLocale = compiledContent.defaultLocale;
export const supportedLocales = compiledContent.supportedLocales;

export function getContent(locale = defaultLocale) {
  const localeContent = compiledContent.locales[locale];
  if (!localeContent) throw new Error(`Unsupported content locale: ${locale}`);
  return localeContent;
}

export const siteConfig = compiledContent.site;
export const editorialLinks = compiledContent.links;

const STORAGE_KEY = "talea-language";
const URL_PARAMETER = "lang";
const ContentContext = createContext(null);

const isSupportedLocale = (locale) => supportedLocales.includes(locale);

function readInitialLocale() {
  if (typeof window === "undefined") return defaultLocale;

  const queryLocale = new URL(window.location.href).searchParams.get(URL_PARAMETER);
  if (isSupportedLocale(queryLocale)) return queryLocale;

  try {
    const storedLocale = window.localStorage.getItem(STORAGE_KEY);
    if (isSupportedLocale(storedLocale)) return storedLocale;
  } catch {
    // Storage can be unavailable in privacy-restricted browser contexts.
  }

  return defaultLocale;
}

function replaceLocaleInUrl(target, locale) {
  const url = new URL(target.location.href);
  if (url.searchParams.get(URL_PARAMETER) === locale) return;
  url.searchParams.set(URL_PARAMETER, locale);
  target.history.replaceState(target.history.state, "", url);
}

export function ContentProvider({ children }) {
  const [locale, setLocaleState] = useState(readInitialLocale);

  const setLocale = useCallback((nextLocale) => {
    if (!isSupportedLocale(nextLocale)) {
      throw new Error(`Unsupported content locale: ${nextLocale}`);
    }
    setLocaleState(nextLocale);
  }, []);

  useEffect(() => {
    document.documentElement.lang = locale;
    try {
      window.localStorage.setItem(STORAGE_KEY, locale);
    } catch {
      // The URL remains the persistence fallback when storage is unavailable.
    }

    replaceLocaleInUrl(window, locale);
    if (window.parent !== window) {
      try {
        window.parent.document.documentElement.lang = locale;
        replaceLocaleInUrl(window.parent, locale);
      } catch {
        // The embedded app may be hosted by a cross-origin parent.
      }
    }
  }, [locale]);

  const value = useMemo(() => {
    const content = getContent(locale);
    return {
      locale,
      setLocale,
      content,
      methodContent: content.method,
      glossaryContent: content.glossary,
      uiContent: content.ui,
    };
  }, [locale, setLocale]);

  return createElement(ContentContext.Provider, { value }, children);
}

export function useContent() {
  const value = useContext(ContentContext);
  if (!value) throw new Error("useContent must be used within ContentProvider");
  return value;
}
