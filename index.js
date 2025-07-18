require("dotenv").config();
const express = require("express");
const cors = require("cors");
const cookieParser = require("cookie-parser");
const app = express();
const jwt = require("jsonwebtoken");
const port = process.env.PORT || 3000;
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);
// Employee_Management
// SP22r4FKGAwNRutK
app.use(express.json());

const corsOptions = {
  origin: [
    "http://localhost:5173",
    "http://localhost:5174",
    "https://employee-management-app-e3a87.web.app",
    "https://empolyee-management-server.vercel.app/",
  ],
  credentials: true,
  optionSuccessStatus: 200,
};

app.use(cors(corsOptions));
app.use(cookieParser());

app.get("/", (req, res) => {
  res.send("Hello World!");
});

const uri = `mongodb+srv://${process.env.USER_DB}:${process.env.PASS_DB}@cluster0.yzyltda.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

async function run() {
  try {
    // Connect the client to the server	(optional starting in v4.7)
    // await client.connect();

    const usersCollection = client.db("employeeManagement").collection("users");
    const worksheetCollection = client
      .db("employeeManagement")
      .collection("workSheet");
    const messageCollection = client
      .db("employeeManagement")
      .collection("message");
    const paymentCollection = client
      .db("employeeManagement")
      .collection("payment");

    const verifyToken = async (req, res, next) => {
      const token = req.cookies?.token;

      if (!token) {
        return res.status(401).send({ message: "unauthorized access" });
      }
      jwt.verify(
        token,
        process.env.ACCESS_TOKEN_SECRET,
        async (err, decoded) => {
          if (err) {
            console.log(err);
            return res.status(401).send({ message: "unauthorized access" });
          }

          const isFired = await usersCollection.findOne({
            email: decoded.email,
            status: "fired",
          });

          if (isFired) {
            return res.status(401).send({ message: "unauthorized access" });
          }

          req.user = decoded;
          next();
        }
      );
    };

    app.post("/jwt", async (req, res) => {
      const email = req.body;
      const token = jwt.sign(email, process.env.ACCESS_TOKEN_SECRET, {
        expiresIn: "365d",
      });
      res
        .cookie("token", token, {
          httpOnly: true,
          secure: process.env.NODE_ENV === "production",
          sameSite: process.env.NODE_ENV === "production" ? "none" : "strict",
        })
        .send({ success: true });
    });

    const verifyAdmin = async (req, res, next) => {
      const email = req?.user?.email;
      const user = await usersCollection.findOne({ email });

      if (!user || user.role !== "admin") {
        return res.status(403).send({ message: "admin only actions" });
      }

      next();
    };

    //HR
    const verifyHR = async (req, res, next) => {
      const email = req?.user?.email;
      const user = await usersCollection.findOne({ email });

      if (!user || user.role !== "HR") {
        return res.status(403).send({ message: "HR only actions" });
      }

      next();
    };

    app.get("/logout", async (req, res) => {
      try {
        res
          .clearCookie("token", {
            maxAge: 0,
            secure: process.env.NODE_ENV === "production",
            sameSite: process.env.NODE_ENV === "production" ? "none" : "strict",
          })
          .send({ success: true });
      } catch (err) {
        res.status(500).send(err);
      }
    });
    app.post("/users", verifyToken, verifyHR, async (req, res) => {
      const userData = req.body;
      userData.created_at = new Date().toISOString();
      userData.last_loggedIn = new Date().toISOString();
      userData.isVerified = false;
      userData.status = "active";
      const query = { email: userData.email };
      const alreadyExisting = await usersCollection.findOne(query);
      if (alreadyExisting) {
        const result = await usersCollection.updateOne(query, {
          $set: { last_loggedIn: new Date().toISOString() },
        });
        return res.send(result);
      }
      const result = await usersCollection.insertOne(userData);
      res.send(result);
    });
    app.get("/users", verifyToken, async (req, res) => {
      try {
        const email = req.query.email;
        if (email) {
          const user = await usersCollection.findOne({ email: email });
          if (!user) {
            return res.status(404).send({ message: "User not found" });
          }
          return res.send([user]);
        } else {
          const users = await usersCollection.find().toArray();
          res.send(users);
        }
      } catch (error) {
        console.error(error);
        res.status(500).send({ message: "Internal Server Error" });
      }
    });

    app.get("/user-role/:email", verifyToken, async (req, res) => {
      try {
        const email = req.params.email;
        const user = await usersCollection.findOne({ email });
        if (!user) {
          return res.status(404).send({ message: "user not found" });
        }
        res.send({ role: user?.role });
      } catch (error) {
        res
          .status(500)
          .send({ message: "internal server error", error: error.message });
      }
    });

    app.post("/workSheet", verifyToken, async (req, res) => {
      const newWork = req.body;
      const result = await worksheetCollection.insertOne(newWork);
      res.send(result);
    });
    app.get("/workSheet", verifyToken, async (req, res) => {
      try {
        const email = req.query.email;
        let query = {};

        // If email is provided, filter by that email
        if (email) {
          query.email = email;
        }

        // Fetch data from MongoDB sorted by date ascending
        const result = await worksheetCollection
          .find(query)
          .sort({ date: 1 })
          .toArray();

        res.send(result);
      } catch (error) {
        console.error("Error fetching workSheet data:", error);
        res.status(500).send({ message: "Failed to fetch workSheet data" });
      }
    });

    app.delete("/workSheet/:id", verifyToken, async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await worksheetCollection.deleteOne(query);
      res.send(result);
    });
    app.patch("/workSheet/:id", verifyToken, async (req, res) => {
      const id = req.params.id;
      const { tasks, hours, date } = req.body;

      const result = await worksheetCollection.updateOne(
        { _id: new ObjectId(id) },
        { $set: { tasks, hours, date } }
      );

      res.send(result);
    });

    app.get("/users/verified", verifyToken, async (req, res) => {
      try {
        const result = await usersCollection
          .find({ isVerified: true })
          .toArray();
        res.send(result);
      } catch (error) {
        console.log(error);
      }
    });

    app.post("/user/message", verifyToken, async (req, res) => {
      const newMessage = req.body;
      newMessage.created_at = new Date().toISOString();
      const result = await messageCollection.insertOne(newMessage);
      res.send(result);
    });
    app.get("/user/message", verifyToken, verifyAdmin, async (req, res) => {
      const result = await messageCollection.find().toArray();
      res.send(result);
    });

    app.post("/payment-request", verifyToken, async (req, res) => {
      try {
        const paymentInfo = req.body;
        const { employeeEmail, month, year } = paymentInfo;

        if (!employeeEmail || !month || !year) {
          return res
            .status(400)
            .send({ message: "Employee email, month, and year are required." });
        }

        // ❗ Check if any request already exists (paid or unpaid)
        const existingPayment = await paymentCollection.findOne({
          employeeEmail,
          month: month.toLowerCase(),
          year,
        });

        if (existingPayment) {
          return res.status(400).send({
            message: "Payment request already exists for this month and year.",
          });
        }

        paymentInfo.created_at = new Date();
        paymentInfo.month = month.toLowerCase();

        const result = await paymentCollection.insertOne(paymentInfo);
        res.send(result);
      } catch (error) {
        console.error(error);
        res.status(500).send({ message: "Failed to create payment request." });
      }
    });

    app.get("/payment", async (req, res) => {
      const payment = await paymentCollection.find().toArray();
      res.send(payment);
    });

    //stripe payment
    app.post(
      "/create-payment-intent",
      verifyToken,
      verifyAdmin,
      async (req, res) => {
        const { salary } = req.body;
        const amount = parseInt(salary * 100);

        try {
          const paymentIntent = await stripe.paymentIntents.create({
            amount,
            currency: "usd",
            payment_method_types: ["card"],
          });

          res.send({ clientSecret: paymentIntent.client_secret });
        } catch (error) {
          res.status(500).send({ message: "Failed to create payment intent" });
        }
      }
    );

    app.post("/payment-request", verifyToken, verifyHR, async (req, res) => {
      const { employeeEmail, month, year } = req.body;
      const existing = await paymentCollection.findOne({
        employeeEmail,
        month,
        year,
        paymentDate: { $ne: null },
      });

      if (existing) {
        return res
          .status(400)
          .send({ message: "Already paid for this month/year" });
      }

      req.body.created_at = new Date();
      const result = await paymentCollection.insertOne(req.body);
      res.send(result);
    });

    app.patch(
      "/payment/pay/:id",
      verifyToken,
      verifyAdmin,
      async (req, res) => {
        const id = req.params.id;
        const { transactionId } = req.body;

        try {
          const result = await paymentCollection.updateOne(
            { _id: new ObjectId(id) },
            {
              $set: {
                paymentDate: new Date(),
                transactionId: transactionId || null,
              },
            }
          );

          res.send(result);
        } catch (err) {
          console.error("Error updating payment:", err);
          res.status(500).send({ message: "Failed to update payment" });
        }
      }
    );

    // GET /payment-history?email=employee@email.com&page=1&limit=5
    app.get("/payment-history", verifyToken, async (req, res) => {
      try {
        const { email, page = 1, limit = 5 } = req.query;

        if (!email) {
          return res.status(400).send({ message: "Email is required" });
        }

        const pageNum = parseInt(page);
        const limitNum = parseInt(limit);

        const query = {
          employeeEmail: email,
          paymentDate: { $ne: null }, // only show paid
        };

        const totalPayments = await paymentCollection.countDocuments(query);
        const totalPages = Math.ceil(totalPayments / limitNum);

        const payments = await paymentCollection
          .find(query)
          .sort({ paymentDate: 1 }) // oldest payment first
          .skip((pageNum - 1) * limitNum)
          .limit(limitNum)
          .toArray();

        res.send({
          data: payments,
          totalPages,
          currentPage: pageNum,
        });
      } catch (error) {
        console.error("Payment history error:", error);
        res.status(500).send({ message: "Failed to fetch payment history" });
      }
    });

    // PATCH /users/:id
    app.patch("/users/:id", verifyToken, async (req, res) => {
      const { role, status, salary, isVerified } = req.body;
      const updateFields = {};

      if (role) updateFields.role = role.toUpperCase();
      if (status) updateFields.status = status;
      if (salary) updateFields.salary = salary;

      if (isVerified != undefined) updateFields.isVerified = isVerified;

      const result = await usersCollection.updateOne(
        { _id: new ObjectId(req.params.id) },
        { $set: updateFields }
      );
      res.send(result);
    });

    // await client.db("admin").command({ ping: 1 });
    console.log(
      "Pinged your deployment. You successfully connected to MongoDB!"
    );
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}

run().catch(console.dir);

app.listen(port, () => {
  console.log(`Example app listening on port ${port}`);
});
