const express = require("express");
const mysql = require("mysql2/promise");
const cors = require("cors");

const app = express();
app.use(cors());
app.use(express.json());

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
    let { email, name, mobile, designation, address, company, country, state, city, fcm_token, pass_name } = req.body;
    if (!email) return res.status(400).json({ success: false, message: "Email is required" });

    email = email.trim().toLowerCase();
    const checkUserSQL = "SELECT * FROM ai_ticket_payment WHERE LOWER(email) = ?";
    const [existingUsers] = await db.query(checkUserSQL, [email]);

    if (existingUsers.length > 0) {
      await db.query("UPDATE ai_ticket_payment SET fcm_token = ? WHERE email = ?", [fcm_token, email]);
      return res.json({ success: true, user: existingUsers[0], message: "Login successful. Token updated." });
    }

    if (!name || !mobile || !designation || !address || !company || !country || !state || !city) {
      return res.status(400).json({ success: false, message: "All fields are required for registration" });
    }

    const insertUserSQL = `
      INSERT INTO ai_ticket_payment (name, email, mobile, designation, address, company, country, state, city, fcm_token, pass_name, status, amount, payumoney, date) 
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, 0, '', NOW()) 
    `;

    const [result] = await db.query(insertUserSQL, [name, email, mobile, designation, address, company, country, state, city, fcm_token, pass_name]);
    const [newUser] = await db.query("SELECT * FROM ai_ticket_payment WHERE id = ?", [result.insertId]);

    res.json({ success: true, message: "User registered successfully!", user: newUser[0] });
  } catch (error) {
    console.error("Auth error:", error);
    res.status(500).json({ success: false, message: "Internal Server Error" });
  }
});

// ✅ Check Payment & Pass Eligibility
app.get("/check-payment", async (req, res) => {
  try {
    const { email } = req.query;
    if (!email) return res.status(400).json({ success: false, message: "Email is required" });

    const checkPaymentSQL = "SELECT amount, payumoney, pass_name FROM ai_ticket_payment WHERE email = ?";
    const [payments] = await db.query(checkPaymentSQL, [email]);

    if (payments.length === 0) {
      return res.json({ success: false, message: "No payment found", showPass: false });
    }

    let { amount, payumoney, pass_name } = payments[0];

    // ❌ If amount is 0, do not show pass
    if (amount <= 0) {
      return res.json({ success: false, message: "No valid payment found", showPass: false });
    }

    // ✅ Determine Pass Eligibility
    let showPass = false;

    if (pass_name && pass_name.trim() !== "") {
      // If pass_name is already assigned, show pass
      showPass = true;
    } else {
      // If pass_name is empty, assign based on amount
      if (amount >= 11210) {
        pass_name = "Platinum Delegate Pass";
        showPass = true;
      } else if (amount >= 4130) {
        pass_name = "Gold Delegate Pass";
        showPass = true;
      }
    }

    return res.json({
      success: true,
      amount,
      payumoney,
      pass_name,
      showPass,
    });
  } catch (error) {
    console.error("Check payment error:", error);
    res.status(500).json({ success: false, message: "Internal Server Error" });
  }
});

// ✅ Update Payment Status
app.post("/payment-success", async (req, res) => {
  try {
    const { email, name, payumoney, amount, pass_name } = req.body;

    if ((!email && !name) || !payumoney || !amount) {
      return res.status(400).json({
        success: false,
        message: "Email or Name, Transaction ID, and Amount are required",
      });
    }

    const checkPaymentSQL = "SELECT COUNT(*) AS count FROM ai_ticket_payment WHERE payumoney = ?";
    const [existingPayments] = await db.query(checkPaymentSQL, [payumoney]);

    if (existingPayments[0].count > 0) {
      return res.status(400).json({ success: false, message: "Payment already recorded" });
    }

    // If pass_name is empty, assign based on amount
    let finalPassName = pass_name;
    if (!pass_name || pass_name.trim() === "") {
      if (amount >= 11210) {
        finalPassName = "Platinum Delegate Pass";
      } else if (amount >= 4130) {
        finalPassName = "Gold Delegate Pass";
      }
    }

    let updateSQL = `
      UPDATE ai_ticket_payment 
      SET status = 1, payumoney = ?, amount = ?, pass_name = ?
      WHERE (email = ? OR name = ?)
    `;

    const [result] = await db.query(updateSQL, [payumoney, amount, finalPassName, email || "", name || ""]);

    if (result.affectedRows === 0) {
      return res.status(404).json({ success: false, message: "User not found or already paid" });
    }

    res.json({ success: true, message: "Payment updated successfully!", pass_name: finalPassName });
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

// ✅ Start Server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});
