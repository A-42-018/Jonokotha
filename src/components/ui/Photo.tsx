/* eslint-disable @next/next/no-img-element */
import type { ImgHTMLAttributes } from "react";

/** A plain <img> for pictures whose address comes from the server (signed storage links) or the browser (a local preview). next/image cannot optimise those. */
export default function Photo(props: ImgHTMLAttributes<HTMLImageElement> & { alt: string }) {
  return <img decoding="async" {...props} />;
}
