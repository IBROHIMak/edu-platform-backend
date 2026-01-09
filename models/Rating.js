const mongoose = require('mongoose');

const ratingSchema = new mongoose.Schema({
  student: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'Student is required']
  },
  group: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Group',
    required: [true, 'Group is required']
  },
  // Rating components (1-10 scale)
  grades: {
    type: Number,
    min: 0,
    max: 10,
    default: 0
  },
  attendance: {
    type: Number,
    min: 0,
    max: 10,
    default: 0
  },
  homeworkCompletion: {
    type: Number,
    min: 0,
    max: 10,
    default: 0
  },
  classParticipation: {
    type: Number,
    min: 0,
    max: 10,
    default: 0
  },
  // Calculated fields
  totalScore: {
    type: Number,
    min: 0,
    max: 10,
    default: 0
  },
  rankInGroup: {
    type: Number,
    default: 0
  },
  // Detailed statistics
  totalHomeworks: {
    type: Number,
    default: 0
  },
  completedHomeworks: {
    type: Number,
    default: 0
  },
  totalClasses: {
    type: Number,
    default: 0
  },
  attendedClasses: {
    type: Number,
    default: 0
  },
  participationCount: {
    type: Number,
    default: 0
  },
  averageGrade: {
    type: Number,
    min: 0,
    max: 10,
    default: 0
  },
  // Monthly breakdown
  monthlyStats: [{
    month: Number,
    year: Number,
    grades: Number,
    attendance: Number,
    homeworkCompletion: Number,
    classParticipation: Number,
    totalScore: Number
  }],
  lastUpdated: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

// Calculate total score before saving
ratingSchema.pre('save', function(next) {
  // Weighted calculation: grades 40%, attendance 25%, homework 25%, participation 10%
  this.totalScore = Math.round(
    (this.grades * 0.4) + 
    (this.attendance * 0.25) + 
    (this.homeworkCompletion * 0.25) + 
    (this.classParticipation * 0.1)
  );
  
  // Calculate percentages
  if (this.totalHomeworks > 0) {
    this.homeworkCompletion = Math.round((this.completedHomeworks / this.totalHomeworks) * 10);
  }
  
  if (this.totalClasses > 0) {
    this.attendance = Math.round((this.attendedClasses / this.totalClasses) * 10);
  }
  
  this.lastUpdated = new Date();
  next();
});

// Index for efficient ranking queries
ratingSchema.index({ group: 1, totalScore: -1 });
ratingSchema.index({ student: 1, group: 1 }, { unique: true });

module.exports = mongoose.model('Rating', ratingSchema);