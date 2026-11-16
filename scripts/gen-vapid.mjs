// Prints a VAPID key pair for Web Push: put them in VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY (server) and VAPID_SUBJECT (mailto: or https: contact).
import { generateKeyPairSync } from "node:crypto";
const { publicKey, privateKey } = generateKeyPairSync("ec", { namedCurve: "P-256" });
const pub = publicKey.export({ format: "jwk" }), prv = privateKey.export({ format: "jwk" });
const raw = Buffer.concat([Buffer.from([4]), Buffer.from(pub.x, "base64url"), Buffer.from(pub.y, "base64url")]).toString("base64url");
console.log(`VAPID_PUBLIC_KEY=${raw}\nVAPID_PRIVATE_KEY=${prv.d}`);
