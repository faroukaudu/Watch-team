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
const planSchema = new mongoose.Schema({
    planName:String,
    amountPerUser:Number,
    duration:String,


    
},
{timestamps: true});




userInfoSchema.plugin(passportLocalMongoose,
{selectFields: "username userType status"}
);


module.exports = planSchema;

