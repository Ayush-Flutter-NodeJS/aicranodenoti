const express = require("express");
const mysql = require("mysql2/promise");
const Razorpay = require("razorpay");
const crypto = require("crypto");
const cors = require("cors");
const multer = require("multer");
const path = require("path");
const fs = require("fs");

const app = express();
app.use(cors());
app.use(express.json());

// ✅ Serve uploaded images as static files
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

// ✅ Database Connection Pool
const db = mysql.createPool({
  connectionLimit: 10,
  host: "195.35.47.198",
  user: "u919956999_gaisarootUser",
  password: "KUni/L0b#",
  database: "u919956999_gaisa_app_db",
});

// ✅ Razorpay Setup
const razorpay = new Razorpay({
  key_id: "rzp_live_vOWkG1W1TBWQ1H",
  key_secret: "BXmaeiUMUE10pIb4GUIlMuwb",
});

// ✅ Multer Storage for Profile Pictures
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadPath = path.join(__dirname, "uploads");
    if (!fs.existsSync(uploadPath)) fs.mkdirSync(uploadPath);
    cb(null, uploadPath);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    const uniqueFilename = `${Date.now()}-${Math.random().toString(36).slice(-6)}${ext}`;
    cb(null, uniqueFilename);
  },
});
const upload = multer({ storage });

// ✅ Upload Profile Picture
app.post("/upload-profile-picture", upload.single("image"), async (req, res) => {
  try {
    console.log("Received file:", req.file);  // Debug file
    console.log("Received email:", req.body.email);  // Debug email

    if (!req.file) {
      return res.status(400).json({ success: false, message: "No file uploaded" });
    }
    if (!req.body.email) {
      return res.status(400).json({ success: false, message: "Email is required" });
    }

    const { email } = req.body;
    const imagePath = req.file.filename;

    const updateSQL = "UPDATE ai_ticket_payment SET profile_picture = ? WHERE email = ?";
    const [result] = await db.query(updateSQL, [imagePath, email]);

    if (result.affectedRows === 0) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    res.json({ success: true, message: "Profile picture updated!", image_url: `/uploads/${imagePath}` });
  } catch (error) {
    console.error("Profile picture upload error:", error);
    res.status(500).json({ success: false, message: "Server Error" });
  }
});


// ✅ Get Profile Picture
app.get("/profile-picture", async (req, res) => {
  try {
    const { email } = req.query;
    if (!email) return res.status(400).json({ success: false, message: "Email required" });

    const getSQL = "SELECT profile_picture FROM ai_ticket_payment WHERE email = ?";
    const [users] = await db.query(getSQL, [email]);

    if (!users.length || !users[0].profile_picture) return res.status(404).json({ success: false, message: "Profile picture not found" });

    res.json({ success: true, image_url: `/uploads/${users[0].profile_picture}` });
  } catch (error) {
    console.error("Error fetching profile picture:", error);
    res.status(500).json({ success: false, message: "Server Error" });
  }
});

// ✅ Create Order (Razorpay)
app.post("/create-order", async (req, res) => {
  try {
    const { amount, currency = "INR", receipt } = req.body;
    const order = await razorpay.orders.create({ amount, currency, receipt, payment_capture: 1 });
    res.json({ success: true, order });
  } catch (error) {
    console.error("Error creating order:", error);
    res.status(500).json({ success: false, message: "Error creating order" });
  }
});

// ✅ Verify Payment
app.post("/verify-payment", async (req, res) => {
  try {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;

    const generated_signature = crypto
      .createHmac("sha256", razorpay.key_secret)
      .update(`${razorpay_order_id}|${razorpay_payment_id}`)
      .digest("hex");

    if (generated_signature !== razorpay_signature) return res.status(400).json({ success: false, message: "Payment verification failed" });

    res.json({ success: true, message: "Payment verified", payment_id: razorpay_payment_id });
  } catch (error) {
    console.error("Payment verification error:", error);
    res.status(500).json({ success: false, message: "Server Error" });
  }
});

// ✅ Update FCM Token
app.post("/update-fcm-token", async (req, res) => {
  try {
    const { email, fcm_token } = req.body;
    if (!email || !fcm_token) return res.status(400).json({ success: false, message: "Email and FCM token required" });

    const updateSQL = "UPDATE ai_ticket_payment SET fcm_token = ? WHERE email = ?";
    const [result] = await db.query(updateSQL, [fcm_token, email]);

    if (!result.affectedRows) return res.status(404).json({ success: false, message: "User not found" });

    res.json({ success: true, message: "FCM Token updated" });
  } catch (error) {
    console.error("FCM Token update error:", error);
    res.status(500).json({ success: false, message: "Server Error" });
  }
});

// ✅ Get All Users
app.get("/users", async (req, res) => {
  try {
    const fetchUsersSQL = "SELECT id, name, designation, company, profile_picture FROM ai_ticket_payment";
    const [users] = await db.query(fetchUsersSQL);
    res.json({ success: true, users });
  } catch (error) {
    console.error("Fetch users error:", error);
    res.status(500).json({ success: false, message: "Error fetching users" });
  }
});

// ✅ Fetch Countries, States, Cities
app.get("/countries", async (req, res) => {
  try {
    const [countries] = await db.query("SELECT * FROM bird_countries");
    res.json({ success: true, countries });
  } catch (error) {
    console.error("Fetch countries error:", error);
    res.status(500).json({ success: false, message: "Error fetching countries" });
  }
});

app.get("/states/:countryId", async (req, res) => {
  try {
    const [states] = await db.query("SELECT * FROM bird_states WHERE countryId = ?", [req.params.countryId]);
    res.json({ success: true, states });
  } catch (error) {
    console.error("Fetch states error:", error);
    res.status(500).json({ success: false, message: "Error fetching states" });
  }
});

app.get("/cities/:stateId", async (req, res) => {
  try {
    const [cities] = await db.query("SELECT * FROM bird_cities WHERE state_id = ?", [req.params.stateId]);
    res.json({ success: true, cities });
  } catch (error) {
    console.error("Fetch cities error:", error);
    res.status(500).json({ success: false, message: "Error fetching cities" });
  }
});

// ✅ Start Server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
