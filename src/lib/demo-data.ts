import type { Agency } from "./types";

// Agencies are real bodies; entries link to their official sites (reachability checked 2026-11-16).
// Which agency serves a given area, and contact channels, must still be verified per constituency.
export const DEMO_CONSTITUENCY = { id: "demo-1", nameBn: "নমুনা নির্বাচনী এলাকা", nameEn: "Sample Constituency" };

const C = "2026-11-16";
export const AGENCIES: Agency[] = [
  { id: "ag-lged", nameBn: "স্থানীয় সরকার প্রকৌশল অধিদপ্তর (এলজিইডি)", nameEn: "Local Government Engineering Department (LGED)", categories: ["roads","facilities"], source: "lged.gov.bd", url: "https://lged.gov.bd", checkedAt: C },
  { id: "ag-wasa", nameBn: "ঢাকা ওয়াসা", nameEn: "Dhaka WASA", categories: ["drainage","water","flooding"], source: "dwasa.org.bd", url: "https://dwasa.org.bd", checkedAt: C },
  { id: "ag-power", nameBn: "ঢাকা পাওয়ার ডিস্ট্রিবিউশন কোম্পানি (ডিপিডিসি)", nameEn: "Dhaka Power Distribution Company (DPDC)", categories: ["electricity"], source: "dpdc.org.bd", url: "https://dpdc.org.bd", checkedAt: C },
  { id: "ag-city", nameBn: "ঢাকা উত্তর সিটি কর্পোরেশন", nameEn: "Dhaka North City Corporation", categories: ["waste","environment","health"], source: "dncc.gov.bd", url: "https://dncc.gov.bd", checkedAt: C },
  { id: "ag-edu", nameBn: "প্রাথমিক শিক্ষা অধিদপ্তর", nameEn: "Directorate of Primary Education", categories: ["education"], source: "dpe.gov.bd", url: "https://dpe.gov.bd", checkedAt: C },
  { id: "ag-police", nameBn: "ঢাকা মেট্রোপলিটন পুলিশ", nameEn: "Dhaka Metropolitan Police", categories: ["safety"], source: "dmp.gov.bd", url: "https://dmp.gov.bd", checkedAt: C },
  { id: "ag-office", nameBn: "এমপি অফিস (সরাসরি)", nameEn: "MP office (direct)", categories: ["other"], source: "—" },
];
