"use client";
import { useState, type ReactNode } from "react";
import { dict, fillNum, type Lang } from "@/lib/i18n";
import type { Status } from "@/lib/types";
import Badge from "./Badge";
import Button from "./Button";
import Card from "./Card";
import { Checkbox, RadioGroup } from "./Choice";
import Dialog from "./Dialog";
import EmptyState from "./EmptyState";
import Input from "./Input";
import Pagination from "./Pagination";
import Select from "./Select";
import { Skeleton, SkeletonText } from "./Skeleton";
import Stepper from "./Stepper";
import StatusChip from "./StatusChip";
import Table from "./Table";
import Tabs from "./Tabs";
import Textarea from "./Textarea";
import { ToastView } from "./Toast";

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="space-y-3 border-t border-slate-200 pt-5">
      <h3 className="text-lg font-semibold text-civic">{title}</h3>
      {children}
    </section>
  );
}

const row = "flex flex-wrap items-center gap-3";

type Row = { ref: string; title: string; status: Status };

function Panel({ lang }: { lang: Lang }) {
  const t = dict[lang];
  const d = t.dev;
  const [dialog, setDialog] = useState(false);
  const [busy, setBusy] = useState(false);
  const [page, setPage] = useState(4);
  const [contact, setContact] = useState("email");
  const rows: Row[] = [
    { ref: "JK-1001", title: d.rowA, status: "received" },
    { ref: "JK-1002", title: d.rowB, status: "acknowledged" },
    { ref: "JK-1003", title: d.rowC, status: "resolved" },
  ];
  const stepNames = [d.steps.category, d.steps.describe, d.steps.location, d.steps.evidence, d.steps.review];

  return (
    <div lang={lang} className="min-w-0 space-y-6 rounded-2xl border border-slate-200 bg-background p-4">
      <h2 className="text-2xl font-semibold text-civic">{lang === "bn" ? "বাংলা" : "English"}</h2>

      <Section title={d.sButtons}>
        <div className={row}>
          <Button>{d.primary}</Button>
          <Button variant="secondary">{d.secondary}</Button>
          <Button variant="success">{d.success}</Button>
          <Button variant="danger">{d.danger}</Button>
          <Button variant="ghost">{d.ghost}</Button>
        </div>
        <div className={row}>
          <Button disabled>{d.disabled}</Button>
          <Button loading>{d.loading}</Button>
          <Button size="lg">{d.large}</Button>
        </div>
        <Button full>{d.primary}</Button>
      </Section>

      <Section title={d.sFields}>
        <Input lang={lang} label={d.fName} hint={d.fNameHint} placeholder={d.fName} />
        <Input lang={lang} label={d.fName} error={d.fNameErr} defaultValue="" />
        <Input lang={lang} label={d.fDisabled} optional disabled defaultValue={d.fDisabled} />
        <Textarea lang={lang} label={d.fNote} error={d.fNoteErr} defaultValue="abc" />
        <Select lang={lang} label={d.fCat} placeholder={d.fChoose} options={Object.entries(t.cats).map(([value, label]) => ({ value, label }))} defaultValue="" />
        <Select lang={lang} label={d.fCat} placeholder={d.fChoose} error={d.fCatErr} options={[{ value: "roads", label: t.cats.roads }]} defaultValue="" />
      </Section>

      <Section title={d.sChoices}>
        <Checkbox lang={lang} label={d.chAgree} />
        <Checkbox lang={lang} label={d.chAgree} defaultChecked />
        <Checkbox lang={lang} label={d.chAgree} error={d.chAgreeErr} />
        <Checkbox lang={lang} label={d.chOff} disabled />
        <RadioGroup
          lang={lang}
          legend={d.chContact}
          name={`contact-${lang}`}
          value={contact}
          onChange={setContact}
          options={[{ value: "phone", label: d.chPhone }, { value: "email", label: d.chEmail }, { value: "none", label: d.chNone, disabled: true }]}
        />
      </Section>

      <Section title={d.sDialog}>
        <Button variant="secondary" onClick={() => setDialog(true)}>{d.openDialog}</Button>
        <Dialog
          lang={lang}
          open={dialog}
          busy={busy}
          onClose={() => setDialog(false)}
          title={d.dialogTitle}
          description={d.dialogBody}
          actions={
            <>
              <Button variant="secondary" disabled={busy} onClick={() => setDialog(false)}>{t.ofCancel}</Button>
              <Button loading={busy} onClick={() => { setBusy(true); setTimeout(() => { setBusy(false); setDialog(false); }, 1200); }}>{busy ? t.ofWorking : d.dialogYes}</Button>
            </>
          }
        />
        <div className="flex flex-col items-start gap-2">
          <ToastView tone="success" message={d.toastOk} closeLabel={t.uiDismiss} onClose={() => {}} />
          <ToastView tone="error" message={d.toastErr} closeLabel={t.uiDismiss} onClose={() => {}} />
          <ToastView tone="info" message={d.toastInfo} closeLabel={t.uiDismiss} />
        </div>
      </Section>

      <Section title={d.sTabs}>
        <Tabs
          label={d.tabsAria}
          defaultValue="a"
          tabs={[
            { id: "a", label: d.tabA, panel: <p>{d.panelA}</p> },
            { id: "b", label: d.tabB, panel: <p>{d.panelB}</p> },
            { id: "c", label: d.tabC, panel: <p>{d.panelC}</p> },
            { id: "d", label: d.tabD, panel: null, disabled: true },
          ]}
        />
      </Section>

      <Section title={d.sBadges}>
        <div className={row}>
          <Badge>{d.bNeutral}</Badge>
          <Badge tone="info" icon="ℹ">{d.bInfo}</Badge>
          <Badge tone="warning" icon="⚠">{d.bWarn}</Badge>
          <Badge tone="danger" icon="✕">{d.bDanger}</Badge>
        </div>
        <div className={row}>
          {(["received", "acknowledged", "referred", "resolved"] as Status[]).map((s) => <StatusChip key={s} status={s} label={t.statuses[s]} />)}
        </div>
      </Section>

      <Section title={d.sCards}>
        <Card title={d.cardTitle}>{d.cardBody}</Card>
        <Card tone="info" title={d.cardTitle} headingAs="h3">{d.cardBody}</Card>
        <Card tone="warning">{d.cardBody}</Card>
        <Card tone="danger">{d.cardBody}</Card>
      </Section>

      <Section title={d.sSkeleton}>
        <div role="status" className="space-y-3">
          <span className="sr-only">{t.stLoading}</span>
          <Skeleton className="h-24 w-full" />
          <SkeletonText lines={3} />
        </div>
      </Section>

      <Section title={d.sEmpty}>
        <EmptyState title={d.emptyTitle} body={d.emptyBody} action={<Button>{t.reportCta}</Button>} />
        <EmptyState variant="noResults" title={d.noResultsTitle} body={d.noResultsBody} />
      </Section>

      <Section title={d.sStepper}>
        <Stepper label={t.uiStepperAria} steps={stepNames} current={2} stepOf={fillNum(t.uiStepOf, { current: 3, total: 5 }, lang)} />
      </Section>

      <Section title={d.sTable}>
        <Table
          caption={d.tCaption}
          rows={rows}
          rowKey={(r) => r.ref}
          columns={[
            { key: "title", header: d.tSubject, primary: true, cell: (r) => r.title },
            { key: "ref", header: d.tRef, nowrap: true, cell: (r) => r.ref },
            { key: "status", header: d.tStatus, cell: (r) => <StatusChip status={r.status} label={t.statuses[r.status]} /> },
          ]}
        />
      </Section>

      <Section title={d.sPagination}>
        <Pagination lang={lang} page={page} totalPages={12} onPageChange={setPage} />
      </Section>
    </div>
  );
}

/** Every primitive and its states, bn and en side by side (stacked on phones). Review-only. */
export default function UiGallery() {
  return (
    <div className="grid gap-6 xl:grid-cols-2">
      <Panel lang="bn" />
      <Panel lang="en" />
    </div>
  );
}
