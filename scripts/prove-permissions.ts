/**
 * Proves the ownership rule is enforced by the SERVER, not by the hidden
 * button — by sending the assignOwner action directly, the way an attacker
 * would, bypassing the page entirely.
 *
 * An agent's request must be refused AND leave the stored record untouched.
 * An admin's identical request must succeed: without that control case a
 * malformed request would be refused too, and the proof would be worthless.
 *
 * Needs the dev server running (npm run dev). Restores what it changes.
 */
import mongoose from "mongoose";
import { connectToDatabase } from "../src/lib/db";
import { Lead } from "../src/models/Lead";
import { USERS } from "../src/lib/users";

const BASE = process.env.BASE_URL ?? "http://localhost:3000";
const ADMIN = USERS.find((u) => u.role === "admin")!;
const AGENT = USERS.find((u) => u.role === "agent")!;

/** Server action ids change every build, so read the live one off the server. */
async function findActionId(name: string): Promise<string> {
  const html = await (await fetch(`${BASE}/leads`)).text();
  const chunks = [...new Set(html.match(/\/_next\/static\/[^"]+\.js/g) ?? [])];
  for (const chunk of chunks) {
    const js = await (await fetch(`${BASE}${chunk}`)).text();
    if (!js.includes(name)) continue;
    const id =
      js.match(new RegExp(`"([0-9a-f]{40,})"[^)]{0,120}${name}`))?.[1] ??
      js.match(new RegExp(`createServerReference\\)?\\("([0-9a-f]{40,})"[^)]{0,120}${name}`))?.[1];
    if (id) return id;
  }
  throw new Error(`could not find the action id for ${name} — is the dev server running?`);
}

/** The exact multipart shape React posts for a useActionState form action. */
function actionBody(actionId: string, fields: Record<string, string>) {
  const boundary = "----proofBoundary" + Math.random().toString(16).slice(2);
  // Order matters, and an object literal cannot express it: "0" is an
  // integer-like key, so Object.entries would hoist it to the front, ahead of
  // the temporary references it points at. Hence an array of pairs.
  const parts: [string, string][] = [
    ["_1_$ACTION_REF_32", ""],
    ["_1_$ACTION_32:0", JSON.stringify({ id: actionId, bound: "$@1" })],
    ["_1_$ACTION_32:1", "[null]"],
    ["_1_$ACTION_KEY", "k" + "0".repeat(32)],
    ...Object.entries(fields).map(([k, v]): [string, string] => [`_1_${k}`, v]),
    // The argument list: [prevState, formData], where "$K1" points at the
    // "_1_" prefixed fields above.
    ["0", '[null,"$K1"]'],
  ];
  const body =
    parts
      .map(([k, v]) => `--${boundary}\r\nContent-Disposition: form-data; name="${k}"\r\n\r\n${v}\r\n`)
      .join("") + `--${boundary}--\r\n`;
  return { body, contentType: `multipart/form-data; boundary=${boundary}` };
}

async function callAsUser(userId: string, actionId: string, fields: Record<string, string>) {
  const { body, contentType } = actionBody(actionId, fields);
  const res = await fetch(`${BASE}/leads`, {
    method: "POST",
    headers: { "Next-Action": actionId, "Content-Type": contentType, Cookie: `dev-user=${userId}` },
    body,
  });
  const text = await res.text();
  if (text.includes("Server action not found")) {
    throw new Error("server rejected the action id — the request never reached the action");
  }
  if (process.env.PROVE_DEBUG) console.log("   raw:", text.slice(0, 400).replace(/\n/g, " | "));
  return { status: res.status, refused: /"ok":\s*false/.test(text), accepted: /"ok":\s*true/.test(text) };
}

const ownerOf = async (id: mongoose.Types.ObjectId) =>
  (await Lead.findById(id).lean())?.ownerId ?? null;

async function main() {
  await connectToDatabase();

  const lead = await Lead.findOne({ ownerId: AGENT.id }).lean();
  if (!lead) throw new Error(`no lead owned by ${AGENT.name} — run npm run seed first`);

  const actionId = await findActionId("assignOwnerAction");
  const fields = { leadId: String(lead._id), ownerId: ADMIN.id };
  const failures: string[] = [];

  console.log(`lead under test: ${lead.name} (owner ${lead.ownerId})`);
  console.log(`assignOwnerAction id: ${actionId}\n`);

  // 1. the agent, bypassing a page that never renders this control
  const asAgent = await callAsUser(AGENT.id, actionId, fields);
  const afterAgent = await ownerOf(lead._id);
  console.log(`1. ${AGENT.name} (agent) POSTs assignOwner directly`);
  console.log(`   response: http ${asAgent.status}, refused=${asAgent.refused}`);
  console.log(`   stored owner afterwards: ${afterAgent}`);
  if (!asAgent.refused) failures.push("the agent's request was not refused");
  if (afterAgent !== AGENT.id) failures.push("the agent's request CHANGED the stored record");

  // 2. control: the same request from an admin must work, or step 1 proved nothing
  const asAdmin = await callAsUser(ADMIN.id, actionId, fields);
  const afterAdmin = await ownerOf(lead._id);
  console.log(`\n2. CONTROL — ${ADMIN.name} (admin) sends the identical request`);
  console.log(`   response: http ${asAdmin.status}, accepted=${asAdmin.accepted}`);
  console.log(`   stored owner afterwards: ${afterAdmin}`);
  if (!asAdmin.accepted || afterAdmin !== ADMIN.id) {
    failures.push(
      "the admin control case did NOT succeed — the request is malformed, so step 1 proves nothing",
    );
  }

  await Lead.updateOne({ _id: lead._id }, { $set: { ownerId: lead.ownerId } });
  console.log(`\nrestored owner to ${lead.ownerId}`);

  await mongoose.disconnect();

  if (failures.length) {
    console.error("\nFAIL:\n" + failures.map((f) => `  - ${f}`).join("\n"));
    process.exit(1);
  }
  console.log("\nPASS: the server refused the agent and accepted the admin.");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
