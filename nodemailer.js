
const nodemailer = require('nodemailer');

async function emailSent({sendTo:to, title:subject, message:msg, template:html, emailType:emailType}){
  console.log(to);
  console.log(subject);
  console.log(msg);
  const transporter = nodemailer.createTransport({
    host:"localhost",
    tls: {
    rejectUnauthorized: true,
    servername:"gmail.com"
  },
    service: "gmail",
    
    auth: {
      user: "surerealintegratedserviceltd@gmail.com",
      pass: "vvheoqjyhbksmffr"
    }
  });

  transporter.verify(function(error, success) {
   if (error) {
        console.log(error);
   } else {
        console.log('Server is ready');
   }
});



  const mail2Send = {
    from:"Watch Team Security <noreply.watchteam@gmail.com>",
    replyTo: 'noreply.watchteam@gmail.com',
    to: to,
    subject:subject,
    text:msg,
    //text:"Click this link to reset your password.."+ " " +"https://localhost:2000/pwdtoken/"+msg,
    // text:"Click this link to reset your password.."+ " " +"https://stingray-app-lgdmb.ondigitalocean.app/pwdtoken/",
    html:html 
  };

  transporter.sendMail(mail2Send, function(err, info){
    if(err){
      console.log(err);
    }else{
      console.log("send "+ info);
    }
    //console.log("send "+ info);c
  });


}
//emailSent("fagzy99@gmail.com", "Online", "Check me wella");
 module.exports = {emailSent};
