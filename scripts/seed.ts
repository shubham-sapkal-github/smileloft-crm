import mongoose from "mongoose";
import { connectToDatabase } from "../src/lib/db";
import { USERS } from "../src/lib/users";
import { Lead, type LeadDoc } from "../src/models/Lead";
import type { Stage, Status } from "../src/models/lead-enums";

// Typed so a mistyped stage or status is a compile error, not a surprise at
// the top of the table.
type SeedLead = {
  name: string;
  email?: string;
  phone?: string;
  location: string;
  treatmentInterest: string;
  stage: Stage;
  status: Status;
  ownerId: string | null;
  notes?: { body: string; authorId: string; authorName: string }[];
};

const ADMIN = USERS.find((user) => user.role === "admin")!.id;
const AGENT = USERS.find((user) => user.role === "agent")!.id;

// Every stage is represented, so the table looks like a practice mid-week
// rather than a pile of untouched enquiries — and so a funnel view has
// something to show. `name` is the stable key: re-running updates in place.
const LEADS: SeedLead[] = [
  {
    name: "Alice Bennett", email: "alice.bennett@example.com", phone: "07700 900101",
    location: "Manchester", treatmentInterest: "Invisalign",
    stage: "New", status: "Active", ownerId: AGENT,
  },
  {
    name: "Marcus Webb", phone: "07700 900102",
    location: "Salford", treatmentInterest: "Dental implants",
    stage: "New", status: "Active", ownerId: null,
  },
  {
    name: "Priya Raman", email: "p.raman@example.com", phone: "07700 900103",
    location: "Stockport", treatmentInterest: "Teeth whitening",
    stage: "Contacted", status: "Active", ownerId: AGENT,
    notes: [{ body: "Called Tuesday, asked for evening appointments.", authorId: AGENT, authorName: "Tom Reid" }],
  },
  {
    name: "Daniel Okafor", email: "d.okafor@example.com",
    location: "Bolton", treatmentInterest: "Invisalign",
    stage: "Contacted", status: "Active", ownerId: ADMIN,
  },
  {
    name: "Sophie Turner", email: "sophie.t@example.com", phone: "07700 900105",
    location: "Manchester", treatmentInterest: "Veneers",
    stage: "Consult Booked", status: "Active", ownerId: AGENT,
    notes: [{ body: "Consult booked for Thursday 3pm.", authorId: AGENT, authorName: "Tom Reid" }],
  },
  {
    name: "Harold Finch", phone: "07700 900106",
    location: "Rochdale", treatmentInterest: "Dentures",
    stage: "Consult Booked", status: "Active", ownerId: AGENT,
  },
  {
    name: "Yasmin Ali", email: "yasmin.ali@example.com", phone: "07700 900107",
    location: "Oldham", treatmentInterest: "Dental implants",
    stage: "Treatment Planned", status: "Active", ownerId: AGENT,
    notes: [{ body: "Treatment plan sent, waiting on finance approval.", authorId: ADMIN, authorName: "Priya Shah" }],
  },
  {
    name: "George Whitfield", phone: "07700 900108",
    location: "Bury", treatmentInterest: "Crowns",
    stage: "Treatment Planned", status: "Active", ownerId: ADMIN,
  },
  {
    name: "Nina Kowalski", email: "nina.k@example.com", phone: "07700 900109",
    location: "Manchester", treatmentInterest: "Invisalign",
    stage: "Won", status: "Active", ownerId: AGENT,
  },
  {
    // Finished treatment: kept on the record, off reception's working list.
    name: "Robert Grange", email: "r.grange@example.com", phone: "07700 900110",
    location: "Trafford", treatmentInterest: "Dental implants",
    stage: "Won", status: "Archived", ownerId: AGENT,
    notes: [{ body: "Implant treatment completed. Archived.", authorId: ADMIN, authorName: "Priya Shah" }],
  },
  {
    name: "Chloe Fraser", email: "chloe.fraser@example.com",
    location: "Wigan", treatmentInterest: "Teeth whitening",
    stage: "Lost", status: "Active", ownerId: AGENT,
    notes: [{ body: "Went with a cheaper quote elsewhere.", authorId: AGENT, authorName: "Tom Reid" }],
  },
  {
    // Cold and filed away.
    name: "Peter Nkemelu", phone: "07700 900112",
    location: "Manchester", treatmentInterest: "Hygiene",
    stage: "Lost", status: "Archived", ownerId: AGENT,
  },
];

async function seed() {
  await connectToDatabase();

  // Safe to run twice: match on the name and update in place, so a re-run
  // during a demo resets the data rather than duplicating every patient.
  const result = await Lead.bulkWrite(
    LEADS.map((lead) => ({
      updateOne: {
        filter: { name: lead.name },
        // Mongoose types $set against the hydrated document, whose `notes` is
        // a DocumentArray that plain seed data cannot be. The data is checked
        // by SeedLead above; this cast is only about the driver's shape.
        update: { $set: { notes: [], ...lead } } as unknown as mongoose.UpdateQuery<LeadDoc>,
        upsert: true,
      },
    })),
  );

  const byStage = await Lead.aggregate<{ _id: string; count: number }>([
    { $group: { _id: "$stage", count: { $sum: 1 } } },
    { $sort: { _id: 1 } },
  ]);

  console.log(
    `seeded ${LEADS.length} leads (${result.upsertedCount} new, ${result.modifiedCount} updated)`,
  );
  console.table(byStage);
  console.log(`total leads in collection: ${await Lead.countDocuments()}`);

  await mongoose.disconnect();
}

seed().catch((error) => {
  console.error(error);
  process.exit(1);
});
