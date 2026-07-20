// const { name } = require("ejs");
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
const BackOfficeUserSchema = new mongoose.Schema({
    bUserID:String,
    bUsername:String,
    bEmail:String,
    
    
});

const guardSchema = new mongoose.Schema({
    imgurl:String,
    name:String,
    email:String,
    mobile:String,
    statusIsActive:Boolean,
    assignClient:[{
     name: { type: String, required: true },
      id: { type: String, required: true }
                }],
    assignPost:[
    {
      siteName: { type: String, required: true },
      postSiteID: { type: String, required: true }
    }
  ],
    
    

    
});

const siteSchema = new mongoose.Schema({
    siteName:String,
    address:String,
    clientID:String,
    clientName:String,
    guardAssignedID:String,
    guardAssignedName:String,
    lat:String,
    long:String,
    statusIsActive:Boolean,
    reportRecipients:[String],
    
});
const reportSchema = new mongoose.Schema({
    reportCategory:String,
    reportType:String,
    client:String,
    postSite:String,
    guard:String,
    note:String,
    time:String,
    date:String,
    img:[{
      desc:String,
      url:String,
    }],


    

    
});

const clockReportSchema = new mongoose.Schema({

    clockInTime:String,
    clockOutTime:String,
    duration:String,
    workTime:String,
    breakTime:String,
    shiftTemplateId:String,
    shiftTitle:String,
    shiftStartTime:String,
    shiftEndTime:String,
    overtime:String,
    overtimeSeconds:Number,
    

    
});

const checkedReportSchema = new mongoose.Schema({
    client:String,
    postSite:String,
    guardName:String,
    guardId:String,
    checkIn:Boolean,
    checkInTime:String,
    // checkOut:Boolean,
    checkOutTime:String,
    // clockInTime:String,
    // clockOutTime:String,
    clock:[clockReportSchema],
    reportInfo:{reportSchema},

    
});

const notificationSchema = new mongoose.Schema({

    name:String,
    email:String,
    type:String,
    activityId:String,
    readBy:[String],
    message:String,
    createdAt:{ type: Date, default: Date.now },
    // breakTime:String,
    

    
});






const companyInfoSchema = new mongoose.Schema({
  companyName:String,
  backOfficeUser:[BackOfficeUserSchema],
  postSite:[siteSchema],
  checkedReport:[checkedReportSchema],
  report:[reportSchema],
  guards:[guardSchema],
  companyJoinCode:String,
  isBlocked:{ type:Boolean, default:false },
  blockedAt:{ type:Date, default:null },
  blockedReason:{ type:String, default:"" },
  activity:[notificationSchema],
  
//   userRole:String,
//   email_verify:Boolean,
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

// companyInfoSchema.plugin(passportLocalMongoose , {selectFields: "username password"});


module.exports = companyInfoSchema;

