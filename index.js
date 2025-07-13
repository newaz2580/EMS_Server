require('dotenv').config()
const express = require('express')
const cors = require('cors')
const app = express()
const port =process.env.PORT || 3000
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
// Employee_Management
// SP22r4FKGAwNRutK
app.use(express.json());
app.use(cors())
app.get('/', (req, res) => {
  res.send('Hello World!')
})

const uri = `mongodb+srv://${process.env.USER_DB}:${process.env.PASS_DB}@cluster0.yzyltda.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  }
});

async function run() {
  try {
    // Connect the client to the server	(optional starting in v4.7)
    await client.connect();
        const usersCollection = client.db("employeeManagement").collection("users");
        const worksheetCollection = client.db("employeeManagement").collection("workSheet");
        const messageCollection = client.db("employeeManagement").collection("message");
        const paymentCollection = client.db("employeeManagement").collection("payment");



        
    // const PurchaseServiceCollection = client
    //   .db("serviceSharing")
      // .collection("bookingService");
    // Send a ping to confirm a successful connection
    app.post('/users',async(req,res)=>{
      const userData=req.body
      userData.created_at=new Date().toISOString()
      userData.last_loggedIn=new Date().toISOString()
      userData.isVerified=false
      userData.status="active"
      const query={email:userData.email}
      const alreadyExisting=await usersCollection.findOne(query)
      if(alreadyExisting){
        const result=await usersCollection.updateOne(query,
          { $set:{last_loggedIn:new Date().toISOString()}}
        )
        return res.send(result)
      }
      const result=await usersCollection.insertOne(userData)
      res.send(result)
    })
    app.get('/users',async(req,res)=>{
      const result=await usersCollection.find().toArray()
      res.send(result)
    })
   app.patch('/users/:id', async (req, res) => {
  const id = req.params.id;
  const { isVerified } = req.body; 

  const result = await usersCollection.updateOne(
    { _id: new ObjectId(id) },  
    { $set: { isVerified } }       
  );

  res.send(result);
});

    app.get('/user-role/:email',async(req,res)=>{
     try{
       const email=req.params.email
      const user=await usersCollection.findOne({email})
      if(!user){
        return res.status(404).send({message:'user not found'})
      }
      res.send({role:user?.role})

     }catch(error){
      res.status(500).send({message:'internal server error',error:error.message})
     }
    })
  


   app.post('/workSheet',async(req,res)=>{
    const newWork=req.body
    console.log(newWork)
    const result=await worksheetCollection.insertOne(newWork)
    res.send(result)

   })
    app.get('/workSheet',async(req,res)=>{
    const email=req.query.email
    const result=await worksheetCollection.find({email}).toArray()
    res.send(result)
   })
   app.delete('/workSheet/:id',async(req,res)=>{
    const id=req.params.id
    const query={_id:new ObjectId(id)}
    const result=await worksheetCollection.deleteOne(query)
    res.send(result)
   })
app.patch('/workSheet/:id', async (req, res) => {
  const id = req.params.id;
  const { tasks, hours, date } = req.body;

  const result = await worksheetCollection.updateOne(
    { _id: new ObjectId(id) },
    { $set: { tasks, hours, date } }
  );

  res.send(result);
});

app.get('/users/verified',async(req,res)=>{
  try {
    const result=await usersCollection.find({isVerified:true}).toArray()
  res.send(result)
  } catch (error) {
    console.log(error)
  }
})

app.post('/user/message',async(req,res)=>{
  const newMessage=req.body;
  newMessage.created_at=new Date().toISOString()
  const result=await messageCollection.insertOne(newMessage)
  res.send(result)
})
app.get('/user/message',async(req,res)=>{
  const result=await messageCollection.find().toArray()
  res.send(result)
})

app.post('/payment-request',async (req,res)=>{
  try {
  const paymentInfo=req.body
  paymentInfo.created_at=new Date()
  const payment=await paymentCollection.insertOne(paymentInfo)
  res.send(payment)
  } catch (error) {
    console.log(error)
  }
})
app.get('/payment',async(req,res)=>{
  const payment=await paymentCollection.find().toArray()
  res.send(payment)
})

//stripe payment
app.post('/create-payment-intent', async (req, res) => {
  const { salary } = req.body;
  const amount = parseInt(salary * 100); // Convert to cents

  try {
    const paymentIntent = await stripe.paymentIntents.create({
      amount,
      currency: 'usd',
      payment_method_types: ['card'],
    });

    res.send({ clientSecret: paymentIntent.client_secret });
  } catch (error) {
    res.status(500).send({ message: 'Failed to create payment intent' });
  }
});



app.post('/payment-request', async (req, res) => {
  const { employeeEmail, month, year } = req.body;

  const existing = await paymentCollection.findOne({
    employeeEmail,
    month,
    year,
    paymentDate: { $ne: null }, // already paid
  });

  if (existing) {
    return res.status(400).send({ message: 'Already paid for this month/year' });
  }

  req.body.created_at = new Date();
  const result = await paymentCollection.insertOne(req.body);
  res.send(result);
});


app.patch('/payment/pay/:id', async (req, res) => {
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
    console.error('Error updating payment:', err);
    res.status(500).send({ message: 'Failed to update payment' });
  }
});

app.get('/payment-history', async (req, res) => {
  try {
    const { email, page = 1, limit = 5 } = req.query;
    if (!email) return res.status(400).send({ message: 'Email is required' });

    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);

    const query = { requestedBy: email }; // ✅ This matches your DB structure

    const totalPayments = await paymentCollection.countDocuments(query);
    const totalPages = Math.ceil(totalPayments / limitNum);

    const payments = await paymentCollection
      .find(query)
      .sort({ year: 1, month: 1 }) // ✅ Earliest first
      .skip((pageNum - 1) * limitNum)
      .limit(limitNum)
      .toArray();

    res.send({
      data: payments,
      totalPages,
      currentPage: pageNum,
    });
  } catch (error) {
    console.error(error);
    res.status(500).send({ message: 'Failed to fetch payment history' });
  }
});


    await client.db("admin").command({ ping: 1 });
    console.log("Pinged your deployment. You successfully connected to MongoDB!");
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}





run().catch(console.dir);

app.listen(port, () => {
  console.log(`Example app listening on port ${port}`)
})