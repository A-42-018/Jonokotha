import type { Lang } from "./types";

/** Starter questions shown before the first message. Client-safe on purpose (the panel must not import the chat engine). */
export function starters(page: string, lang: Lang): { label: string; send: string }[] {
  const base: [string, string][] = lang === "bn"
    ? [["সমস্যা জানাব কীভাবে?", "সমস্যা জানাব কীভাবে?"], ["এমপিকে কীভাবে প্রশ্ন করব?", "এমপিকে প্রশ্ন করব কীভাবে?"], ["এই পাতাটি কীভাবে ব্যবহার করব?", "এই পাতাটি কীভাবে ব্যবহার করব?"], ["ভূমি অফিসের সমস্যা", "ভূমি অফিসে সমস্যা হলে কী করব?"]]
    : [["How do I report a problem?", "How do I report a problem?"], ["How do I ask my MP?", "How do I ask my MP a question?"], ["How do I use this page?", "How do I use this page?"], ["Problem at a land office", "What if I have a problem at a land office?"]];
  // On the report page the first thing people want is the page's own guide.
  const list = page === "/report" ? [base[2], base[0], base[1], base[3]] : base;
  return list.map(([label, send]) => ({ label, send }));
}
