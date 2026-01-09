const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
  firstName: {
    type: String,
    required: [true, 'First name is required'],
    trim: true,
    maxlength: [50, 'First name cannot exceed 50 characters']
  },
  lastName: {
    type: String,
    required: [true, 'Last name is required'],
    trim: true,
    maxlength: [50, 'Last name cannot exceed 50 characters']
  },
  password: {
    type: String,
    required: [true, 'Password is required'],
    minlength: [6, 'Password must be at least 6 characters']
  },
  role: {
    type: String,
    enum: ['student', 'teacher', 'parent', 'admin'],
    required: [true, 'Role is required']
  },
  // Student specific fields
  studentId: {
    type: String,
    unique: true,
    sparse: true,
    required: function() { return this.role === 'student'; }
  },
  group: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Group',
    required: false // Made optional so students can be created without groups initially
  },
  points: {
    type: Number,
    default: 0
  },
  achievements: [{
    title: String,
    description: String,
    earnedAt: { type: Date, default: Date.now }
  }],
  completedBonusTasks: [{
    taskId: Number,
    completedAt: { type: Date, default: Date.now },
    proof: String,
    notes: String,
    pointsEarned: Number
  }],
  // Teacher specific fields
  teacherId: {
    type: String,
    unique: true,
    sparse: true,
    required: function() { return this.role === 'teacher'; }
  },
  subject: {
    type: String,
    required: function() { return this.role === 'teacher'; },
    default: function() { return this.role === 'teacher' ? 'yo\'q' : undefined; }
  },
  groupsTaught: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Group'
  }],
  schedule: [{
    day: { type: String, enum: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'] },
    startTime: String,
    endTime: String,
    group: { type: mongoose.Schema.Types.ObjectId, ref: 'Group' }
  }],
  // Parent specific fields
  parentType: {
    type: String,
    enum: ['father', 'mother', 'guardian'],
    required: function() { return this.role === 'parent'; }
  },
  childName: {
    type: String,
    required: function() { return this.role === 'parent'; }
  },
  children: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }],
  // Common fields
  phone: {
    type: String,
    trim: true
  },
  parentPhone: {
    type: String,
    trim: true,
    required: function() { return this.role === 'student'; }
  },
  address: {
    type: String,
    trim: true
  },
  birthDate: {
    type: Date
  },
  occupation: {
    type: String,
    trim: true
  },
  avatar: String,
  isActive: {
    type: Boolean,
    default: true
  },
  lastLogin: Date,
  preferences: {
    notifications: {
      homework: { type: Boolean, default: true },
      grades: { type: Boolean, default: true },
      attendance: { type: Boolean, default: true },
      messages: { type: Boolean, default: true },
      competitions: { type: Boolean, default: false }
    },
    privacy: {
      showPhone: { type: Boolean, default: false },
      showEmail: { type: Boolean, default: true },
      allowMessages: { type: Boolean, default: true }
    }
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

// Hash password before saving
userSchema.pre('save', async function(next) {
  if (!this.isModified('password')) return next();
  
  try {
    const salt = await bcrypt.genSalt(12);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (error) {
    next(error);
  }
});

// Compare password method
userSchema.methods.comparePassword = async function(candidatePassword) {
  return await bcrypt.compare(candidatePassword, this.password);
};

// Get full name
userSchema.virtual('fullName').get(function() {
  return `${this.firstName} ${this.lastName}`;
});

// Ensure virtual fields are serialized
userSchema.set('toJSON', { virtuals: true });

module.exports = mongoose.model('User', userSchema);