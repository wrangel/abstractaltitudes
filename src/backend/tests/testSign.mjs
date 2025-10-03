import crypto from "crypto";

function generateBunnyToken(path, secret, expiration) {
  const expires = expiration; // expiration is unix timestamp in seconds
  const tokenString = secret + path + expires;

  const hash = crypto.createHash("sha256").update(tokenString).digest("base64");
  const token = hash.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");

  return token;
}

const secret = process.env.BUNNYCDN_TOKEN_SECRET;
const basePath =
  "/hd_20250813_193201/hd_20250813_193201.webp?width=1421&height=499";
const expires = Math.floor(Date.now() / 1000) + 300; // valid for 5 min

const token = generateBunnyToken(basePath, secret, expires);

console.log(`Path     : ${basePath}`);
console.log(`Expires  : ${expires}`);
console.log(`Token    : ${token}`);
console.log(
  `Signed URL: https://abstractaltitudes.b-cdn.net${basePath}&token=${token}&expires=${expires}`
);
