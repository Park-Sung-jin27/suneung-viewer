export default function notFound(_request, response) {
  response.setHeader("Cache-Control", "no-store, max-age=0");
  response.setHeader("X-Robots-Tag", "noindex, nofollow, noarchive");
  return response.status(404).json({ error: "NOT_FOUND" });
}
