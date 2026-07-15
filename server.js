require("dotenv").config();
const mongoose = require("mongoose");
const app = require("./app");

const PORT = process.env.PORT || 3000;
const MONGO_URI = process.env.MONGO_URI || process.env.MONGODB_URI;

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

async function ensureSeedAdmin(User) {
  const adminEmail = "akrwins@gmail.com";
  const existing = await User.findOne({ email: adminEmail });
  if (!existing) {
    await User.create(seedUser());
  }
}

async function start() {
  try {
    if (!MONGO_URI) {
      throw new Error("Missing MONGO_URI or MONGODB_URI in environment.");
    }

    await mongoose.connect(MONGO_URI);
    console.log("Connected to MongoDB");

    const User = require("./models/User");
    await ensureSeedAdmin(User);

    app.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
    });
  } catch (err) {
    console.error("Server failed to start:", err.message);
    process.exit(1);
  }
}

start();
