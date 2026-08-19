import "server-only";
import mongoose, { Schema, type InferSchemaType, type Model } from "mongoose";
import { FUNNEL_STAGES, STAGES, STATUSES } from "./lead-enums";

// Long enough for any real name, town or treatment description; short enough
// that the field is not a place to paste an essay. Enforced here so the rule
// has one home — createLead() translates the resulting ValidationError.
export const FIELD_MAX = 200;

const noteSchema = new Schema({
  body: { type: String, required: true, trim: true },
  authorId: { type: String, required: true },
  authorName: { type: String, required: true },
  createdAt: { type: Date, default: Date.now },
});

const leadSchema = new Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: [FIELD_MAX, "Name is too long."] },
    // Contact details are optional: a lead often arrives with a phone number
    // and nothing else, and refusing to store that loses the lead.
    email: { type: String, trim: true, lowercase: true, maxlength: [FIELD_MAX, "Email is too long."] },
    phone: { type: String, trim: true, maxlength: [FIELD_MAX, "Phone is too long."] },
    // patient's home town, e.g. "Manchester"
    location: { type: String, trim: true, maxlength: [FIELD_MAX, "Location is too long."] },
    treatmentInterest: {
      type: String,
      trim: true,
      maxlength: [FIELD_MAX, "Treatment interest is too long."],
    },
    stage: { type: String, enum: [...STAGES], default: "New", required: true },
    // Setting a lead to Lost overwrites where it had got to, which made the
    // funnel unable to credit the stages it genuinely reached. Captured on the
    // way out so that history survives; null for anything not Lost.
    lostFromStage: { type: String, enum: [...FUNNEL_STAGES], default: null },
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
// lead. Runs on document validation (create/save). The row actions go through
// updateOne and never touch the contact fields, so createLead() is the write
// path this guards.
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
