
import { Schema, model } from "mongoose";

const userSchema = new Schema(
  {
    collegeId: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      uppercase: true,
    },

    username: {
      type: String,
      trim: true,
      uppercase: true,
      sparse: true,
      unique: true,
    },

    name: {
      type: String,
      required: true,
      trim: true,
    },

    department: {
      type: String,
      trim: true,
    },

    year: {
      type: String,
      trim: true,
    },

    phone: {
      type: String,
      trim: true,
      sparse: true,
    },

    passwordHash: {
      type: String,
      required: true,
      select: false,
    },

    role: {
      type: String,
      enum: ["student", "driver", "admin"],
      required: true,
    },

    assignedRouteId: {
      type: Schema.Types.ObjectId,
      ref: "Route",
    },

    assignedBusId: {
      type: Schema.Types.ObjectId,
      ref: "Bus",
    },

    active: {
      type: Boolean,
      default: true,
    },
  },
  { timestamps: true },
);

export default model("User", userSchema);
