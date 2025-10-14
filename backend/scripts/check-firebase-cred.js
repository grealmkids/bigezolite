#!/usr/bin/env node
// Simple validation for FIREBASE env vars used to initialize firebase-admin
const path = require("path");
const fs = require("fs");
const dotenv = require("dotenv");

const envPath = path.resolve(__dirname, "..", ".env");
if (fs.existsSync(envPath)) dotenv.config({ path: envPath });

console.log("== Firebase credential check ==");
const projectId = process.env.FIREBASE_PROJECT_ID;
const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
const privateKey = process.env.FIREBASE_PRIVATE_KEY;
const serviceAccount = process.env.FIREBASE_SERVICE_ACCOUNT;

console.log("FIREBASE_PROJECT_ID:", projectId || "<unset>");
if (serviceAccount) {
  try {
    const parsed = JSON.parse(serviceAccount);
    console.log(
      "FIREBASE_SERVICE_ACCOUNT present. project_id:",
      parsed.project_id || parsed.projectId
    );
  } catch (e) {
    console.error(
      "FIREBASE_SERVICE_ACCOUNT is present but is not valid JSON:",
      e.message
    );
    process.exitCode = 2;
  }
} else if (clientEmail && privateKey) {
  console.log("FIREBASE_CLIENT_EMAIL:", clientEmail);
  // Check that privateKey looks like PEM when \n replaced
  const raw = privateKey.replace(/\\n/g, "\n");
  const looksLikePem =
    raw.includes("BEGIN PRIVATE KEY") && raw.includes("END PRIVATE KEY");
  console.log(
    "FIREBASE_PRIVATE_KEY present:",
    !!privateKey,
    "looksLikePem:",
    looksLikePem
  );
  if (!looksLikePem) {
    console.warn(
      "Private key does not look like a PEM block after replacing \\n with actual newlines. Ensure you pasted the key and escaped newlines as \\n in the .env file."
    );
    process.exitCode = 3;
  }
} else {
  console.warn(
    "No firebase service account found in env. firebase-admin may use ADC or fail to initialize."
  );
  process.exitCode = 1;
}
