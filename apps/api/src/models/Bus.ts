
import { Schema, model } from "mongoose";

const busSchema = new Schema(
  {
    busNumber: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      uppercase: true
    },
    registrationNumber: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      uppercase: true
    },
    capacity: { type: Number, min: 1 },
    assignedDriverId: {
      type: Schema.Types.ObjectId,
      ref: "User"
    },
    assignedRouteId: {
      type: Schema.Types.ObjectId,
      ref: "Route"
    },
    active: { type: Boolean, default: true }
  },
  { timestamps: true }
);

export default model("Bus", busSchema);
