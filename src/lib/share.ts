/** Share links for WhatsApp and Facebook. `path` is a same-site path; only the public URL and a short text are sent. */
export function shareLinks(origin: string, path: string, text: string) {
  const url = `${origin}${path}`;
  return {
    url,
    whatsapp: `https://wa.me/?text=${encodeURIComponent(`${text} ${url}`)}`,
    facebook: `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`,
  };
}

/** Open Graph / Twitter metadata for a public issue: title, category and area only; never description or reporter data. */
export function issueMetadata(c: { ref: string; title: string; area: string }, categoryLabel: string, site: string, appName: string) {
  const description = [categoryLabel, c.area].filter(Boolean).join(" · ");
  const image = "/illustrations/share-image.png";
  return {
    title: `${c.title} — ${appName}`,
    description,
    openGraph: { title: c.title, description, siteName: appName, type: "article" as const, url: `/issue/${c.ref}`, images: [{ url: image, width: 1536, height: 768 }] },
    twitter: { card: "summary_large_image" as const, title: c.title, description, images: [image] },
    metadataBase: new URL(site),
  };
}
