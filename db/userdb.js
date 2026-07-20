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


const userInfoSchema = new mongoose.Schema({
  compName:String,
  fullname:String,
  username:String,
  phone:String,
  address:String,
  // ifuserOnline:Boolean,
  email:{
    type:String,
    unique:false,
    required: true,
  },
  password:String,
  Acc_status:Boolean,
  userRole:String,
  email_verify:Boolean,
  userType:String,
  assignedCompanyID:String,
  status:Boolean,
  isBlocked:{ type:Boolean, default:false },
  blockedAt:{ type:Date, default:null },
  blockedReason:{ type:String, default:"" },
  lastLogin:String,
  passwordResetCode:String,
passwordResetExpires:Date,
emailVerificationCode: String,
emailVerificationExpires: Date,
emailVerified: {
  type: Boolean,
  default: false
},
passwordResetVerified:{ type:Boolean, default:false },
  guardClients:[{
     name: { type: String, required: true },
      id: { type: String, required: true }
                }],
  guardPostSite:[
    {
      siteName: { type: String, required: true },
      postSiteID: { type: String, required: true }
    }
  ],
//   phone:String,
//   regDate:String,
//   country:String,
//   emcMember:Boolean,
//   emcID:Number,
//   profile_pic:String,
//   auth:String,
//   admin:Boolean,
//   bank_info:[bankInfoSchema],
mobilePasswordResetOtpHash: String,
  mobilePasswordResetExpires: Date,
  mobilePasswordResetVerified: {
    type: Boolean,
    default: false,
  },
  mobilePasswordResetTokenHash: String,
},
{timestamps: true}

);

userInfoSchema.plugin(passportLocalMongoose , {selectFields: "username userType status"});


module.exports = userInfoSchema;

