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


const clientInfoSchema = new mongoose.Schema({
  compAssigned:String,
  fullname:String,
  username:String,
  phone:String,
  // ifuserOnline:Boolean,
  email:{
    type:String,
    unique:false,
    required: true,
  },
  password:String,
  Acc_status:Boolean,
  // userRole:String,
  email_verify:Boolean,
  userType:String,
//   phone:String,
//   regDate:String,
//   country:String,
//   emcMember:Boolean,
//   emcID:Number,
//   profile_pic:String,
//   auth:String,
//   admin:Boolean,
//   bank_info:[bankInfoSchema],

},
{timestamps: true}

);

clientInfoSchema.plugin(passportLocalMongoose , {selectFields: "username password"});


module.exports = clientInfoSchema;

