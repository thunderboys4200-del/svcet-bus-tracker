
import { Schema, model } from "mongoose";

const routeSchema = new Schema(
  {
    name: { type: String, required: true, trim: true },
    code: {
      type: String,
      required: true,
      unique: true,
      uppercase: true,
      trim: true
    },
    description: { type: String, trim: true },
    stops: [{
      stopId: {
        type: Schema.Types.ObjectId,
        ref: "Stop",
        required: true
      },
      sequence: { type: Number, required: true, min: 1 }
    }],
    geometry: {
      type: [[Number]],
      default: []
    },
    active: { type: Boolean, default: true }
  },
  { timestamps: true }
);

export default model("Route", routeSchema);
