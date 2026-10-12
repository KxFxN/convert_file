import { randomBytes, scryptSync } from "node:crypto";

const names = process.argv.slice(2)
const alphabet = "abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789"
const genPassword = () => Array.from(randomBytes(14), (b) => alphabet[b % alphabet.length]).join("");

const users = names.map((u) => {
  const password = genPassword();
  const salt = randomBytes(16);
  const hash = scryptSync(password, salt, 64)
  console.log(`${u}\t${password}`);
  return { u, s: salt.toString("hex"), h: hash.toString("hex") };
})

console.log(`\nAUTH_USERS='${JSON.stringify(users)}'`);
console.log(`JWT_SECRET=${randomBytes(48).toString("base64url")}`);
