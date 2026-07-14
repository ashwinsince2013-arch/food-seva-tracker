const express = require("express");
const User = require("../models/User");

const router = express.Router();

router.get("/users", async (req, res) => {
  try {
    const users = await User.find().sort({ _id: -1 });
    res.json(users);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.put("/users/:email", async (req, res) => {
  try {
    const email = req.params.email.toLowerCase();
    const user = await User.findOneAndUpdate(
      { email },
      req.body,
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

router.delete("/users/:email", async (req, res) => {
  try {
    const email = req.params.email.toLowerCase();
    const user = await User.findOneAndDelete({ email });

    if (!user) {
      return res.status(404).json({ message: "User not found." });
    }

    res.json({ message: "User deleted successfully." });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
