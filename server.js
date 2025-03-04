const express = require("express");
const mysql = require("mysql");
const cors = require("cors");
const bodyParser = require("body-parser");

const app = express();
app.use(cors());
app.use(bodyParser.json());

// ✅ Database Connection Pool (Better Performance & Auto-Reconnect)
const db = mysql.createPool({
  connectionLimit: 10, // Number of concurrent connections
  host: "mysql.hostinger.com",
  user: "u919956999_gaisarootUser",
  password: "KUni/L0b#",
  database:"u919956999_gaisa_app_db",
});

// ✅ Handle Database Connection Errors
db.on("error", (err) => {
  console.error("❌ Database Error:", err);
});

// ✅ User Authentication (Login or Register) with FCM Token
app.post("/auth", (req, res) => {
  const { email, name, phone, designation, address, company, country, state, city, fcm_token } = req.body;

  if (!email) {
    return res.status(400).json({ success: false, message: "Email is required" });
  }

  // Check if user exists in `ai_ticket_payment`
  const checkUserSQL = "SELECT * FROM ai_ticket_payment WHERE email = ?";
  db.query(checkUserSQL, [email], (err, results) => {
    if (err) return res.status(500).json({ success: false, message: err.message });

    if (results.length > 0) {
      // ✅ User exists, update FCM token
      const updateFCMSQL = "UPDATE ai_ticket_payment SET fcm_token = ? WHERE email = ?";
      db.query(updateFCMSQL, [fcm_token, email], (err) => {
        if (err) return res.status(500).json({ success: false, message: err.message });

        return res.json({ success: true, user: results[0], message: "Login successful, FCM token updated." });
      });
    } else {
      // ❌ User not found, proceed with registration
      if (!name || !phone || !designation || !address || !company || !country || !state || !city) {
        return res.status(400).json({ success: false, message: "All fields are required for registration" });
      }

      // ✅ Insert new user
      const insertUserSQL = `
        INSERT INTO ai_ticket_payment (name, email, mobile, designation, address, company, country, state, city, fcm_token, status, date) 
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, NOW())
      `;

      db.query(insertUserSQL, [name, email, phone, designation, address, company, country, state, city, fcm_token], (err, result) => {
        if (err) return res.status(500).json({ success: false, message: err.message });

        // ✅ Fetch the newly inserted user
        db.query("SELECT * FROM ai_ticket_payment WHERE id = ?", [result.insertId], (err, newUser) => {
          if (err) return res.status(500).json({ success: false, message: err.message });

          res.json({ success: true, message: "User registered successfully!", user: newUser[0] });
        });
      });
    }
  });
});

// ✅ Fetch All Registered Users
app.get("/users", (req, res) => {
  const fetchUsersSQL = "SELECT id, name, designation, company, fcm_token FROM ai_ticket_payment";

  db.query(fetchUsersSQL, (err, results) => {
    if (err) return res.status(500).json({ success: false, message: err.message });

    res.json({ success: true, users: results });
  });
});

// ✅ Start Server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});
