"use client";
import { useRef, useState } from "react";
import { fillNum } from "@/lib/format";
import { type Dict, type Lang } from "@/lib/i18n";
import { checkPhoto, compressImage, MAX_PHOTO_BYTES, PHOTO_TYPES } from "@/lib/image";
import { MAX_CAPTION, MAX_PHOTOS } from "@/lib/report";
import Button from "../ui/Button";
import Card from "../ui/Card";
import Input from "../ui/Input";
import { useToast } from "../ui/Toast";

export type Photo = { id: string; url: string; kb: number; caption: string; blob: Blob };

export default function EvidenceStep({ t, lang, photos, onChange }: {
  t: Dict;
  lang: Lang;
  photos: Photo[];
  onChange: (next: Photo[] | ((prev: Photo[]) => Photo[])) => void;
}) {
  const toast = useToast();
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);

  async function add(files: FileList | null) {
    if (!files || files.length === 0) return;
    const room = MAX_PHOTOS - photos.length;
    const picked = Array.from(files);
    if (picked.length > room) toast("error", t.errPhotoMax);
    setBusy(true);
    for (const f of picked.slice(0, Math.max(0, room))) {
      const problem = PHOTO_TYPES.includes(f.type) ? await checkPhoto(f) : "type";
      if (problem) { toast("error", problem === "size" ? fillNum(t.errPhotoSize, { mb: MAX_PHOTO_BYTES / 1024 / 1024 }, lang) : t.errPhotoType); continue; }
      try {
        const blob = await compressImage(f);
        const p: Photo = { id: crypto.randomUUID(), url: URL.createObjectURL(blob), kb: Math.max(1, Math.round(blob.size / 1024)), caption: "", blob };
        onChange((prev) => [...prev, p]);
      } catch {
        toast("error", t.errPhotoFail);
      }
    }
    setBusy(false);
    if (input.current) input.current.value = "";
  }

  function remove(id: string) {
    onChange((prev) => {
      const gone = prev.find((p) => p.id === id);
      if (gone) URL.revokeObjectURL(gone.url);
      return prev.filter((p) => p.id !== id);
    });
  }

  const caption = (id: string, v: string) => onChange((prev) => prev.map((p) => (p.id === id ? { ...p, caption: v } : p)));

  return (
    <div className="space-y-4">
      <p className="text-muted">{t.evHint}</p>
      <Card tone="warning" className="text-sm">
        <p className="font-semibold text-amber-900">⚠ {t.evWarnTitle}</p>
        <p>{t.evWarnBody}</p>
      </Card>

      <input ref={input} type="file" accept={PHOTO_TYPES.join(",")} multiple hidden onChange={(e) => void add(e.target.files)} />
      <Button variant="secondary" icon={<span aria-hidden>📷</span>} loading={busy} disabled={photos.length >= MAX_PHOTOS} onClick={() => input.current?.click()}>
        {busy ? t.evCompressing : t.evAdd}
      </Button>

      {photos.length === 0 ? (
        <p className="text-muted">{t.evNone}</p>
      ) : (
        <ul className="space-y-3">
          {photos.map((p, i) => (
            <li key={p.id}>
              <Card as="div" className="flex flex-col gap-3 sm:flex-row">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={p.url} alt={fillNum(t.evAlt, { n: i + 1 }, lang)} className="h-32 w-full rounded-lg object-cover sm:w-40" />
                <div className="flex-1 space-y-2">
                  <Input
                    label={t.evCaption}
                    hint={t.evCaptionHint}
                    optional
                    maxLength={MAX_CAPTION}
                    value={p.caption}
                    onChange={(e) => caption(p.id, e.target.value)}
                  />
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm text-muted">{fillNum(t.evSize, { kb: p.kb }, lang)}</span>
                    <Button variant="ghost" onClick={() => remove(p.id)}>{t.evRemove}</Button>
                  </div>
                </div>
              </Card>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
