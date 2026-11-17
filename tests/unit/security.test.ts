import { describe, expect, it } from "vitest";
import { buildCsp } from "@/lib/csp";
import { checkPhoto, MAX_PHOTO_BYTES, sniffImageType } from "@/lib/image";
import { safeHref } from "@/lib/safe";

const bytes = (...b: number[]) => new Uint8Array([...b, ...new Array(12).fill(0)]);
const file = (head: Uint8Array, size = 1000) => ({ size, slice: () => new Blob([head as BlobPart]) }) as unknown as File;

describe("photo checks look at the content, not the name", () => {
  it("accepts JPEG, PNG and WebP signatures", () => {
    expect(sniffImageType(bytes(0xff, 0xd8, 0xff, 0xe0))).toBe("image/jpeg");
    expect(sniffImageType(bytes(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a))).toBe("image/png");
    expect(sniffImageType(new Uint8Array([0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x45, 0x42, 0x50]))).toBe("image/webp");
  });
  it("rejects SVG, HTML and other files even if they are named .jpg", async () => {
    const svg = new TextEncoder().encode("<svg xmlns=");
    expect(await checkPhoto(file(svg))).toBe("type");
    expect(await checkPhoto(file(new TextEncoder().encode("<!doctype h")))).toBe("type");
    expect(await checkPhoto(file(bytes(0xff, 0xd8, 0xff)))).toBeNull();
  });
  it("rejects files over the size limit before decoding them", async () => {
    expect(await checkPhoto(file(bytes(0xff, 0xd8, 0xff), MAX_PHOTO_BYTES + 1))).toBe("size");
  });
});

describe("links from data", () => {
  it("allows http(s) only", () => {
    expect(safeHref("https://example.com/a?b=1")).toBe("https://example.com/a?b=1");
    expect(safeHref("javascript:alert(1)")).toBeUndefined();
    expect(safeHref("data:text/html,<script>1</script>")).toBeUndefined();
    expect(safeHref("not a url")).toBeUndefined();
    expect(safeHref(undefined)).toBeUndefined();
  });
});

describe("CSP builder", () => {
  it("is strict by default: no objects, no framing, same-origin forms", () => {
    const csp = buildCsp({ supabaseUrl: "https://abc.supabase.co/rest" });
    expect(csp).toContain("object-src 'none'");
    expect(csp).toContain("frame-ancestors 'none'");
    expect(csp).toContain("connect-src 'self' https://abc.supabase.co");
    expect(csp).not.toMatch(/script-src[^;]*\*/);
  });
  it("uses a nonce instead of unsafe-inline when one is given", () => {
    expect(buildCsp({ nonce: "n1" })).toContain("script-src 'self' 'nonce-n1' 'strict-dynamic'");
    expect(buildCsp()).toContain("script-src 'self' 'unsafe-inline'");
  });
});
