const mongoose = require('mongoose');

const competitionSchema = new mongoose.Schema({
  title: {
    type: String,
    required: [true, 'Competition title is required'],
    trim: true
  },
  description: String,
  startDate: {
    type: Date,
    required: [true, 'Start date is required']
  },
  endDate: {
    type: Date,
    required: [true, 'End date is required']
  },
  eligibleGroups: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Group'
  }],
  rules: [String],
  prizes: [{
    position: {
      type: Number,
      required: true
    },
    title: String,
    description: String,
    points: Number,
    gift: String
  }],
  participants: [{
    student: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    registeredAt: {
      type: Date,
      default: Date.now
    },
    score: {
      type: Number,
      default: 0
    },
    submissions: [{
      submittedAt: Date,
      content: String,
      attachments: [String],
      grade: Number
    }]
  }],
  winners: [{
    student: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    position: Number,
    prize: String,
    announcedAt: {
      type: Date,
      default: Date.now
    }
  }],
  status: {
    type: String,
    enum: ['upcoming', 'active', 'completed', 'cancelled'],
    default: 'upcoming'
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
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

// Virtual for participant count
competitionSchema.virtual('participantCount').get(function() {
  return this.participants.length;
});

// Update status based on dates
competitionSchema.pre('save', function(next) {
  const now = new Date();
  if (now < this.startDate) {
    this.status = 'upcoming';
  } else if (now >= this.startDate && now <= this.endDate) {
    this.status = 'active';
  } else if (now > this.endDate && this.status !== 'cancelled') {
    this.status = 'completed';
  }
  next();
});

// Ensure virtual fields are serialized
competitionSchema.set('toJSON', { virtuals: true });

module.exports = mongoose.model('Competition', competitionSchema);