const express = require("express");
const mysql = require("mysql2/promise"); //  Use promise-based MySQL
const Razorpay = require("razorpay");
const crypto = require("crypto");
const cors = require("cors");
const multer = require("multer");
const path = require("path");
const fs = require("fs");

const app = express();
app.use(cors());
app.use(express.json()); //  Use built-in JSON parsing

//  Serve uploaded images as static files
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

//  Database Connection Pool
const db = mysql.createPool({
  connectionLimit: 10,
  host: "195.35.47.198",
  user: "u919956999_gaisaUser",
  password: "6KnNLGN0i3S",
  database: "u919956999_gaisa_db",
});

const db2 = mysql.createPool({
  connectionLimit: 10,
  host: "195.35.47.198",
  user: "u919956999_indiastartupUR",
  password: "AIzaSyDk1",
  database: "u919956999_indiastartupDB",
});

//  Initialize Razorpay
const razorpay = new Razorpay({
  key_id: "rzp_live_vOWkG1W1TBWQ1H", // Use live keys
  key_secret: "BXmaeiUMUE10pIb4GUIlMuwb", // Replace with actual key secret
});

//  Create Order (Razorpay)
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

//  Get Profile Picture
app.get("/profile-picture", async (req, res) => {
  try {
    const { email } = req.query;
    if (!email)
      return res
        .status(400)
        .json({ success: false, message: "Email required" });

    const getSQL =
      "SELECT profile_picture FROM ai_ticket_payment WHERE email = ?";
    const [users] = await db.query(getSQL, [email]);

    if (!users.length || !users[0].profile_picture)
      return res
        .status(404)
        .json({ success: false, message: "Profile picture not found" });

    res.json({
      success: true,
      image_url: `/uploads/${users[0].profile_picture}`,
    });
  } catch (error) {
    console.error("Error fetching profile picture:", error);
    res.status(500).json({ success: false, message: "Server Error" });
  }
});

//  Multer Storage for Profile Pictures
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadPath = path.join(__dirname, "uploads");
    if (!fs.existsSync(uploadPath))
      fs.mkdirSync(uploadPath, { recursive: true }); // Ensure folder exists
    cb(null, uploadPath);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    const uniqueFilename = `${Date.now()}-${Math.random()
      .toString(36)
      .slice(-6)}${ext}`;
    cb(null, uniqueFilename);
  },
});

const upload = multer({ storage });

// Upload Profile Picture
app.post(
  "/upload-profile-picture",
  upload.single("image"),
  async (req, res) => {
    try {
      console.log("Received file:", req.file); // Debug file
      console.log("Received email:", req.body.email); // Debug email

      if (!req.file) {
        return res
          .status(400)
          .json({ success: false, message: "No file uploaded" });
      }
      if (!req.body.email) {
        return res
          .status(400)
          .json({ success: false, message: "Email is required" });
      }

      const { email } = req.body;
      const imagePath = req.file.filename;

      const updateSQL =
        "UPDATE ai_ticket_payment SET profile_picture = ? WHERE email = ?";
      const [result] = await db.query(updateSQL, [imagePath, email]);

      if (result.affectedRows === 0) {
        return res
          .status(404)
          .json({ success: false, message: "User not found" });
      }

      res.json({
        success: true,
        message: "Profile picture updated!",
        image_url: `/uploads/${imagePath}`,
      });
    } catch (error) {
      console.error("Profile picture upload error:", error);
      res.status(500).json({ success: false, message: "Server Error" });
    }
  }
);

////same interset api

app.post("/fetch-matched-users", async (req, res) => {
  const { email } = req.body;

  try {
    // Fetch user's interests
    const [userData] = await db.query(
      "SELECT areas_of_expertise, technologies_of_interest, startups_innovation_interests, investment_interests FROM ai_ticket_payment WHERE email = ?",
      [email]
    );

    if (!userData.length) {
      return res.status(404).json({ message: "User not found" });
    }

    const userInterests = [
      ...JSON.parse(userData[0].areas_of_expertise || "[]"),
      ...JSON.parse(userData[0].technologies_of_interest || "[]"),
      ...JSON.parse(userData[0].startups_innovation_interests || "[]"),
      ...JSON.parse(userData[0].investment_interests || "[]"),
    ];

    if (userInterests.length === 0) {
      return res.json([]);
    }

    // Find users with at least one common interest
    const [matchedUsers] = await db.query(
      `
          SELECT email, name, designation, company, fcm_token 
          FROM ai_ticket_payment 
          WHERE email != ? 
          AND (
              JSON_OVERLAPS(areas_of_expertise, ?) OR 
              JSON_OVERLAPS(technologies_of_interest, ?) OR 
              JSON_OVERLAPS(startups_innovation_interests, ?) OR 
              JSON_OVERLAPS(investment_interests, ?)
          )
      `,
      [
        email,
        JSON.stringify(userInterests),
        JSON.stringify(userInterests),
        JSON.stringify(userInterests),
        JSON.stringify(userInterests),
      ]
    );

    res.json(matchedUsers);
  } catch (error) {
    console.error("Error fetching matched users:", error);
    res.status(500).json({ message: "Server error" });
  }
});

//visiotor pass
app.post("/update-visitor-pass", async (req, res) => {
  const { email, pass_name } = req.body;

  if (!email || !pass_name) {
    return res
      .status(400)
      .json({ success: false, message: "Missing email or pass_name" });
  }

  try {
    const [result] = await db.execute(
      "UPDATE ai_ticket_payment SET pass_name = ? WHERE email = ?",
      [pass_name, email]
    );

    if (result.affectedRows > 0) {
      res.json({ success: true, message: "Pass updated to Visitor Pass." });
    } else {
      res.status(404).json({ success: false, message: "User not found." });
    }
  } catch (err) {
    console.error("Update error:", err);
    res.status(500).json({ success: false, message: "Server error." });
  }
});

app.get("/user-name", async (req, res) => {
  try {
    const { email } = req.query;
    if (!email) {
      return res
        .status(400)
        .json({ success: false, message: "Email is required" });
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
    if (!email)
      return res
        .status(400)
        .json({ success: false, message: "Email is required" });

    const getTokenSQL =
      "SELECT fcm_token FROM ai_ticket_payment WHERE email = ?";
    const [users] = await db.query(getTokenSQL, [email]);

    if (users.length > 0 && users[0].fcm_token) {
      return res.json({ success: true, fcm_token: users[0].fcm_token });
    }

    res
      .status(404)
      .json({ success: false, message: "FCM token not found for this user" });
  } catch (error) {
    console.error("Error fetching FCM token:", error);
    res.status(500).json({ success: false, message: "Internal Server Error" });
  }
});

app.post("/update-fcm-token", async (req, res) => {
  try {
    const { email, fcm_token } = req.body;
    if (!email || !fcm_token) {
      return res
        .status(400)
        .json({ success: false, message: "Email and FCM token are required" });
    }

    const updateTokenSQL =
      "UPDATE ai_ticket_payment SET fcm_token = ? WHERE email = ?";
    const [result] = await db.query(updateTokenSQL, [fcm_token, email]);

    if (result.affectedRows === 0) {
      return res
        .status(404)
        .json({ success: false, message: "User not found" });
    }

    res.json({ success: true, message: "FCM Token updated successfully!" });
  } catch (error) {
    console.error("FCM Token update error:", error);
    res.status(500).json({ success: false, message: "Internal Server Error" });
  }
});

app.get("/user-details", async (req, res) => {
  try {
    const { email } = req.query;

    if (!email) {
      return res
        .status(400)
        .json({ success: false, message: "Email is required" });
    }

    const getUserSQL =
      "SELECT email, pass_name, profile_picture FROM ai_ticket_payment WHERE email = ?";
    const [users] = await db.query(getUserSQL, [email]);

    if (users.length > 0) {
      let user = users[0];

      // If profile_picture exists, return the full image URL
      user.profile_picture = user.profile_picture
        ? `http://srv743703.hstgr.cloud:3000/uploads/${user.profile_picture}`
        : null; // Set to null if no profile picture is available

      return res.json({ success: true, user });
    }

    res.status(404).json({ success: false, message: "User not found" });
  } catch (error) {
    console.error("Error fetching user details:", error);
    res.status(500).json({ success: false, message: "Internal Server Error" });
  }
});

//delete account

app.delete("/delete-account", async (req, res) => {
  const { email } = req.body;

  if (!email) {
    return res.status(400).json({ message: "Email is required" });
  }

  try {
    const [result] = await db.query(
      "DELETE FROM ai_ticket_payment WHERE email = ?",
      [email]
    );

    if (result.affectedRows > 0) {
      return res.json({ message: "Account deleted successfully" });
    } else {
      return res.status(404).json({ message: "User not found" });
    }
  } catch (error) {
    console.error("Error deleting account:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
});

//get all the user details
app.get("/all-users", async (req, res) => {
  try {
    const getUsersSQL =
      "SELECT email, pass_name, profile_picture FROM ai_ticket_payment";
    const [users] = await db.query(getUsersSQL);

    // Format profile picture URL
    const formattedUsers = users.map((user) => ({
      ...user,
      profile_picture: user.profile_picture
        ? `http://srv743703.hstgr.cloud:3000/uploads/${user.profile_picture}`
        : null, // Set to null if no profile picture
    }));

    res.json({ success: true, users: formattedUsers });
  } catch (error) {
    console.error("Error fetching all users:", error);
    res.status(500).json({ success: false, message: "Internal Server Error" });
  }
});

app.post("/save-checkboxes", (req, res) => {
  const {
    email,
    areas_of_expertise,
    technologies_of_interest,
    startups_innovation_interests,
    investment_interests,
  } = req.body;

  console.log("Received Data:", req.body); // Log incoming request data

  if (!email) {
    console.error("Error: Email is required");
    return res.status(400).json({ message: "Email is required" });
  }

  const query = `UPDATE ai_ticket_payment SET 
                 areas_of_expertise = ?, 
                 technologies_of_interest = ?, 
                 startups_innovation_interests = ?, 
                 investment_interests = ? 
                 WHERE email = ?`;

  const values = [
    areas_of_expertise || null,
    technologies_of_interest || null,
    startups_innovation_interests || null,
    investment_interests || null,
    email,
  ];

  console.log("Executing Query:", query);
  console.log("Query Values:", values);

  db.query(query, values, (err, result) => {
    if (err) {
      console.error("Database Error:", err);
      return res.status(500).json({ message: "Database error" });
    }

    console.log("SQL Execution Result:", result);

    if (result.affectedRows === 0) {
      console.warn("No user found for email:", email);
      return res.status(404).json({ message: "No user found with this email" });
    }

    console.log("Data saved successfully for email:", email);
    res.json({ message: "Data saved successfully" });
  });
});

//  Verify Payment (Razorpay)
app.post("/verify-payment", async (req, res) => {
  try {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature } =
      req.body;

    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
      return res
        .status(400)
        .json({ success: false, message: "Missing required payment details" });
    }

    const generated_signature = crypto
      .createHmac("sha256", razorpay.key_secret)
      .update(`${razorpay_order_id}|${razorpay_payment_id}`)
      .digest("hex");

    if (generated_signature !== razorpay_signature) {
      return res
        .status(400)
        .json({ success: false, message: "Payment verification failed" });
    }

    res.json({
      success: true,
      message: "Payment verified successfully",
      payment_id: razorpay_payment_id,
    });
  } catch (error) {
    console.error("Payment verification error:", error);
    res
      .status(500)
      .json({ success: false, message: "Error verifying payment" });
  }
});

//  Check if a User Has Paid (By Email)
app.get("/check-payment", async (req, res) => {
  try {
    const { email } = req.query;
    if (!email) {
      console.log(" Email is missing in request");
      return res
        .status(400)
        .json({ success: false, message: "Email is required" });
    }

    console.log(`🔍 Checking payment for email: ${email}`);

    const checkPaymentSQL = `
      SELECT email, pass_name, status 
      FROM ai_ticket_payment 
      WHERE email = ? 
      AND pass_name IN ('Platinum Delegate Pass', 'Gold Delegate Pass', 'Standard Delegate Pass');
    `;

    const [payments] = await db.query(checkPaymentSQL, [email]);

    console.log(" Query Result:", payments);

    if (payments.length > 0) {
      return res.json({
        success: true,
        status: payments[0].status,
        pass_name: payments[0].pass_name,
      });
    }

    res.json({ success: false, message: "No payment found" });
  } catch (error) {
    console.error(" Check payment error:", error);
    res.status(500).json({ success: false, message: "Internal Server Error" });
  }
});

//  User Authentication (Login/Register)
// app.post("/auth", async (req, res) => {
//   try {
//     let { email, name, mobile, designation, address, company, country, state, city, fcm_token, edition } = req.body;
//     if (!email) return res.status(400).json({ success: false, message: "Email is required" });

//     email = email.trim().toLowerCase();
//     const checkUserSQL = "SELECT * FROM ai_ticket_payment WHERE LOWER(email) = ?";
//     const [existingUsers] = await db.query(checkUserSQL, [email]);

//     if (existingUsers.length > 0) {
//       const updateFCMSQL = "UPDATE ai_ticket_payment SET fcm_token = ? WHERE email = ?";
//       await db.query(updateFCMSQL, [fcm_token, email]);

//       return res.json({ success: true, user: existingUsers[0], message: "Login successful. Token updated." });
//     }

//     if (!name || !mobile || !designation || !address || !company || !country || !state || !city || !edition) {
//       return res.status(400).json({ success: false, message: "All fields are required for registration" });
//     }

//     const insertUserSQL = `
//       INSERT INTO ai_ticket_payment (name, email, mobile, designation, address, company, country, state, city, fcm_token, edition, status, amount, payumoney, date)
//       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, 0, '', NOW())
//     `;

//     const [result] = await db.query(insertUserSQL, [name, email, mobile, designation, address, company, country, state, city, fcm_token, edition]);
//     const [newUser] = await db.query("SELECT * FROM ai_ticket_payment WHERE id = ?", [result.insertId]);

//     res.json({ success: true, message: "User registered successfully!", user: newUser[0] });
//   } catch (error) {
//     console.error("Auth error:", error);
//     res.status(500).json({ success: false, message: "Internal Server Error" });
//   }
// });

//  User Authentication (Login/Register)
app.post("/auth", async (req, res) => {
  try {
    const appType = req.query.appType;
    let {
      email,
      name,
      mobile,
      designation,
      address,
      company,
      country,
      state,
      city,
      fcm_token,
      edition,
    } = req.body;

    if (!email)
      return res
        .status(400)
        .json({ success: false, message: "Email is required" });

    email = email.trim().toLowerCase();

    if (appType == "gaisa") {
      const checkUserSQL =
        "SELECT * FROM ai_ticket_payment WHERE LOWER(email) = ?";
      const [existingUsers] = await db.query(checkUserSQL, [email]);

      if (existingUsers.length > 0) {
        const updateFCMSQL =
          "UPDATE ai_ticket_payment SET fcm_token = ? WHERE email = ?";
        await db.query(updateFCMSQL, [fcm_token, email]);

        return res.json({
          success: true,
          user: existingUsers[0],
          message: "Login successful Gaisa. Token updated.",
        });
      }
    } else if (appType == "mahakum") {
      const checkUserSQL =
        "SELECT * FROM indiafirst_delegate WHERE LOWER(email) = ?";
      const [existingUsers] = await db2.query(checkUserSQL, [email]);

      if (existingUsers.length > 0) {
        const updateFCMSQL =
          "UPDATE indiafirst_delegate SET fcm_token = ? WHERE email = ?";
        await db2.query(updateFCMSQL, [fcm_token, email]);

        return res.json({
          success: true,
          user: existingUsers[0],
          message: "Login successful Mahakumb. Token updated.",
        });
      }
    }

    //new user 

    // if (
    //   !name ||
    //   !mobile ||
    //   !designation ||
    //   !address ||
    //   !company ||
    //   !country ||
    //   !state ||
    //   !city ||
    //   !edition
    // ) {
    //   return res.status(400).json({
    //     success: false,
    //     message: "All fields are required for registration",
    //   });
    // }

    if (appType == "gaisa") {

      if (
        !name ||
        !mobile ||
        !designation ||
        !address ||
        !company ||
        !country ||
        !state ||
        !city ||
        !edition
      ) {
        return res.status(400).json({
          success: false,
          message: "All fields are required for registration",
        });
      }

      const insertUserSQL = `
      INSERT INTO ai_ticket_payment (name, email, mobile, designation, address, company, country, state, city, fcm_token, edition, status, amount, payumoney, date) 
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, 0, '', NOW()) 
    `;

      const [result] = await db.query(insertUserSQL, [
        name,
        email,
        mobile,
        designation,
        address,
        company,
        country,
        state,
        city,
        fcm_token,
        edition,
      ]);

      const [newUser] = await db.query(
        "SELECT * FROM ai_ticket_payment WHERE id = ?",
        [result.insertId]
      );

      res.json({
        success: true,
        message: "User registered successfully!",
        user: newUser[0],
      });
    }
     else if (appType = "mahakum") {


      if (
        !name ||
        !mobile ||
        !designation ||
        !address ||
        !country ||
        !state ||
        !city ||
        !edition
      ) {
        return res.status(400).json({
          success: false,
          message: "All fields are required for registration",
        });
      }

      const insertUserSQL = `INSERT INTO indiafirst_delegate (name, email, mobile, designation, address, country, state, city, fcm_token, edition, status, amount, payumoney, date) 
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, 0, '', NOW()) 
    `;
      const [result] = await db2.query(insertUserSQL, [
        name,
        email,
        mobile,
        designation,
        address,
        country,
        state,
        city,
        fcm_token,
        edition,
      ]);

      const [newUser] = await db2.query(
        "SELECT * FROM indiafirst_delegate WHERE id = ?",
        [result.insertId]
      );

      res.json({
        success: true,
        message: "User registered successfully!",
        user: newUser[0],
      });
    }
  } catch (error) {
    console.error("Auth error:", error);
    res.status(500).json({ success: false, message: "Internal Server Error",error:error });
  }
});

//  Update Payment Status and Fetch Details
app.post("/payment-success", async (req, res) => {
  try {
    const { email, name, payumoney, amount, pass_name } = req.body;

    if ((!email && !name) || !payumoney || !amount || !pass_name) {
      return res
        .status(400)
        .json({ success: false, message: "Missing required fields" });
    }

    const checkPaymentSQL =
      "SELECT COUNT(*) AS count FROM ai_ticket_payment WHERE payumoney = ?";
    const [existingPayments] = await db.query(checkPaymentSQL, [payumoney]);

    if (existingPayments[0].count > 0) {
      return res
        .status(400)
        .json({ success: false, message: "Payment already recorded" });
    }

    const updateSQL = `
      UPDATE ai_ticket_payment 
      SET status = 1, payumoney = ?, amount = ?, pass_name = ?
      WHERE (email = ? OR name = ?)
    `;

    const [result] = await db.query(updateSQL, [
      payumoney,
      amount,
      pass_name,
      email || "",
      name || "",
    ]);

    if (result.affectedRows === 0) {
      return res
        .status(404)
        .json({ success: false, message: "User not found or already paid" });
    }

    // Fetch updated payment status
    const fetchUpdatedSQL =
      "SELECT status, pass_name, amount FROM ai_ticket_payment WHERE (email = ? OR name = ?)";
    const [updatedUser] = await db.query(fetchUpdatedSQL, [
      email || "",
      name || "",
    ]);

    res.json({
      success: true,
      message: "Payment updated successfully!",
      payment: updatedUser[0],
    });
  } catch (error) {
    console.error("Payment update error:", error);
    res.status(500).json({ success: false, message: "Internal Server Error" });
  }
});

//  Fetch All Countries
app.get("/countries", async (req, res) => {
  try {
    const fetchCountriesSQL = "SELECT * FROM bird_countries";
    const [countries] = await db.query(fetchCountriesSQL);
    res.json({ success: true, countries });
  } catch (error) {
    console.error("Fetch countries error:", error);
    res
      .status(500)
      .json({ success: false, message: "Error fetching countries" });
  }
});

//  Fetch States by Country ID
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

//  Fetch Cities by State ID
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

//  Fetch All Users
app.get("/users", async (req, res) => {
  try {
    const fetchUsersSQL = `
      SELECT id, name, designation, company, fcm_token 
      FROM ai_ticket_payment 
      WHERE edition = '5th_edition'
    `;

    const [users] = await db.query(fetchUsersSQL);
    res.json({ success: true, users });
  } catch (error) {
    console.error("Fetch users error:", error);
    res.status(500).json({ success: false, message: "Error fetching users" });
  }
});

// Start Server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
