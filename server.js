const express = require("express");
const mysql = require("mysql");
const cors = require("cors");
const bodyParser = require("body-parser");

const app = express();
app.use(cors());
app.use(bodyParser.json());

// ✅ Database Connection Pool
const db = mysql.createPool({
  connectionLimit: 10,
  host: "195.35.47.198",
  user: "u919956999_gaisarootUser",
  password: "KUni/L0b#",
  database: "u919956999_gaisa_app_db",
});

// ✅ User Authentication (Login/Register)
app.post("/auth", async (req, res) => {
  try {
    let { email, name, mobile, designation, address, company, country, state, city, fcm_token } = req.body;

    if (!email) {
      return res.status(400).json({ success: false, message: "Email is required" });
    }

    email = email.trim().toLowerCase();
    const checkUserSQL = "SELECT * FROM ai_ticket_payment WHERE LOWER(email) = ?";

    db.query(checkUserSQL, [email], (err, results) => {
      if (err) {
        console.error("Query error:", err);
        return res.status(500).json({ success: false, message: "Database error" });
      }

      if (results.length > 0) {
        return res.json({ success: true, user: results[0], message: "Login successful." });
      } else {
        if (!name || !mobile || !designation || !address || !company || !country || !state || !city) {
          return res.status(400).json({ success: false, message: "All fields are required for registration" });
        }

        const insertUserSQL = `
          INSERT INTO ai_ticket_payment (name, email, mobile, designation, address, company, country, state, city, fcm_token, status, amount, payumoney, date) 
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, '0', '', NOW()) 
        `;

        db.query(insertUserSQL, [name, email, mobile, designation, address, company, country, state, city, fcm_token], (err, result) => {
          if (err) {
            console.error("Insert error:", err);
            return res.status(500).json({ success: false, message: "Error registering user" });
          }

          db.query("SELECT * FROM ai_ticket_payment WHERE id = ?", [result.insertId], (err, newUser) => {
            if (err) {
              console.error("Fetch new user error:", err);
              return res.status(500).json({ success: false, message: "Error fetching new user" });
            }
            res.json({ success: true, message: "User registered successfully!", user: newUser[0] });
          });
        });
      }
    });
  } catch (err) {
    console.error("Unexpected error:", err);
    res.status(500).json({ success: false, message: "Internal Server Error" });
  }
});

// ✅ Update Payment Status (without email)
app.post("/payment-success", async (req, res) => {
  const { transaction_id, amount } = req.body;

  if (!transaction_id || !amount) {
    return res.status(400).json({ success: false, message: "Transaction ID and Amount are required" });
  }

  try {
    const updateSQL = `
      UPDATE ai_ticket_payment 
      SET status = 1, payumoney = ?, amount = ? 
      WHERE id = (SELECT id FROM ai_ticket_payment ORDER BY id DESC LIMIT 1)
    `;

    db.query(updateSQL, [transaction_id, amount], (err, result) => {
      if (err) {
        console.error("Payment update error:", err);
        return res.status(500).json({ success: false, message: "Error updating payment details" });
      }

      if (result.affectedRows === 0) {
        return res.status(404).json({ success: false, message: "No pending payment found" });
      }

      res.json({ success: true, message: "Payment updated successfully!" });
    });
  } catch (error) {
    console.error("Unexpected error:", error);
    res.status(500).json({ success: false, message: "Internal Server Error" });
  }
});

// ✅ Fetch All Registered Users
app.get("/users", (req, res) => {
  const fetchUsersSQL = "SELECT id, name, designation, company, fcm_token FROM ai_ticket_payment";
  db.query(fetchUsersSQL, (err, results) => {
    if (err) {
      console.error("Fetch users error:", err);
      return res.status(500).json({ success: false, message: "Error fetching users" });
    }
    res.json({ success: true, users: results });
  });
});

// ✅ Fetch All Speakers
app.get("/speakers", (req, res) => {
  const fetchSpeakersSQL = "SELECT * FROM tbl_speakers";
  db.query(fetchSpeakersSQL, (err, results) => {
    if (err) {
      console.error("Fetch speakers error:", err);
      return res.status(500).json({ success: false, message: "Error fetching speakers" });
    }
    res.json({ success: true, speakers: results });
  });
});

// ✅ Fetch All Countries
app.get("/countries", (req, res) => {
  const fetchCountriesSQL = "SELECT * FROM bird_countries";
  db.query(fetchCountriesSQL, (err, results) => {
    if (err) {
      console.error("Fetch countries error:", err);
      return res.status(500).json({ success: false, message: "Error fetching countries" });
    }
    res.json({ success: true, countries: results });
  });
});

// ✅ Fetch States by Country ID
app.get("/states/:countryId", (req, res) => {
  const { countryId } = req.params;
  const fetchStatesSQL = "SELECT * FROM bird_states WHERE countryId = ?";
  db.query(fetchStatesSQL, [countryId], (err, results) => {
    if (err) {
      console.error("Fetch states error:", err);
      return res.status(500).json({ success: false, message: "Error fetching states" });
    }
    res.json({ success: true, states: results });
  });
});

// ✅ Fetch Cities by State ID
app.get("/cities/:stateId", (req, res) => {
  const { stateId } = req.params;
  const fetchCitiesSQL = "SELECT * FROM bird_cities WHERE state_id = ?";
  db.query(fetchCitiesSQL, [stateId], (err, results) => {
    if (err) {
      console.error("Fetch cities error:", err);
      return res.status(500).json({ success: false, message: "Error fetching cities" });
    }
    res.json({ success: true, cities: results });
  });
});

// ✅ Start Server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});
