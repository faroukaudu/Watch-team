const myModule = require('./index.js');
const app = myModule.main;

app.listen(process.env.PORT || 9000, function(req,res){
    console.log("Watch TEAM is now running @ port 9000!");
  });
  