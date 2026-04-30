const passport = require("passport");
const mongoose = require("mongoose");

function registerStrategy(strategyName, model) {
  passport.use(strategyName, model.createStrategy());

  passport.serializeUser((user, cb) => {
    cb(null, { id: user._id, type: user.constructor.modelName });
  });

  passport.deserializeUser(async (obj, cb) => {
    try {
      const Model = mongoose.model(obj.type);
      const user = await Model.findById(obj.id);
      cb(null, user);
    } catch (err) {
      cb(err);
    }
  });
}

module.exports = registerStrategy;