const mongoose = require('mongoose');

const rewardSchema = new mongoose.Schema({
  title: {
    type: String,
    required: [true, 'Reward title is required'],
    trim: true
  },
  description: String,
  pointsRequired: {
    type: Number,
    required: [true, 'Points required is required'],
    min: [1, 'Points required must be at least 1']
  },
  order: {
    type: Number,
    required: [true, 'Order is required'],
    unique: true
  },
  image: String,
  category: {
    type: String,
    enum: ['stationery', 'books', 'electronics', 'certificates', 'other'],
    default: 'other'
  },
  isActive: {
    type: Boolean,
    default: true
  },
  claimedBy: [{
    student: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    claimedAt: {
      type: Date,
      default: Date.now
    },
    status: {
      type: String,
      enum: ['pending', 'delivered', 'cancelled'],
      default: 'pending'
    }
  }],
  createdAt: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

// Virtual for total claims
rewardSchema.virtual('totalClaims').get(function() {
  return this.claimedBy.length;
});

// Ensure virtual fields are serialized
rewardSchema.set('toJSON', { virtuals: true });

module.exports = mongoose.model('Reward', rewardSchema);