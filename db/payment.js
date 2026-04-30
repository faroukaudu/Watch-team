const mongoose = require("mongoose");
const passportLocalMongoose = require("passport-local-mongoose");
// var db = require(__dirname + "/connection.js");
mongoose.set('strictQuery', true);
// const uri = "mongodb+srv://fancy98com:E6eoFBqkfDsweSKB@cluster0.rom3xsn.mongodb.net/flyboy";
// const uri = "mongodb://127.0.0.1:27017/gitportalDB";
// async function database() {
//   await mongoose.connect(uri);
// }
//database().catch(err => console.log(err));


const paymentSchema = new mongoose.Schema({
  companyName:String,
  compId:{
    type:String,
    unique:false,
    required: true,
  },
  payerName:String,
  payerId:String,
  address:String,
  // ifuserOnline:Boolean,
  email:{
    type:String,
    unique:false,
    required: true,
  },


},
{timestamps: true}

);

userInfoSchema.plugin(passportLocalMongoose , {selectFields: "username userType status"});


module.exports = userInfoSchema;

