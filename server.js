const express = require("express");
const mysql = require("mysql2/promise"); // ✅ Use promise-based MySQL
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

    if (!email) return res.status(400).json({ success: false, message: "Email is required" });

    email = email.trim().toLowerCase();
    const checkUserSQL = "SELECT * FROM ai_ticket_payment WHERE LOWER(email) = ?";
    const [existingUsers] = await db.query(checkUserSQL, [email]);

    if (existingUsers.length > 0) {
      return res.json({ success: true, user: existingUsers[0], message: "Login successful." });
    }

    if (!name || !mobile || !designation || !address || !company || !country || !state || !city) {
      return res.status(400).json({ success: false, message: "All fields are required for registration" });
    }

    const insertUserSQL = `
      INSERT INTO ai_ticket_payment (name, email, mobile, designation, address, company, country, state, city, fcm_token, status, amount, payumoney, date) 
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, '0', '', NOW()) 
    `;

    const [result] = await db.query(insertUserSQL, [name, email, mobile, designation, address, company, country, state, city, fcm_token]);
    const [newUser] = await db.query("SELECT * FROM ai_ticket_payment WHERE id = ?", [result.insertId]);

    res.json({ success: true, message: "User registered successfully!", user: newUser[0] });
  } catch (error) {
    console.error("Auth error:", error);
    res.status(500).json({ success: false, message: "Internal Server Error" });
  }
});

// ✅ Update Payment Status
app.post("/payment-success", async (req, res) => {
  const { payumoney, amount } = req.body;

  if (!payumoney || !amount) {
    return res.status(400).json({ success: false, message: "Transaction ID and Amount are required" });
  }

  try {
    // ✅ Check if payment already exists
    const checkPaymentSQL = "SELECT * FROM ai_ticket_payment WHERE payumoney = ?";
    const [existingPayments] = await db.query(checkPaymentSQL, [payumoney]);

    if (existingPayments.length > 0) {
      return res.status(400).json({ success: false, message: "Payment already recorded" });
    }

    // ✅ Update latest unpaid user
    const updateSQL = `
      UPDATE ai_ticket_payment 
      SET status = 1, payumoney = ?, amount = ? 
      WHERE email = (SELECT email FROM ai_ticket_payment WHERE status = 0 ORDER BY id DESC LIMIT 1)
    `;

    const [result] = await db.query(updateSQL, [payumoney, amount]);

    if (result.affectedRows === 0) {
      return res.status(404).json({ success: false, message: "No pending payment found" });
    }

    res.json({ success: true, message: "Payment updated successfully!" });
  } catch (error) {
    console.error("Payment update error:", error);
    res.status(500).json({ success: false, message: "Internal Server Error" });
  }
});

// ✅ Fetch All Registered Users
app.get("/users", async (req, res) => {
  try {
    const fetchUsersSQL = "SELECT id, name, designation, company, fcm_token FROM ai_ticket_payment";
    const [users] = await db.query(fetchUsersSQL);
    res.json({ success: true, users });
  } catch (error) {
    console.error("Fetch users error:", error);
    res.status(500).json({ success: false, message: "Error fetching users" });
  }
});

// ✅ Fetch All Speakers
app.get("/speakers", async (req, res) => {
  try {
    const fetchSpeakersSQL = "SELECT * FROM tbl_speakers";
    const [speakers] = await db.query(fetchSpeakersSQL);
    res.json({ success: true, speakers });
  } catch (error) {
    console.error("Fetch speakers error:", error);
    res.status(500).json({ success: false, message: "Error fetching speakers" });
  }
});

// ✅ Fetch All Countries
app.get("/countries", async (req, res) => {
  try {
    const fetchCountriesSQL = "SELECT * FROM bird_countries";
    const [countries] = await db.query(fetchCountriesSQL);
    res.json({ success: true, countries });
  } catch (error) {
    console.error("Fetch countries error:", error);
    res.status(500).json({ success: false, message: "Error fetching countries" });
  }
});

// ✅ Fetch States by Country ID
app.get("/states/:countryId", async (req, res) => {
  try {
    const { countryId } = req.params;
    const fetchStatesSQL = "SELECT * FROM bird_states WHERE countryId = ?";
    const [states] = await db.query(fetchStatesSQL, [countryId]);
    res.json({ success: true, states });
  } catch (error) {
    console.error("Fetch states error:", error);
    res.status(500).json({ success: false, message: "Error fetching states" });
  }
});

// ✅ Fetch Cities by State ID
app.get("/cities/:stateId", async (req, res) => {
  try {
    const { stateId } = req.params;
    const fetchCitiesSQL = "SELECT * FROM bird_cities WHERE state_id = ?";
    const [cities] = await db.query(fetchCitiesSQL, [stateId]);
    res.json({ success: true, cities });
  } catch (error) {
    console.error("Fetch cities error:", error);
    res.status(500).json({ success: false, message: "Error fetching cities" });
  }
});

// ✅ Start Server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});
