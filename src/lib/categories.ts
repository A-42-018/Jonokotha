// Kept free of zod so client components can import the category list without pulling the validator into the browser bundle.
export const CATEGORIES = ["roads","drainage","water","electricity","waste","flooding","health","education","safety","environment","facilities","other"] as const;
export type Category = (typeof CATEGORIES)[number];
