#!/usr/bin/env node
//
// Produce one client's onboarding pack: their integration document with their
// own domain and a freshly generated key filled in, plus the environment line
// to register them in the portal.
//
//   node scripts/onboard-client.mjs \
//     --name "Acme Ltd" \
//     --url https://acme.example.com/consent-api/consents \
//     --sector ecommerce
//
// Add --verify to run the three checks the document asks the client to run,
// once their endpoint is live.
//
// The document is generated from docs/PARTNER_ONBOARDING.md rather than a
// second copy of the text, so the specification has one source. If a
// placeholder ever stops matching, this fails loudly instead of shipping a
// document with your-domain.example still in it.

import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const TEMPLATE = path.join(ROOT, "docs", "PARTNER_ONBOARDING.md");
const OUT_DIR = path.join(ROOT, "docs", "clients");

const SECTORS = ["ecommerce", "finance", "healthcare", "insurance", "securities", "telecom", "generic"];
const PLACEHOLDER_URL = "https://your-domain.example/consent-api/consents";
const PLACEHOLDER_ORIGIN = "https://your-domain.example";

function parseArgs(argv) {
  const args = { verify: false };
  for (let i = 0; i < argv.length; i += 1) {
    const key = argv[i];
    if (key === "--verify") { args.verify = true; continue; }
    if (!key.startsWith("--")) continue;
    args[key.slice(2)] = argv[i + 1];
    i += 1;
  }
  return args;
}

const slugify = (value) =>
  value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

function generateKey(company, sector) {
  // Prefixed so the key is recognisable in a log or an env file at a glance.
  const stem = slugify(company).replace(/-/g, "_").slice(0, 12).replace(/_+$/, "");
  const prefix = `${stem}_${sector.slice(0, 4)}_live`;
  return `${prefix}_${crypto.randomBytes(24).toString("hex")}`;
}

async function verifyEndpoint(url, key) {
  const call = async (headers) => {
    try {
      const response = await fetch(url, { headers, signal: AbortSignal.timeout(20000) });
      return response.status;
    } catch (error) {
      return `unreachable (${error.message})`;
    }
  };

  const withKey = await call({ "x-api-key": key, Accept: "application/json" });
  const noKey = await call({ Accept: "application/json" });
  const wrongKey = await call({ "x-api-key": "wrong-key-for-testing", Accept: "application/json" });

  const pass = withKey === 200 && noKey === 401 && wrongKey === 401;
  console.log("\nVerification");
  console.log(`  valid key   ${withKey}  ${withKey === 200 ? "ok" : "expected 200"}`);
  console.log(`  no key      ${noKey}  ${noKey === 401 ? "ok" : "expected 401"}`);
  console.log(`  wrong key   ${wrongKey}  ${wrongKey === 401 ? "ok" : "expected 401"}`);
  console.log(pass ? "  → ready to register" : "  → not ready; the client must fix the above first");
  return pass;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));

  if (!args.name || !args.url) {
    console.error("Usage: node scripts/onboard-client.mjs --name \"Acme Ltd\" --url https://acme.example.com/consent-api/consents [--sector ecommerce] [--verify]");
    process.exit(1);
  }

  const sector = (args.sector || "generic").toLowerCase();
  if (!SECTORS.includes(sector)) {
    console.error(`Unknown sector "${sector}". One of: ${SECTORS.join(", ")}`);
    process.exit(1);
  }

  let consentUrl;
  try {
    consentUrl = new URL(args.url);
  } catch {
    console.error(`"${args.url}" is not a valid URL.`);
    process.exit(1);
  }
  if (consentUrl.pathname === "/" || consentUrl.pathname === "") {
    console.error("Give the full path to the consent route, not just the domain — a bare domain is the most common onboarding mistake.");
    process.exit(1);
  }

  const apiKey = args.key || generateKey(args.name, sector);
  const template = fs.readFileSync(TEMPLATE, "utf-8");

  if (!template.includes(PLACEHOLDER_URL)) {
    console.error(`The template no longer contains "${PLACEHOLDER_URL}". Update this script before generating client documents.`);
    process.exit(1);
  }

  const document = template
    .replace(/^# Consent API — Client Integration$/m, `# Consent API Integration — ${args.name}`)
    .replaceAll(PLACEHOLDER_URL, consentUrl.toString())
    .replaceAll(PLACEHOLDER_ORIGIN, consentUrl.origin)
    .replaceAll('"x-api-key: $KEY"', `"x-api-key: ${apiKey}"`)
    // Replace through to the next sentence so the paragraph reflows cleanly
    // rather than leaving a dangling clause after the key block.
    .replace(
      "Generate the key with `openssl rand -hex 24` and keep it in an environment\nvariable. Reject",
      `Your API key is below. Keep it in an environment variable; do not commit it.\n\n\`\`\`\n${apiKey}\n\`\`\`\n\nReject`
    );

  fs.mkdirSync(OUT_DIR, { recursive: true });
  const outFile = path.join(OUT_DIR, `${slugify(args.name)}.md`);
  fs.writeFileSync(outFile, document, "utf-8");

  console.log(`\nClient document  ${path.relative(ROOT, outFile)}`);
  console.log(`Company          ${args.name}`);
  console.log(`Sector           ${sector}`);
  console.log(`Endpoint         ${consentUrl.toString()}`);
  console.log(`API key          ${apiKey}`);
  console.log("\nRegister them by adding this to the portal's environment:\n");
  console.log(`CONSENT_SOURCE_${slugify(args.name).replace(/-/g, "_").toUpperCase()}=${apiKey}|${consentUrl.toString()}|${sector}|${args.name}`);

  if (args.verify) {
    const ready = await verifyEndpoint(consentUrl.toString(), apiKey);
    process.exit(ready ? 0 : 2);
  }
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
