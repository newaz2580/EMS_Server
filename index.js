require('dotenv').config()
const express = require('express')
const cors = require('cors')
const app = express()
const port =process.env.PORT || 3000
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
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

        
    // const PurchaseServiceCollection = client
    //   .db("serviceSharing")
      // .collection("bookingService");
    // Send a ping to confirm a successful connection
    app.post('/users',async(req,res)=>{
      const userData=req.body
      userData.created_at=new Date().toISOString()
      userData.last_loggedIn=new Date().toISOString()
      userData.isVerified=false
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
  const id = req.params.id; // ⬅️ user ID from URL
  const { isVerified } = req.body; // ⬅️ isVerified status from frontend

  const result = await usersCollection.updateOne(
    { _id: new ObjectId(id) },       // 🔍 find user by ID
    { $set: { isVerified } }         // ✅ update only the isVerified field
  );

  res.send(result); // 🔁 send update result
});

    app.get('/user-role/:email',async(req,res)=>{
     try{
       const email=req.params.email
      const user=await usersCollection.findOne({email})
      if(!user){
        return res.status(404).send({message:'user not found'})
      }
      res.send({role:user?.userRole})

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