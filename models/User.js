const mongoose = require("mongoose");

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    admin: { type: Boolean, default: false },
    kc: { type: Number, default: 0 },
    vouchers: {
      Food: { type: Number, default: 0 },
      Books: { type: Number, default: 0 },
      Karma: { type: Number, default: 0 }
    },
    logs: { type: [Object], default: [] },
    history: { type: [String], default: [] }
  },
  { versionKey: false }
);

module.exports = mongoose.model("User", userSchema);
