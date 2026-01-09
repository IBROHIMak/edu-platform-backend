const mongoose = require('mongoose');

const groupSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Group name is required'],
    trim: true,
    unique: true
  },
  subject: {
    type: String,
    required: [true, 'Subject is required'],
    default: 'English Language Teaching'
  },
  level: {
    type: String,
    enum: ['beginner', 'elementary', 'intermediate', 'upper-intermediate', 'advanced'],
    required: [true, 'Level is required'],
    default: 'beginner'
  },
  teacher: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: false // Made optional for new workflow
  },
  students: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }],
  maxStudents: {
    type: Number,
    default: 25,
    min: 5,
    max: 50
  },
  description: {
    type: String,
    trim: true
  },
  schedule: [{
    day: {
      type: String,
      enum: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday']
    },
    startTime: String,
    endTime: String,
    room: String
  }],
  isActive: {
    type: Boolean,
    default: true
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

// Virtual for student count
groupSchema.virtual('studentCount').get(function() {
  return this.students ? this.students.length : 0;
});

// Ensure virtual fields are serialized
groupSchema.set('toJSON', { virtuals: true });

module.exports = mongoose.model('Group', groupSchema);