const icon = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" rx="16" fill="#f04b25"/><path d="M18 18h12v11h11V18h5v28H34V35H23v11h-5z" fill="#fffaf2"/><circle cx="46" cy="47" r="4" fill="#171917"/></svg>`;

export function GET() {
  return new Response(icon, {
    headers: {
      "content-type": "image/svg+xml; charset=utf-8",
      "cache-control": "public, max-age=86400, immutable",
    },
  });
}
