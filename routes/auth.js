const express = require("express");
const router = express.Router();
const User = require("./models/User");

router.post("/signup", async (req, res) => {
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

    return res.json(user);
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
});

router.post("/login", async (req, res) => {
  try {
    const { name, email, password } = req.body;
    const cleanEmail = String(email || "").trim().toLowerCase();

    if (!name || !cleanEmail || !password) {
      return res.status(400).json({ message: "Missing required fields." });
    }

    const user = await User.findOne({
      email: cleanEmail,
      password
    });

    if (!user) {
      return res.status(401).json({ message: "Invalid email or password." });
    }

    return res.json(user);
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
});

module.exports = router;
