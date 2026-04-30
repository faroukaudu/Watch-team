const mongoose = require("mongoose");

function appDb(schema, modelName) {
  return mongoose.models[modelName] || mongoose.model(modelName, schema);
}

module.exports = appDb;