import { pair } from "./pair";

export const security = pair(
  { errPhotoSize: "ছবিটি অনেক বড়। {mb} এমবির চেয়ে ছোট ছবি দিন।" },
  { errPhotoSize: "That photo is too large. Choose one smaller than {mb} MB." },
);
