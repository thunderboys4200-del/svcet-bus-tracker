
import { Schema, model } from "mongoose";

const tripSchema = new Schema(
  {
    busId: {
      type: Schema.Types.ObjectId,
      ref: "Bus",
      required: true
    },
    driverId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true
    },
    routeId: {
      type: Schema.Types.ObjectId,
      ref: "Route",
      required: true
    },
    status: {
      type: String,
      enum: ["scheduled", "active", "completed", "cancelled"],
      default: "scheduled",
      required: true
    },
    startedAt: Date,
    endedAt: Date,
    lastLocationAt: Date,
    lastSequence: {
      type: Number,
      default: 0
    },

    // Most recently received GPS coordinates.
    // Coordinates use latitude/longitude, not GeoJSON order.
    currentLocation: {
      latitude: {
        type: Number,
        min: -90,
        max: 90
      },
      longitude: {
        type: Number,
        min: -180,
        max: 180
      },
      accuracy: {
        type: Number,
        min: 0
      },
      heading: {
        type: Number,
        min: 0,
        max: 360
      },
      speed: {
        type: Number,
        min: 0
      },
      recordedAt: Date
    }
  },
  { timestamps: true }
);

tripSchema.index({ busId: 1, status: 1 });
tripSchema.index({ driverId: 1, status: 1 });
tripSchema.index(
  { busId: 1 },
  { unique: true, partialFilterExpression: { status: "active" } },
);
tripSchema.index(
  { driverId: 1 },
  { unique: true, partialFilterExpression: { status: "active" } },
);

export default model("Trip", tripSchema);

