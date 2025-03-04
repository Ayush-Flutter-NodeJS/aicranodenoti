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
  host: "195.35.47.198",
  user: "u919956999_gaisarootUser",
  password: "KUni/L0b#",
  database: "u919956999_gaisa_app_db",
});

// ✅ Handle Database Connection Errors
db.on("error", (err) => {
  console.error("❌ Database Error:", err);
});

// ✅ User Authentication (Login or Register) with FCM Token
app.post("/auth", (req, res) => {
  const {
    email,
    name,
    phone,
    designation,
    address,
    company,
    country,
    state,
    city,
    fcm_token,
  } = req.body;

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

      db.query(
        insertUserSQL,
        [name, email, phone, designation, address, company, country, state, city, fcm_token],
        (err, result) => {
          if (err) return res.status(500).json({ success: false, message: err.message });

          // ✅ Fetch the newly inserted user
          db.query("SELECT * FROM ai_ticket_payment WHERE id = ?", [result.insertId], (err, newUser) => {
            if (err) return res.status(500).json({ success: false, message: err.message });

            res.json({ success: true, message: "User registered successfully!", user: newUser[0] });
          });
        }
      );
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

// ✅ Fetch All Speakers
app.get("/speakers", (req, res) => {
  const fetchSpeakersSQL = "SELECT * FROM tbl_speakers"; // Ensure your table 'speakers' exists
  db.query(fetchSpeakersSQL, (err, results) => {
    if (err) return res.status(500).json({ success: false, message: err.message });
    res.json(results);
  });
});

// ✅ Fetch All Countries
app.get("/countries", (req, res) => {
  const fetchCountriesSQL = "SELECT * FROM bird_countries"; // Ensure your table 'countries' exists
  db.query(fetchCountriesSQL, (err, results) => {
    if (err) return res.status(500).json({ success: false, message: err.message });
    res.json({ success: true, countries: results });
  });
});

// ✅ Fetch States by Country ID
app.get("/states/:countryId", (req, res) => {
  const { countryId } = req.params;
  const fetchStatesSQL = "SELECT * FROM bird_states WHERE countryId = ?"; // Ensure 'states' table has 'country_id' column
  db.query(fetchStatesSQL, [countryId], (err, results) => {
    if (err) return res.status(500).json({ success: false, message: err.message });
    res.json({ success: true, states: results });
  });
});

// ✅ Fetch Cities by State ID
app.get("/cities/:stateId", (req, res) => {
  const { stateId } = req.params;
  const fetchCitiesSQL = "SELECT * FROM bird_cities WHERE stateId = ?"; // Ensure 'cities' table has 'state_id' column
  db.query(fetchCitiesSQL, [stateId], (err, results) => {
    if (err) return res.status(500).json({ success: false, message: err.message });
    res.json({ success: true, cities: results });
  });
});

// ✅ Start Server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});
