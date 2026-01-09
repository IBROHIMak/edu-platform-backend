const mongoose = require('mongoose');

const exerciseSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true
  },
  description: String,
  pageRange: {
    from: Number,
    to: Number
  },
  exerciseNumbers: [String],
  explanationVideo: {
    url: String,
    title: String,
    duration: Number
  },
  points: {
    type: Number,
    default: 10
  }
});

const homeworkSchema = new mongoose.Schema({
  title: {
    type: String,
    required: [true, 'Homework title is required'],
    trim: true
  },
  description: String,
  group: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Group',
    required: [true, 'Group is required']
  },
  teacher: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'Teacher is required']
  },
  exercises: [exerciseSchema],
  dueDate: {
    type: Date,
    required: [true, 'Due date is required']
  },
  totalPoints: {
    type: Number,
    default: 0
  },
  submissions: [{
    student: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    submittedAt: {
      type: Date,
      default: Date.now
    },
    exercises: [{
      exerciseId: mongoose.Schema.Types.ObjectId,
      answer: String,
      attachments: [String],
      grade: {
        type: Number,
        min: 0,
        max: 10
      },
      feedback: String,
      gradedAt: Date,
      gradedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
      }
    }],
    totalGrade: {
      type: Number,
      min: 0,
      max: 10
    },
    status: {
      type: String,
      enum: ['submitted', 'graded', 'late'],
      default: 'submitted'
    }
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

// Calculate total points before saving
homeworkSchema.pre('save', function(next) {
  this.totalPoints = this.exercises.reduce((total, exercise) => total + exercise.points, 0);
  next();
});

module.exports = mongoose.model('Homework', homeworkSchema);