require("dotenv").config();
const express = require("express");
const cors = require("cors");
const cookieParser = require("cookie-parser");
const jwt = require("jsonwebtoken");
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);

const app = express();
const port = process.env.PORT || 5000;

// Middleware
app.use(express.json());
app.use(cookieParser());
app.use(
  cors({
    origin: [
      "http://localhost:5173",
      "http://localhost:5174",
      "https://employee-management-app-e3a87.web.app",
    ],
    credentials: true,
  })
);

// MongoDB connection
const uri = `mongodb+srv://${process.env.USER_DB}:${process.env.PASS_DB}@cluster0.yzyltda.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;
const client = new MongoClient(uri, {
  serverApi: { version: ServerApiVersion.v1, strict: true, deprecationErrors: true },
});

async function run() {
  try {
    const usersCollection = client.db("employeeManagement").collection("users");
    const worksheetCollection = client.db("employeeManagement").collection("workSheet");
    const messageCollection = client.db("employeeManagement").collection("message");
    const paymentCollection = client.db("employeeManagement").collection("payment");

    // JWT verification middleware
    const verifyToken = async (req, res, next) => {
      const token = req.cookies?.token;
      if (!token) return res.status(401).send({ message: "unauthorized access" });

      jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, async (err, decoded) => {
        if (err) return res.status(401).send({ message: "unauthorized access" });
        const isFired = await usersCollection.findOne({ email: decoded.email, status: "fired" });
        if (isFired) return res.status(401).send({ message: "unauthorized access" });
        req.user = decoded;
        next();
      });
    };

    const verifyAdmin = async (req, res, next) => {
      const email = req?.user?.email;
      const user = await usersCollection.findOne({ email });
      if (!user || user.role !== "admin") return res.status(403).send({ message: "admin only actions" });
      next();
    };

    const verifyHR = async (req, res, next) => {
      const email = req?.user?.email;
      const user = await usersCollection.findOne({ email });
      if (!user || user.role !== "HR") return res.status(403).send({ message: "HR only actions" });
      next();
    };

    // Root
    app.get("/", (req, res) => res.send("Hello World!"));

    // JWT token
    app.post("/jwt", async (req, res) => {
      const email = req.body;
      const token = jwt.sign(email, process.env.ACCESS_TOKEN_SECRET, { expiresIn: "365d" });
      res.cookie("token", token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: process.env.NODE_ENV === "production" ? "none" : "strict",
      }).send({ success: true });
    });

    // Logout
    app.get("/logout", async (req, res) => {
      res.clearCookie("token", {
        secure: process.env.NODE_ENV === "production",
        sameSite: process.env.NODE_ENV === "production" ? "none" : "strict",
      }).send({ success: true });
    });

    // Users
    app.post("/users", async (req, res) => {
      const userData = req.body;
      userData.created_at = new Date().toISOString();
      userData.last_loggedIn = new Date().toISOString();
      userData.isVerified = false;
      userData.status = "active";

      const existing = await usersCollection.findOne({ email: userData.email });
      if (existing) {
        const result = await usersCollection.updateOne({ email: userData.email }, { $set: { last_loggedIn: new Date().toISOString() } });
        return res.send(result);
      }

      const result = await usersCollection.insertOne(userData);
      res.send(result);
    });

    app.get("/users", verifyToken, async (req, res) => {
      const email = req.query.email;
      if (email) {
        const user = await usersCollection.findOne({ email });
        if (!user) return res.status(404).send({ message: "User not found" });
        return res.send([user]);
      } else {
        const users = await usersCollection.find().toArray();
        res.send(users);
      }
    });

    app.get("/users/verified", async (req, res) => {
      const result = await usersCollection.find({ isVerified: true }).toArray();
      res.send(result);
    });

    app.get("/user-role/:email", verifyToken, async (req, res) => {
  const email = req.params.email;
  const user = await usersCollection.findOne({ email });
  if (!user) {
    return res.status(404).send({ message: "user not found" });
  }
  res.send({ role: user?.role });
});

    app.get("/users/:email", async (req, res) => {
      const email = req.params.email;
      const user = await usersCollection.findOne({ email });
      if (!user) return res.status(404).send({ message: "User not found" });
      res.send(user);
    });

    app.patch("/users/:id", verifyToken, async (req, res) => {
      const { role, status, salary, isVerified } = req.body;
      const updateFields = {};
      if (role) updateFields.role = role.toUpperCase();
      if (status) updateFields.status = status;
      if (salary) updateFields.salary = salary;
      if (isVerified !== undefined) updateFields.isVerified = isVerified;
      const result = await usersCollection.updateOne({ _id: new ObjectId(req.params.id) }, { $set: updateFields });
      res.send(result);
    });

    // WorkSheet
    app.post("/workSheet", verifyToken, async (req, res) => {
      const result = await worksheetCollection.insertOne(req.body);
      res.send(result);
    });
    app.get("/workSheet", verifyToken, async (req, res) => {
      const email = req.query.email;
      let query = {};
      if (email) query.email = email;
      const result = await worksheetCollection.find(query).sort({ date: 1 }).toArray();
      res.send(result);
    });
    app.delete("/workSheet/:id", verifyToken, async (req, res) => {
      const result = await worksheetCollection.deleteOne({ _id: new ObjectId(req.params.id) });
      res.send(result);
    });
    app.patch("/workSheet/:id", verifyToken, async (req, res) => {
      const { tasks, hours, date } = req.body;
      const result = await worksheetCollection.updateOne({ _id: new ObjectId(req.params.id) }, { $set: { tasks, hours, date } });
      res.send(result);
    });

    // Messages
    app.post("/user/message", verifyToken, async (req, res) => {
      req.body.created_at = new Date().toISOString();
      const result = await messageCollection.insertOne(req.body);
      res.send(result);
    });
    app.get("/user/message", verifyToken, async (req, res) => {
      const result = await messageCollection.find().toArray();
      res.send(result);
    });

    // Payments
    app.post("/payment-request", verifyToken, verifyHR, async (req, res) => {
      const { employeeEmail, month, year } = req.body;
      const existing = await paymentCollection.findOne({ employeeEmail, month, year, paymentDate: { $ne: null } });
      if (existing) return res.status(400).send({ message: "Already paid for this month/year" });
      req.body.created_at = new Date();
      const result = await paymentCollection.insertOne(req.body);
      res.send(result);
    });

    app.get("/payment-history", verifyToken, async (req, res) => {
    const { email, page = 1, limit = 5 } = req.query;

    if (!email) {
      return res.status(400).send({ message: "Email is required" });
    }

    const query = {
      employeeEmail: email,
      paymentDate: { $ne: null }, // only show paid
    };

    const totalPayments = await paymentCollection.countDocuments(query);
    const totalPages = Math.ceil(totalPayments / limit);

    const payments = await paymentCollection
      .find(query)
      .sort({ paymentDate: 1 })
      .skip((page - 1) * limit)
      .limit(parseInt(limit))
      .toArray();

    res.send({
      data: payments,
      totalPages,
      currentPage: parseInt(page),
    });
});


    app.get("/payment", async (req, res) => {
      const payments = await paymentCollection.find().toArray();
      res.send(payments);
    });

    app.patch("/payment/pay/:id", verifyToken, verifyAdmin, async (req, res) => {
      const { transactionId } = req.body;
      const result = await paymentCollection.updateOne({ _id: new ObjectId(req.params.id) }, { $set: { paymentDate: new Date(), transactionId: transactionId || null } });
      res.send(result);
    });

    app.post("/create-payment-intent", verifyToken, verifyAdmin, async (req, res) => {
      const { salary } = req.body;
      const amount = parseInt(salary * 100);
      try {
        const paymentIntent = await stripe.paymentIntents.create({ amount, currency: "usd", payment_method_types: ["card"] });
        res.send({ clientSecret: paymentIntent.client_secret });
      } catch (error) {
        res.status(500).send({ message: "Failed to create payment intent" });
      }
    });

    // Dashboard stats
    app.get("/dashboard/stats", verifyToken, async (req, res) => {
      const users = await usersCollection.find().toArray();
      const payments = await paymentCollection.find().toArray();
      res.json({
        totalEmployees: users.filter(u => u.role === "Employee").length,
        totalHRs: users.filter(u => u.role === "HR").length,
        totalAdmins: users.filter(u => u.role === "admin").length,
        verifiedUsers: users.filter(u => u.isVerified === true).length,
        salaries: payments.map(p => ({ EmployeeName: p.EmployeeName || p.employeeName, salary: Number(p.salary) })),
      });
    });

   

    // Mongo ping
    // await client.db("admin").command({ ping: 1 });
    console.log("Connected to MongoDB successfully!");
  } finally {
    // Don't close client while server runs
  }
}

run().catch(console.dir);

// Start server
app.listen(port, () => console.log(`Server running on http://localhost:${port}`));
