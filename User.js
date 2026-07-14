const mongoose = require("mongoose");

const LogSchema = new mongoose.Schema(
  {
    date: { type: String, required: true },
    start: { type: String, required: true },
    end: { type: String, required: true },
    kc: { type: String, required: true }
  },
  { _id: false }
);

const UserSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, unique: true, required: true, lowercase: true },
  password: { type: String, required: true },
  admin: { type: Boolean, default: false },
  kc: { type: Number, default: 0 },
  vouchers: {
    Food: { type: Number, default: 0 },
    Books: { type: Number, default: 0 },
    Karma: { type: Number, default: 0 }
  },
  logs: { type: [LogSchema], default: [] },
  history: { type: [String], default: [] }
});

module.exports = mongoose.model("User", UserSchema);
