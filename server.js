require("dotenv").config();
const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const path = require("path");

const app = express();
const PORT = process.env.PORT || 3000;
const MONGO_URI = process.env.MONGO_URI || process.env.MONGODB_URI;

// Middleware
app.use(cors());
app.use(express.json());

// MongoDB Model
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

// Helpers
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
  if (!existing) {
    await User.create(seedUser());
  }
}

// Connect to Mongo
async function start() {
  try {
    if (!MONGO_URI) {
      throw new Error("Missing MONGO_URI or MONGODB_URI in environment.");
    }

    await mongoose.connect(MONGO_URI);
    console.log("Connected to MongoDB");

    await ensureSeedAdmin();

    // Auth routes
    const authRouter = require("./auth");
    app.use("/auth", authRouter);

    // API: get all users
    app.get("/api/users", async (req, res) => {
      const users = await User.find().lean();
      res.json(users);
    });

    // API used by frontend: alias for members/login refresh
    app.get("/api/app/users", async (req, res) => {
      const users = await User.find().lean();
      res.json(users);
    });

    // Update user
    app.put("/api/app/users/:email", async (req, res) => {
      try {
        const email = decodeURIComponent(req.params.email).toLowerCase();
        const updated = req.body;

        const user = await User.findOneAndUpdate(
          { email },
          { $set: updated },
          { new: true, runValidators: true }
        );

        if (!user) {
          return res.status(404).json({ message: "User not found." });
        }

        res.json(user);
      } catch (err) {
        res.status(500).json({ message: err.message });
      }
    });

    // Delete user
    app.delete("/api/app/users/:email", async (req, res) => {
      try {
        const email = decodeURIComponent(req.params.email).toLowerCase();
        const user = await User.findOneAndDelete({ email });

        if (!user) {
          return res.status(404).json({ message: "User not found." });
        }

        res.json({ message: "User deleted." });
      } catch (err) {
        res.status(500).json({ message: err.message });
      }
    });

    // Serve frontend files if they exist in same repo
    const publicDir = path.join(__dirname);
    app.use(express.static(publicDir));

    app.get("*", (req, res) => {
      res.sendFile(path.join(publicDir, "index.html"));
    });

    app.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
    });
  } catch (err) {
    console.error("Server failed to start:", err.message);
    process.exit(1);
  }
}

start();
