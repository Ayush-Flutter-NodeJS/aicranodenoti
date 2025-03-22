const express = require("express");
const mysql = require("mysql2/promise"); // ✅ Use promise-based MySQL
const Razorpay = require("razorpay");
const crypto = require("crypto");
const cors = require("cors");

const app = express();
app.use(cors());
app.use(express.json()); // ✅ Use built-in JSON parsing

// ✅ Database Connection Pool
const db = mysql.createPool({
  connectionLimit: 10,
  host: "195.35.47.198",
  user: "u919956999_gaisarootUser",
  password: "KUni/L0b#",
  database: "u919956999_gaisa_app_db",
});

// ✅ Initialize Razorpay
const razorpay = new Razorpay({
  key_id: "rzp_live_vOWkG1W1TBWQ1H", // Use live keys
  key_secret: "BXmaeiUMUE10pIb4GUIlMuwb", // Replace with actual key secret
});

// ✅ Create Order (Razorpay)
app.post("/create-order", async (req, res) => {
  try {
    const { amount, currency = "INR", receipt } = req.body;

    const options = {
      amount: amount,
      currency,
      receipt,
      payment_capture: 1, // Auto-capture payment
    };

    const order = await razorpay.orders.create(options);
    res.json({ success: true, order });
  } catch (error) {
    console.error("Error creating order:", error);
    res.status(500).json({ success: false, message: "Error creating order" });
  }
});

app.get("/user-name", async (req, res) => {
  try {
    const { email } = req.query;
    if (!email) {
      return res.status(400).json({ success: false, message: "Email is required" });
    }

    const getUserSQL = "SELECT name FROM ai_ticket_payment WHERE email = ?";
    const [users] = await db.query(getUserSQL, [email]);

    if (users.length > 0) {
      return res.json({ success: true, name: users[0].name });
    }

    res.status(404).json({ success: false, message: "User not found" });
  } catch (error) {
    console.error("Error fetching user name:", error);
    res.status(500).json({ success: false, message: "Internal Server Error" });
  }
});

app.get("/get-fcm-token", async (req, res) => {
  try {
    const { email } = req.query;
    if (!email) return res.status(400).json({ success: false, message: "Email is required" });

    const getTokenSQL = "SELECT fcm_token FROM ai_ticket_payment WHERE email = ?";
    const [users] = await db.query(getTokenSQL, [email]);

    if (users.length > 0 && users[0].fcm_token) {
      return res.json({ success: true, fcm_token: users[0].fcm_token });
    }

    res.status(404).json({ success: false, message: "FCM token not found for this user" });
  } catch (error) {
    console.error("Error fetching FCM token:", error);
    res.status(500).json({ success: false, message: "Internal Server Error" });
  }
});

app.post("/update-fcm-token", async (req, res) => {
  try {
    const { email, fcm_token } = req.body;
    if (!email || !fcm_token) {
      return res.status(400).json({ success: false, message: "Email and FCM token are required" });
    }

    const updateTokenSQL = "UPDATE ai_ticket_payment SET fcm_token = ? WHERE email = ?";
    const [result] = await db.query(updateTokenSQL, [fcm_token, email]);

    if (result.affectedRows === 0) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    res.json({ success: true, message: "FCM Token updated successfully!" });
  } catch (error) {
    console.error("FCM Token update error:", error);
    res.status(500).json({ success: false, message: "Internal Server Error" });
  }
});


// ✅ Verify Payment (Razorpay)
app.post("/verify-payment", async (req, res) => {
  try {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;

    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
      return res.status(400).json({ success: false, message: "Missing required payment details" });
    }

    const generated_signature = crypto
      .createHmac("sha256", razorpay.key_secret)
      .update(`${razorpay_order_id}|${razorpay_payment_id}`)
      .digest("hex");

    if (generated_signature !== razorpay_signature) {
      return res.status(400).json({ success: false, message: "Payment verification failed" });
    }

    res.json({ success: true, message: "Payment verified successfully", payment_id: razorpay_payment_id });
  } catch (error) {
    console.error("Payment verification error:", error);
    res.status(500).json({ success: false, message: "Error verifying payment" });
  }
});

// ✅ Check if a User Has Paid (By Email)
app.get("/check-payment", async (req, res) => {
  try {
    const { email } = req.query;
    if (!email) {
      console.log("❌ Email is missing in request");
      return res.status(400).json({ success: false, message: "Email is required" });
    }

    console.log(`🔍 Checking payment for email: ${email}`);

    const checkPaymentSQL = `
      SELECT email, pass_name, status 
      FROM ai_ticket_payment 
      WHERE email = ? 
      AND pass_name IN ('Platinum Delegate Pass', 'Gold Delegate Pass', 'Standard Delegate Pass');
    `;

    const [payments] = await db.query(checkPaymentSQL, [email]);

    console.log("✅ Query Result:", payments);

    if (payments.length > 0) {
      return res.json({ success: true, status: payments[0].status, pass_name: payments[0].pass_name });
    }

    res.json({ success: false, message: "No payment found" });
  } catch (error) {
    console.error("🚨 Check payment error:", error);
    res.status(500).json({ success: false, message: "Internal Server Error" });
  }
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
      const updateFCMSQL = "UPDATE ai_ticket_payment SET fcm_token = ? WHERE email = ?";
      await db.query(updateFCMSQL, [fcm_token, email]);

      return res.json({ success: true, user: existingUsers[0], message: "Login successful. Token updated." });
    }

    if (!name || !mobile || !designation || !address || !company || !country || !state || !city) {
      return res.status(400).json({ success: false, message: "All fields are required for registration" });
    }

    const insertUserSQL = `
      INSERT INTO ai_ticket_payment (name, email, mobile, designation, address, company, country, state, city, fcm_token, status, amount, payumoney, date) 
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, 0, '', NOW()) 
    `;

    const [result] = await db.query(insertUserSQL, [name, email, mobile, designation, address, company, country, state, city, fcm_token]);
    const [newUser] = await db.query("SELECT * FROM ai_ticket_payment WHERE id = ?", [result.insertId]);

    res.json({ success: true, message: "User registered successfully!", user: newUser[0] });
  } catch (error) {
    console.error("Auth error:", error);
    res.status(500).json({ success: false, message: "Internal Server Error" });
  }
});

// ✅ Update Payment Status and Fetch Details
app.post("/payment-success", async (req, res) => {
  try {
    const { email, name, payumoney, amount, pass_name } = req.body;

    if ((!email && !name) || !payumoney || !amount || !pass_name) {
      return res.status(400).json({ success: false, message: "Missing required fields" });
    }

    const checkPaymentSQL = "SELECT COUNT(*) AS count FROM ai_ticket_payment WHERE payumoney = ?";
    const [existingPayments] = await db.query(checkPaymentSQL, [payumoney]);

    if (existingPayments[0].count > 0) {
      return res.status(400).json({ success: false, message: "Payment already recorded" });
    }

    const updateSQL = `
      UPDATE ai_ticket_payment 
      SET status = 1, payumoney = ?, amount = ?, pass_name = ?
      WHERE (email = ? OR name = ?)
    `;

    const [result] = await db.query(updateSQL, [payumoney, amount, pass_name, email || "", name || ""]);

    if (result.affectedRows === 0) {
      return res.status(404).json({ success: false, message: "User not found or already paid" });
    }

    // ✅ Fetch updated payment status
    const fetchUpdatedSQL = "SELECT status, pass_name, amount FROM ai_ticket_payment WHERE (email = ? OR name = ?)";
    const [updatedUser] = await db.query(fetchUpdatedSQL, [email || "", name || ""]);

    res.json({ success: true, message: "Payment updated successfully!", payment: updatedUser[0] });
  } catch (error) {
    console.error("Payment update error:", error);
    res.status(500).json({ success: false, message: "Internal Server Error" });
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


// ✅ Fetch All Users
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
app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
