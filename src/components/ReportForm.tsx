"use client";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation } from "@tanstack/react-query";
import { useEffect, useMemo, useRef, useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { fillNum } from "@/lib/format";
import { type Dict, type Lang } from "@/lib/i18n";
import {
  DRAFT_KEY, FIELDS, LEGACY_DRAFT_KEY, STEP_FIELDS, hasPersonalNumber, reportSchema,
  type ReportData, type ReportField, type ReportValues,
} from "@/lib/report";
import { CATEGORIES, type Category } from "@/lib/categories";
import CategoryPicker from "./report/CategoryPicker";
import EvidenceStep, { type Photo } from "./report/EvidenceStep";
import PublicNotice from "@/components/PublicNotice";
import PrivacyWarning from "./report/PrivacyWarning";
import ReportSuccess from "./ReportSuccess";
import ReportQueued from "./offline/ReportQueued";
import { readQueue, writeQueue } from "./offline/queue-store";
import { enqueue, newId, sendReport } from "@/lib/offline-queue";
import { uploadPhotosTracked } from "@/lib/report-api";
import { AFFECTED, DURATIONS, REPORT_DESC_MAX, affectedLabel, durationLabel, isAffected, isDuration, withExtras } from "@/lib/report-extras";
import QueryProvider from "./QueryProvider";
import Badge from "./ui/Badge";
import Button from "./ui/Button";
import Card from "./ui/Card";
import Dialog from "./ui/Dialog";
import Input from "./ui/Input";
import Select from "./ui/Select";
import Stepper from "./ui/Stepper";
import Textarea from "./ui/Textarea";
import { appendTranscript } from "@/lib/speech";
import { usePersonalModes } from "@/components/ui/usePersonalization";
import { useSpeech } from "./report/useSpeech";
import LocationPicker from "./report/LocationPicker";
import type { Pin } from "@/lib/places";
import EmergencyGuidance from "@/components/EmergencyGuidance";
import { country } from "@/lib/country";
import type { Emergency } from "@/lib/types";
import { useToast } from "./ui/Toast";
import { useKeyboardInset } from "./ui/useKeyboardInset";

export { hasPersonalNumber };

type Saved = { quick?: string; values?: Partial<ReportValues>; ai?: ReportField[]; edited?: ReportField[]; step?: number; pin?: Pin; duration?: string; who?: string };

const LAST = 4;
const isCategory = (v: unknown): v is Category => typeof v === "string" && (CATEGORIES as readonly string[]).includes(v);

function readSaved(): Saved | null {
  try {
    const raw = localStorage.getItem(DRAFT_KEY);
    if (raw) return JSON.parse(raw) as Saved;
    // Drafts saved by the one-page form (v1) are carried over once.
    const old = localStorage.getItem(LEGACY_DRAFT_KEY);
    if (old) {
      const d = JSON.parse(old) as { text?: string; draft?: Partial<ReportValues> | null; edited?: ReportField[] };
      return { quick: d.text ?? "", values: d.draft ?? {}, ai: d.draft ? [...FIELDS] : [], edited: d.edited ?? [], step: d.draft ? 4 : 0 };
    }
  } catch { /* storage unavailable or corrupt: start empty */ }
  return null;
}

export default function ReportForm(props: { t: Dict; lang: Lang; constituencyId: string; initialCategory?: Category }) {
  return <QueryProvider><ReportFormInner {...props} /></QueryProvider>;
}

function ReportFormInner({ t, lang, constituencyId, initialCategory }: { t: Dict; lang: Lang; constituencyId: string; initialCategory?: Category }) {
  const toast = useToast();
  const schema = useMemo(() => reportSchema(t), [t]);
  const { register, control, setValue, reset, trigger, handleSubmit, getValues, formState: { errors } } = useForm<ReportValues, unknown, ReportData>({
    resolver: zodResolver(schema),
    mode: "onTouched",
    defaultValues: { title: "", description: "", area: "" },
  });
  const values = useWatch({ control });

  const [step, setStep] = useState(0);
  const [quick, setQuick] = useState("");
  const [ai, setAi] = useState<ReportField[]>([]);
  const [edited, setEdited] = useState<ReportField[]>([]);
  const [pin, setPin] = useState<Pin>();
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [sentRef, setSentRef] = useState("");
  const [queued, setQueued] = useState(false);
  const [restored, setRestored] = useState(false);
  const [confirmDiscard, setConfirmDiscard] = useState(false);
  const [busy, setBusy] = useState<"" | "draft">("");
  const [failedPhotos, setFailedPhotos] = useState<Photo[]>([]);
  const [upload, setUpload] = useState<{ n: number; total: number } | null>(null);
  const [duration, setDuration] = useState("");
  const [who, setWho] = useState("");
  const [emergency, setEmergency] = useState<Emergency>();
  const [emergencySeen, setEmergencySeen] = useState(false);
  // One Idempotency-Key per report: a second tap or a retry after a lost answer is replayed, not duplicated.
  const reportKey = useRef(newId());
  const [quickDone, setQuickDone] = useState(false);
  const speech = useSpeech(country().speechLocale[lang], (text) => setQuick((q) => appendTranscript(q, text)));
  const [modes] = usePersonalModes();
  const micButton = speech.listening
    ? <Button variant="danger" size={modes.voiceFirst ? "lg" : undefined} full={modes.voiceFirst} icon={<span aria-hidden>⏹</span>} onClick={speech.stop}>{t.vStop}</Button>
    : <Button variant={modes.voiceFirst ? "primary" : "secondary"} size={modes.voiceFirst ? "lg" : undefined} full={modes.voiceFirst} icon={<span aria-hidden>🎤</span>} onClick={speech.start}>{t.speak}</Button>;
  const loaded = useRef(false);
  const heading = useRef<HTMLHeadingElement>(null);
  const stepMounted = useRef(false);
  const photosRef = useRef<Photo[]>([]);
  const inset = useKeyboardInset();

  useEffect(() => { photosRef.current = photos; }, [photos]);
  useEffect(() => () => photosRef.current.forEach((p) => URL.revokeObjectURL(p.url)), []);

  // Recover an interrupted draft once on mount, then autosave every change.
  useEffect(() => {
    const id = setTimeout(() => {
      const d = readSaved();
      if (d) {
        const v = d.values ?? {};
        const any = !!(d.quick || v.title || v.description || v.area || v.category);
        if (any) {
          reset({ title: v.title ?? "", description: v.description ?? "", area: v.area ?? "", ...(isCategory(v.category) ? { category: v.category } : {}) });
          setQuick(d.quick ?? "");
          setAi(d.ai ?? []);
          setEdited(d.edited ?? []);
          setPin(d.pin);
          setDuration(isDuration(d.duration) ? d.duration : "");
          setWho(isAffected(d.who) ? d.who : "");
          setStep(Math.min(Math.max(d.step ?? 0, 0), LAST));
          setRestored(true);
          loaded.current = true;
          return;
        }
      }
      // No draft to recover: a type chosen on the home page tiles is preselected (a saved draft always wins).
      if (initialCategory) setValue("category", initialCategory, { shouldDirty: true });
      loaded.current = true;
    }, 0);
    return () => clearTimeout(id);
  }, [reset, setValue, initialCategory]);

  useEffect(() => {
    if (!loaded.current || sentRef || queued) return;
    try {
      const empty = !quick && !values.title && !values.description && !values.area && !values.category;
      if (empty) localStorage.removeItem(DRAFT_KEY);
      else localStorage.setItem(DRAFT_KEY, JSON.stringify({ quick, values, ai, edited, step, pin, duration, who } satisfies Saved));
    } catch { /* ignore */ }
  }, [quick, values, ai, edited, step, pin, duration, who, sentRef, queued]);

  // Move focus to the new step's heading (not on first load).
  useEffect(() => {
    if (!stepMounted.current) { stepMounted.current = true; return; }
    window.scrollTo({ top: 0 });
    heading.current?.focus({ preventScroll: true });
  }, [step]);

  const touched = (name: ReportField) => setEdited((e) => (ai.includes(name) && !e.includes(name) ? [...e, name] : e));

  function field(name: ReportField) {
    const r = register(name);
    return {
      ...r,
      onChange: async (e: Parameters<typeof r.onChange>[0]) => {
        touched(name);
        const out = await r.onChange(e);
        // An error shown by "Next" clears as soon as the text becomes valid, without waiting for blur.
        if (errors[name]) void trigger(name);
        return out;
      },
    };
  }

  function badge(name: ReportField) {
    if (!ai.includes(name)) return null;
    return edited.includes(name)
      ? <Badge tone="neutral" icon="✎">{t.editedBadge}</Badge>
      : <Badge tone="warning" icon="✨">{t.aiBadge}</Badge>;
  }
  const withBadge = (name: ReportField, node: React.ReactNode) => (
    <div className="relative">
      {node}
      {ai.includes(name) && <div className="absolute end-0 top-0">{badge(name)}</div>}
    </div>
  );

  function clearDraft() {
    photos.forEach((p) => URL.revokeObjectURL(p.url));
    reset({ title: "", description: "", area: "" });
    setQuick(""); setAi([]); setEdited([]); setPhotos([]); setPin(undefined); setDuration(""); setWho(""); setStep(0); setRestored(false); setQuickDone(false);
  }

  async function makeDraft() {
    setBusy("draft");
    try {
      const res = await fetch("/api/intake", { method: "POST", body: JSON.stringify({ text: quick }) });
      if (!res.ok) throw new Error("draft failed");
      const { draft } = (await res.json()) as { draft: Partial<ReportValues> };
      for (const f of ["title", "description", "area"] as const) setValue(f, draft[f] ?? "", { shouldDirty: true });
      if (isCategory(draft.category)) setValue("category", draft.category, { shouldDirty: true });
      setAi([...FIELDS]);
      setEdited([]);
      setQuickDone(true);
    } catch {
      toast("error", t.draftFail);
    }
    setBusy("");
  }

  async function next() {
    const names = STEP_FIELDS[step];
    if (names.length && !(await trigger(names))) {
      // Bring the first error into view (the category error sits below the tiles).
      setTimeout(() => document.querySelector("[data-field-error]")?.scrollIntoView({ block: "center" }), 0);
      return;
    }
    setRestored(false);
    setStep((s) => Math.min(s + 1, LAST));
  }

  const send = useMutation({
    mutationFn: async (data: ReportData) => {
      const body = {
        ...data, description: withExtras(data.description, { duration, who }, t), constituencyId,
        ...(pin ? { lat: pin.lat, lng: pin.lng, locationSource: "map" } : {}),
      };
      const item = { id: reportKey.current, body };
      const result = navigator.onLine === false ? ({ kind: "network" } as const) : await sendReport(item);
      return { result, item };
    },
    onSuccess: async ({ result, item }) => {
      if (result.kind === "sent") {
        try { localStorage.removeItem(DRAFT_KEY); } catch { /* ignore */ }
        setUpload(photos.length ? { n: 0, total: photos.length } : null);
        setFailedPhotos(await uploadPhotosTracked(result.ref, photos, undefined, (n, total) => setUpload({ n, total })));
        setUpload(null);
        setEmergency(result.emergency);
        setSentRef(result.ref);
      } else if (result.kind === "network" || result.kind === "server") {
        // No signal or the server is busy: keep the report on the phone; QueueSync sends it with the same key later.
        writeQueue(enqueue(readQueue(), item.body, new Date(), item.id));
        try { localStorage.removeItem(DRAFT_KEY); } catch { /* ignore */ }
        setQueued(true);
      } else {
        toast("error", result.kind === "unauth" ? t.qSignInToSend : t.submitFail);
      }
    },
    onError: () => toast("error", t.submitFail),
  });
  const submit = (data: ReportData) => send.mutateAsync(data).then(() => undefined, () => undefined);
  const submitting = send.isPending;

  // If something invalid slipped through (e.g. a restored draft), go to the first step with an error.
  function jumpToError(errs: Record<string, unknown>) {
    const i = STEP_FIELDS.findIndex((names) => names.some((n) => n in errs));
    if (i >= 0) setStep(i);
  }

  const warn = hasPersonalNumber([quick, values.title, values.description, values.area, ...photos.map((p) => p.caption)].filter(Boolean).join(" "));
  const category = values.category as Category | undefined;
  const steps = [t.wizSteps.category, t.wizSteps.describe, t.wizSteps.location, t.wizSteps.evidence, t.wizSteps.review];
  const titles = [t.stCategory, t.stDescribe, t.stLocation, t.stEvidence, t.stReview];

  if (queued) return <ReportQueued t={t} onAnother={() => { setQueued(false); reportKey.current = newId(); clearDraft(); }} />;
  // Imminent harm flagged by the server: guidance first, instead of the normal success screen, until the person chooses to go on.
  if (sentRef && emergency && !emergencySeen) {
    return (
      <EmergencyGuidance emergency={emergency} lang={lang} refId={sentRef}>
        <Button full onClick={() => setEmergencySeen(true)}>{t.emContinueReport}</Button>
      </EmergencyGuidance>
    );
  }
  if (sentRef) return <ReportSuccess t={t} lang={lang} refId={sentRef} failedPhotos={failedPhotos} emergency={emergency} onAnother={() => { setSentRef(""); setFailedPhotos([]); setEmergency(undefined); setEmergencySeen(false); reportKey.current = newId(); clearDraft(); }} />;

  const isLast = step === LAST;
  return (
    <form
      noValidate
      aria-label={t.reportCta}
      onSubmit={(e) => { e.preventDefault(); if (isLast) void handleSubmit(submit, jumpToError)(); else void next(); }}
      className="space-y-5 pb-28 [&_input]:scroll-mb-32 [&_select]:scroll-mb-32 [&_textarea]:scroll-mb-32"
    >
      <h1 className="jk-h1">{t.reportCta}</h1>
      <Stepper steps={steps} current={step} label={t.uiStepperAria} stepOf={fillNum(t.uiStepOf, { current: step + 1, total: steps.length }, lang)} />

      {restored && (
        <Card tone="info" className="flex flex-wrap items-center justify-between gap-2 text-sm">
          <p role="status">{t.draftRestored}</p>
          <Button variant="ghost" onClick={() => setConfirmDiscard(true)}>{t.draftDiscard}</Button>
        </Card>
      )}

      <h2 ref={heading} tabIndex={-1} className="jk-h2 outline-none">{titles[step]}</h2>

      {step === 0 && (
        <div className="space-y-5">
          <Card tone="info" className="space-y-3">
            {modes.voiceFirst && <div data-voice-first>{micButton}</div>}
            <Textarea
              label={t.quickTitle}
              hint={t.quickHint}
              placeholder={t.quickPlaceholder}
              rows={4}
              maxLength={3000}
              value={quick}
              onChange={(e) => setQuick(e.target.value)}
            />
            {warn && hasPersonalNumber(quick) && <PrivacyWarning t={t} />}
            <div className="flex flex-wrap gap-3">
              {!modes.voiceFirst && micButton}
              <Button loading={busy === "draft"} disabled={quick.trim().length < 3 || busy !== ""} onClick={() => void makeDraft()}>
                {busy === "draft" ? t.drafting : t.draft}
              </Button>
            </div>
            <p role="status" className="sr-only">{busy === "draft" ? t.drafting : ""}</p>
            {speech.listening && (
              <div role="status" aria-live="polite" className="rounded-xl border border-civic/30 bg-white p-3 text-sm">
                <p className="font-medium text-civic"><span aria-hidden>🎤 </span>{t.listening} {t.vLive}</p>
                <p className="mt-1 min-h-6 text-foreground">{speech.interim || t.vLiveEmpty}</p>
              </div>
            )}
            {speech.problem && (
              <p role="alert" className="rounded-xl border border-amber/60 bg-amber/10 p-3 text-sm">
                {speech.problem === "unsupported" ? t.speakUnsupported : speech.problem === "denied" ? t.vDenied : speech.problem === "silence" ? t.vSilence : speech.problem === "network" ? t.vNetwork : t.vOther}
              </p>
            )}
            {!speech.problem && <p className="jk-more text-sm text-muted">{t.vHint}</p>}
            {quickDone && <p role="status" className="text-sm font-medium text-leaf-strong">✓ {t.quickDone}</p>}
            {ai.length > 0 && <p className="text-sm text-muted">{t.aiNote}</p>}
          </Card>
          <CategoryPicker
            t={t}
            value={category}
            badge={badge("category")}
            error={errors.category?.message}
            onChange={(c) => { touched("category"); setValue("category", c, { shouldDirty: true, shouldValidate: true }); }}
          />
        </div>
      )}

      {step === 1 && (
        <div className="space-y-4">
          {withBadge("title", <Input label={t.fTitle} hint={t.fTitleHint} maxLength={130} error={errors.title?.message} {...field("title")} />)}
          {withBadge("description", <Textarea label={t.fDescription} hint={t.fDescHint} rows={7} maxLength={REPORT_DESC_MAX + 50} error={errors.description?.message} {...field("description")} />)}
          {warn && <PrivacyWarning t={t} />}
          <fieldset className="space-y-3 rounded-xl border border-line p-3">
            <legend className="px-1 text-sm text-muted">{t.rxHint}</legend>
            <Select lang={lang} label={t.rxDuration} optional placeholder={t.rxChoose} value={duration} onChange={(e) => setDuration(e.target.value)} options={DURATIONS.map((v) => ({ value: v, label: durationLabel(t, v) }))} />
            <Select lang={lang} label={t.rxWho} optional placeholder={t.rxChoose} value={who} onChange={(e) => setWho(e.target.value)} options={AFFECTED.map((v) => ({ value: v, label: affectedLabel(t, v) }))} />
            <p className="text-xs text-muted">{t.rxNote}</p>
          </fieldset>
        </div>
      )}

      {step === 2 && (
        <div className="space-y-4">
          <LocationPicker pin={pin} onPin={setPin} onArea={(name) => setValue("area", name, { shouldDirty: true, shouldValidate: true })} />
          {withBadge("area", <Input label={t.fArea} hint={t.fAreaHint} placeholder={t.fAreaPlaceholder} maxLength={130} autoComplete="street-address" error={errors.area?.message} {...field("area")} />)}
        </div>
      )}

      {step === 3 && <EvidenceStep t={t} lang={lang} photos={photos} onChange={setPhotos} />}

      {step === 4 && (
        <div className="space-y-4">
          <p className="text-muted">{t.reviewHint}</p>
          {warn && <PrivacyWarning t={t} />}
          <PublicNotice kind="issue" />
          {ai.length > 0 && <p className="text-sm text-muted">{t.aiNote}</p>}
          <ReviewRow t={t} label={t.fCategory} badge={badge("category")} onEdit={() => setStep(0)}>
            {category ? (
              <span className="flex items-center gap-3">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img loading="lazy" decoding="async" src={`/illustrations/home/cat-${category}.webp`} alt="" width={40} height={40} className="size-10" />
                {t.cats[category]}
              </span>
            ) : "—"}
          </ReviewRow>
          <ReviewRow t={t} label={t.fTitle} badge={badge("title")} onEdit={() => setStep(1)}>{getValues("title") || "—"}</ReviewRow>
          <ReviewRow t={t} label={t.fDescription} badge={badge("description")} onEdit={() => setStep(1)}><span className="whitespace-pre-wrap break-words">{getValues("description") || "—"}</span></ReviewRow>
          <ReviewRow t={t} label={t.rxReviewRow} onEdit={() => setStep(1)}>{isDuration(duration) || isAffected(who) ? [isDuration(duration) ? durationLabel(t, duration) : "", isAffected(who) ? affectedLabel(t, who) : ""].filter(Boolean).join(" · ") : <span className="text-muted">—</span>}</ReviewRow>
          <ReviewRow t={t} label={t.fArea} badge={badge("area")} onEdit={() => setStep(2)}>{getValues("area") || "—"}{pin ? ` · ${t.lpPinPlaced}` : ""}</ReviewRow>
          <ReviewRow t={t} label={t.wizSteps.evidence} onEdit={() => setStep(3)}>
            {photos.length === 0 ? <span className="text-muted">{t.evNone}</span> : (
              <div className="space-y-2">
                <ul className="flex flex-wrap gap-2">
                  {photos.map((p, i) => (
                    <li key={p.id}>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={p.url} alt={fillNum(t.evAlt, { n: i + 1 }, lang)} className="size-20 rounded-lg object-cover" />
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </ReviewRow>
          <p className="text-xs text-muted">{t.draftSaved}</p>
        </div>
      )}

      <div
        style={{ bottom: inset, paddingBottom: inset > 0 ? 0 : "env(safe-area-inset-bottom)" }}
        className="fixed inset-x-0 z-30 border-t border-line/40 bg-white/95 backdrop-blur"
      >
        <div className="mx-auto flex max-w-3xl items-center gap-3 px-4 py-3">
          {step > 0 && <Button variant="secondary" onClick={() => setStep((s) => s - 1)} disabled={submitting}>{t.wizBack}</Button>}
          {isLast ? (
            <Button type="submit" variant="success" size="lg" className="flex-1" loading={submitting} disabled={busy !== "" || submitting}>
              {submitting ? (upload ? fillNum(t.rxUploading, upload, lang) : t.submitting) : t.submit}
            </Button>
          ) : (
            <Button type="submit" className="flex-1" disabled={busy === "draft"}>{t.wizNext}</Button>
          )}
        </div>
      </div>

      <Dialog
        open={confirmDiscard}
        onClose={() => setConfirmDiscard(false)}
        title={t.discardTitle}
        description={t.discardBody}
        actions={
          <>
            <Button variant="secondary" onClick={() => setConfirmDiscard(false)}>{t.discardNo}</Button>
            <Button variant="danger" onClick={() => { clearDraft(); setConfirmDiscard(false); }}>{t.discardYes}</Button>
          </>
        }
      />
    </form>
  );
}

function ReviewRow({ t, label, badge, onEdit, children }: { t: Dict; label: string; badge?: React.ReactNode; onEdit: () => void; children: React.ReactNode }) {
  return (
    <Card as="section" className="space-y-1">
      <div className="flex items-center justify-between gap-2">
        <h3 className="flex flex-wrap items-center gap-2 text-sm font-medium text-muted">{label}{badge}</h3>
        <Button variant="ghost" onClick={onEdit} aria-label={t.reviewEditFor.replace("{field}", label)}>{t.reviewEdit}</Button>
      </div>
      <div className="text-base">{children}</div>
    </Card>
  );
}
