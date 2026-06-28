// asset-url.js
// public/ 配下の静的アセットを base 付き URL に解決する

export function asset(path) {
  return import.meta.env.BASE_URL + path.replace(/^\//, "");
}
