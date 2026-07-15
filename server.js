require("dotenv").config();
const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const path = require("path");

const app = express();
const PORT = process.env.PORT || 3000;
const MONGO_URI = process.env.MONGO_URI || process.env.MONGODB_URI;

app.use(cors());
app.use(express.json());

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

const User = mongoose.model("User", userSchema);

function seedUser() {
  return {
    name: "Arunkumar Rajasekar",
    email: "akrwins@gmail.com",
    password: "AshwinKumar123",
    admin: true,
    kc: 0,
    vouchers: { Food: 0, Books: 0, Karma: 0 },
    logs: [],
    history: []
  };
}

async function ensureSeedAdmin() {
  const adminEmail = "akrwins@gmail.com";
  const existing = await User.findOne({ email: adminEmail });
  if (!existing) await User.create(seedUser());
}

app.post("/auth/signup", async (req, res) => {
  try {
    const { name, email, password, adminSeed } = req.body;
    const cleanEmail = String(email || "").trim().toLowerCase();

    if (!name || !cleanEmail || !password) {
      return res.status(400).json({ message: "Missing required fields." });
    }

    const existing = await User.findOne({ email: cleanEmail });
    if (existing) {
      return res.status(400).json({ message: "User already exists." });
    }

    const isAdminSeed =
      adminSeed &&
      adminSeed.email &&
      cleanEmail === String(adminSeed.email).trim().toLowerCase();

    const user = await User.create({
      name: String(name).trim(),
      email: cleanEmail,
      password,
      admin: !!isAdminSeed,
      kc: 0,
      vouchers: { Food: 0, Books: 0, Karma: 0 },
      logs: [],
      history: []
    });

    res.json(user);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

app.post("/auth/login", async (req, res) => {
  try {
    const { name, email, password } = req.body;
    const cleanEmail = String(email || "").trim().toLowerCase();

    if (!name || !cleanEmail || !password) {
      return res.status(400).json({ message: "Missing required fields." });
    }

    const user = await User.findOne({ email: cleanEmail, password });

    if (!user) {
      return res.status(401).json({ message: "Invalid email or password." });
    }

    res.json(user);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

app.get("/api/users", async (req, res) => {
  try {
    const users = await User.find().lean();
    res.json(users);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

app.get("/api/app/users", async (req, res) => {
  try {
    const users = await User.find().lean();
    res.json(users);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

app.put("/api/app/users/:email", async (req, res) => {
  try {
    const email = decodeURIComponent(req.params.email).toLowerCase();
    const updated = req.body;

    const user = await User.findOneAndUpdate(
      { email },
      { $set: updated },
      { new: true, runValidators: true }
    );

    if (!user) return res.status(404).json({ message: "User not found." });

    res.json(user);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

app.delete("/api/app/users/:email", async (req, res) => {
  try {
    const email = decodeURIComponent(req.params.email).toLowerCase();
    const user = await User.findOneAndDelete({ email });

    if (!user) return res.status(404).json({ message: "User not found." });

    res.json({ message: "User deleted." });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

const publicDir = path.join(__dirname);
app.use(express.static(publicDir));

app.all("/{*splat}", (req, res) => {
  res.sendFile(path.join(publicDir, "index
