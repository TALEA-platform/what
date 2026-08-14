// Runtime strings are not rebased by Vite, so public assets must include BASE_URL.
export function assetUrl(path) {
  return `${import.meta.env.BASE_URL}${String(path).replace(/^\/+/, "")}`;
}
