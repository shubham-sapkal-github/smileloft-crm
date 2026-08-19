import "server-only";
import mongoose, { Schema, type InferSchemaType, type Model } from "mongoose";
import { STAGES, STATUSES } from "./lead-enums";

const noteSchema = new Schema({
  body: { type: String, required: true, trim: true },
  authorId: { type: String, required: true },
  authorName: { type: String, required: true },
  createdAt: { type: Date, default: Date.now },
});

const leadSchema = new Schema(
  {
    name: { type: String, required: true, trim: true },
    // Contact details are optional: a lead often arrives with a phone number
    // and nothing else, and refusing to store that loses the lead.
    email: { type: String, trim: true, lowercase: true },
    phone: { type: String, trim: true },
    location: { type: String, trim: true }, // patient's home town, e.g. "Manchester"
    treatmentInterest: { type: String, trim: true },
    stage: { type: String, enum: [...STAGES], default: "New", required: true },
    status: { type: String, enum: [...STATUSES], default: "Active", required: true },
    // TODO: plain string while users are hardcoded in src/lib/auth.ts. Becomes
    // { type: Schema.Types.ObjectId, ref: "User" } when real auth lands.
    // Indexed because every agent query filters on it.
    ownerId: { type: String, default: null, index: true },
    notes: { type: [noteSchema], default: [] },
  },
  { timestamps: true },
);

// A lead with no way to contact them can never be followed up, so it isn't a
// lead. Runs on document validation (create/save), which is every write path
// this spec has — the three row actions touch stage, owner and notes, never
// the contact fields.
leadSchema.pre("validate", function () {
  if (!this.email && !this.phone) {
    this.invalidate("phone", "A lead needs at least one of email or phone.");
  }
});

export type LeadDoc = InferSchemaType<typeof leadSchema>;

// Hot reload re-evaluates this module; re-registering a model throws.
export const Lead: Model<LeadDoc> =
  (mongoose.models.Lead as Model<LeadDoc>) ??
  mongoose.model<LeadDoc>("Lead", leadSchema);
