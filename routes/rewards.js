const express = require('express');
const Reward = require('../models/Reward');
const User = require('../models/User');
const { auth, authorize } = require('../middleware/auth');

const router = express.Router();

// @route   GET /api/rewards
// @desc    Get all rewards
// @access  Private
router.get('/', auth, async (req, res) => {
  try {
    const rewards = await Reward.find({ isActive: true }).sort({ order: 1 });
    
    // For students, add claim status
    if (req.user.role === 'student') {
      const rewardsWithStatus = rewards.map(reward => {
        const claimed = reward.claimedBy.find(claim => 
          claim.student.toString() === req.user._id.toString()
        );
        
        return {
          ...reward.toObject(),
          canClaim: req.user.points >= reward.pointsRequired && !claimed,
          claimed: !!claimed,
          claimStatus: claimed ? claimed.status : null
        };
      });
      
      return res.json({
        success: true,
        data: { rewards: rewardsWithStatus, userPoints: req.user.points }
      });
    }

    res.json({
      success: true,
      data: { rewards }
    });
  } catch (error) {
    console.error('Get rewards error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// @route   POST /api/rewards/:id/claim
// @desc    Claim a reward
// @access  Private (Student)
router.post('/:id/claim', auth, authorize('student'), async (req, res) => {
  try {
    const reward = await Reward.findById(req.params.id);
    if (!reward) {
      return res.status(404).json({
        success: false,
        message: 'Reward not found'
      });
    }

    // Check if student has enough points
    if (req.user.points < reward.pointsRequired) {
      return res.status(400).json({
        success: false,
        message: 'Insufficient points'
      });
    }

    // Check if already claimed
    const alreadyClaimed = reward.claimedBy.find(claim => 
      claim.student.toString() === req.user._id.toString()
    );

    if (alreadyClaimed) {
      return res.status(400).json({
        success: false,
        message: 'Reward already claimed'
      });
    }

    // Check sequential order (can't skip rewards)
    const previousReward = await Reward.findOne({ 
      order: reward.order - 1,
      isActive: true 
    });

    if (previousReward) {
      const previousClaimed = previousReward.claimedBy.find(claim => 
        claim.student.toString() === req.user._id.toString()
      );
      
      if (!previousClaimed) {
        return res.status(400).json({
          success: false,
          message: 'Must claim previous rewards first'
        });
      }
    }

    // Add claim
    reward.claimedBy.push({
      student: req.user._id
    });

    // Deduct points from user
    await User.findByIdAndUpdate(req.user._id, {
      $inc: { points: -reward.pointsRequired }
    });

    await reward.save();

    res.json({
      success: true,
      message: 'Reward claimed successfully'
    });
  } catch (error) {
    console.error('Claim reward error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// @route   POST /api/rewards
// @desc    Create a reward
// @access  Private (Teacher)
router.post('/', auth, authorize('teacher'), async (req, res) => {
  try {
    const { title, description, pointsRequired, order, category, image } = req.body;

    const reward = await Reward.create({
      title,
      description,
      pointsRequired,
      order,
      category,
      image
    });

    res.status(201).json({
      success: true,
      message: 'Reward created successfully',
      data: { reward }
    });
  } catch (error) {
    console.error('Create reward error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

module.exports = router;