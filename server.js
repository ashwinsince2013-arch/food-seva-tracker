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

/**
 * USER MODEL
 */
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

/**
 * JOB MODEL (for Book Time)
 */
const participantSchema = new mongoose.Schema(
  {
    email: { type: String, required: true },
    name: { type: String, required: true },
    date: { type: String, required: true },      // YYYY-MM-DD
    startTime: { type: String, required: true }, // HH:MM
    endTime: { type: String, required: true },   // HH:MM
    kc: { type: Number, required: true }
  },
  { _id: false }
);

const jobSchema = new mongoose.Schema(
  {
    title: { type: String, required: true },
    description: { type: String, default: "" },
    startDate: { type: String, required: true }, // YYYY-MM-DD
    endDate: { type: String, required: true },   // YYYY-MM-DD
    startTime: { type: String, required: true }, // HH:MM
    endTime: { type: String, required: true },   // HH:MM
    spotsTotal: { type: Number, required: true },
    spotsTaken: { type: Number, default: 0 },
    participants: { type: [participantSchema], default: [] },
    createdBy: { type: String, required: true } // admin email
  },
  { versionKey: false }
);

const Job = mongoose.model("Job", jobSchema);

/**
 * AUTH HELPERS
 */
async function signupHandler(req, res) {
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
}

async function loginHandler(req, res) {
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
}

/**
 * BASIC ROUTES (existing)
 */
app.post("/auth/signup", signupHandler);
app.post("/auth/login", loginHandler);
app.post("/api/auth/signup", signupHandler);
app.post("/api/auth/login", loginHandler);

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

/**
 * JOBS ROUTES (Book Time)
 */

// Get all jobs (front-end will filter past ones and sort)
app.get("/api/jobs", async (req, res) => {
  try {
    const jobs = await Job.find().lean();
    res.json(jobs);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Create a job (admin creates Book Time slot)
app.post("/api/jobs", async (req, res) => {
  try {
    const {
      title,
      description,
      startDate,
      endDate,
      startTime,
      endTime,
      spotsTotal,
      createdBy
    } = req.body;

    if (!title || !startDate || !endDate || !startTime || !endTime || !spotsTotal || !createdBy) {
      return res.status(400).json({ message: "Missing required fields." });
    }

    const creator = await User.findOne({ email: String(createdBy).trim().toLowerCase() });
    if (!creator || !creator.admin) {
      return res.status(403).json({ message: "Only admins can create jobs." });
    }

    const job = await Job.create({
      title: String(title).trim(),
      description: String(description || "").trim(),
      startDate,
      endDate,
      startTime,
      endTime,
      spotsTotal: Number(spotsTotal),
      spotsTaken: 0,
      participants: [],
      createdBy: creator.email
    });

    res.json(job);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Helper to compute minutes from HH:MM
function toMinutes(time) {
  const [hh, mm] = String(time || "").split(":").map(Number);
  if (Number.isNaN(hh) || Number.isNaN(mm)) return 0;
  return hh * 60 + mm;
}

// Apply for a job (member booking a spot)
app.post("/api/jobs/:id/apply", async (req, res) => {
  try {
    const jobId = req.params.id;
    const { email, name, date, startTime, endTime } = req.body;

    if (!email || !name || !date || !startTime || !endTime) {
      return res.status(400).json({ message: "Missing required fields." });
    }

    const cleanEmail = String(email).trim().toLowerCase();

    const user = await User.findOne({ email: cleanEmail });
    if (!user) {
      return res.status(404).json({ message: "User not found." });
    }

    const job = await Job.findById(jobId);
    if (!job) {
      return res.status(404).json({ message: "Job not found." });
    }

    // Validate date within job date range
    if (date < job.startDate || date > job.endDate) {
      return res.status(400).json({ message: "Selected date is not allowed for this job." });
    }

    // Validate spots
    const spotsLeft = job.spotsTotal - job.spotsTaken;
    if (spotsLeft <= 0) {
      return res.status(400).json({ message: "No spots left for this job." });
    }

    // Time & KC calculation (same as before)
    const startMinutes = toMinutes(startTime);
    const endMinutes = toMinutes(endTime);
    if (endMinutes <= startMinutes) {
      return res.status(400).json({ message: "End time must be after start time." });
    }

    const minutes = endMinutes - startMinutes;
    if (minutes <= 10) {
      return res.status(400).json({ message: "Time must be more than 10 minutes." });
    }

    const hours = minutes / 60;
    const kcRaw = Math.round(hours * 2) / 2; // round to nearest 0.5
    const kc = Number(kcRaw.toFixed(1));

    // Add participant to job
    job.participants.push({
      email: cleanEmail,
      name: String(name).trim(),
      date,
      startTime,
      endTime,
      kc
    });
    job.spotsTaken += 1;
    await job.save();

    // Update user KC and logs
    user.kc = Number((user.kc + kc).toFixed(1));
    user.logs.unshift({ date, start: startTime, end: endTime, kc: kc.toFixed(1), jobTitle: job.title });
    user.history.unshift(`Booked ${kc.toFixed(1)} KC for ${job.title} on ${date}`);
    await user.save();

    res.json({ job, user });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Delete a job (admin only)
app.delete("/api/jobs/:id", async (req, res) => {
  try {
    const jobId = req.params.id;
    const { email } = req.body || {};

    if (!email) {
      return res.status(400).json({ message: "Missing admin email." });
    }

    const cleanEmail = String(email).trim().toLowerCase();
    const adminUser = await User.findOne({ email: cleanEmail });

    if (!adminUser || !adminUser.admin) {
      return res.status(403).json({ message: "Only admins can delete jobs." });
    }

    const job = await Job.findByIdAndDelete(jobId);
    if (!job) {
      return res.status(404).json({ message: "Job not found." });
    }

    res.json({ message: "Job deleted." });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

/**
 * STATIC FILES
 */
const publicDir = path.join(__dirname);
app.use(express.static(publicDir));

app.all("/{*splat}", (req, res) => {
  res.sendFile(path.join(publicDir, "index.html"));
});

async function start() {
  try {
    if (!MONGO_URI) {
      throw new Error("Missing MONGO_URI or MONGODB_URI in environment.");
    }

    await mongoose.connect(MONGO_URI);
    await ensureSeedAdmin();

    app.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
    });
  } catch (err) {
    console.error("Server failed to start:", err.message);
    process.exit(1);
  }
}

start();
