
import { Schema, model } from "mongoose";

const stopSchema = new Schema(
  {
    name: { type: String, required: true, trim: true },
    code: { type: String, trim: true, uppercase: true },
    address: { type: String, trim: true },
    landmark: { type: String, trim: true },
    latitude: { type: Number, required: true, min: -90, max: 90 },
    longitude: { type: Number, required: true, min: -180, max: 180 },
    active: { type: Boolean, default: true }
  },
  { timestamps: true }
);

stopSchema.index({ latitude: 1, longitude: 1 });

export default model("Stop", stopSchema);
