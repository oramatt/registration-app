const mongoose = require('mongoose');

const registrationSchema = new mongoose.Schema({
  name: {
    type: String,
    trim: true,
    required: true,
  },
  email: {
    type: String,
    trim: true,
    required: true,
  },
  notes: {
    type: String,
    trim: true,
  },
  image: {
    type: String,
    trim: true,
  }
});

module.exports = mongoose.model('Registration', registrationSchema);
