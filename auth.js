const express = require("express");
const User = require("../models/User");

const router = express.Router();

router.post("/signup", async (req, res) => {
  try {
    const { name, email, password, adminSeed } = req.body;
    const existing = await User.findOne({ email });

    if (existing) return res.status(400).json({ message: "Account already exists." });

    const admin = adminSeed && email.toLowerCase() === adminSeed.email.toLowerCase() && password === adminSeed.password;

    const user = await User.create({
      name,
      email,
      password,
      admin
    });

    res.json(user);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.post("/login", async (req, res) => {
  try {
    const { name, email, password } = req.body;
    const user = await User.findOne({ email });

    if (!user) return res.status(404).json({ message: "No account found." });
    if (user.name.toLowerCase() !== name.toLowerCase()) return res.status(400).json({ message: "Name does not match." });
    if (user.password !== password) return res.status(400).json({ message: "Wrong password." });

    res.json(user);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
