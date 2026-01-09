const express = require('express');
const Competition = require('../models/Competition');
const User = require('../models/User');
const { auth, authorize } = require('../middleware/auth');

const router = express.Router();

// @route   GET /api/competitions
// @desc    Get competitions
// @access  Private
router.get('/', auth, async (req, res) => {
  try {
    let query = { isActive: true };
    
    // Students see competitions for their group
    if (req.user.role === 'student') {
      query.eligibleGroups = req.user.group;
    }

    const competitions = await Competition.find(query)
      .populate('eligibleGroups', 'name subject level')
      .populate('createdBy', 'firstName lastName')
      .populate('participants.student', 'firstName lastName')
      .populate('winners.student', 'firstName lastName')
      .sort({ startDate: -1 });

    // For students, add participation status
    if (req.user.role === 'student') {
      const competitionsWithStatus = competitions.map(comp => {
        const participation = comp.participants.find(p => 
          p.student._id.toString() === req.user._id.toString()
        );
        
        return {
          ...comp.toObject(),
          isParticipating: !!participation,
          userScore: participation ? participation.score : 0
        };
      });
      
      return res.json({
        success: true,
        data: { competitions: competitionsWithStatus }
      });
    }

    res.json({
      success: true,
      data: { competitions }
    });
  } catch (error) {
    console.error('Get competitions error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// @route   POST /api/competitions
// @desc    Create competition
// @access  Private (Teacher)
router.post('/', auth, authorize('teacher'), async (req, res) => {
  try {
    const { title, description, startDate, endDate, eligibleGroups, rules, prizes } = req.body;

    const competition = await Competition.create({
      title,
      description,
      startDate,
      endDate,
      eligibleGroups,
      rules,
      prizes,
      createdBy: req.user._id
    });

    res.status(201).json({
      success: true,
      message: 'Competition created successfully',
      data: { competition }
    });
  } catch (error) {
    console.error('Create competition error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// @route   POST /api/competitions/:id/participate
// @desc    Join competition
// @access  Private (Student)
router.post('/:id/participate', auth, authorize('student'), async (req, res) => {
  try {
    const competition = await Competition.findById(req.params.id);
    if (!competition) {
      return res.status(404).json({
        success: false,
        message: 'Competition not found'
      });
    }

    // Check if competition is active
    if (competition.status !== 'active') {
      return res.status(400).json({
        success: false,
        message: 'Competition is not active'
      });
    }

    // Check if student's group is eligible
    const isEligible = competition.eligibleGroups.some(groupId => 
      groupId.toString() === req.user.group.toString()
    );

    if (!isEligible) {
      return res.status(400).json({
        success: false,
        message: 'Your group is not eligible for this competition'
      });
    }

    // Check if already participating
    const alreadyParticipating = competition.participants.find(p => 
      p.student.toString() === req.user._id.toString()
    );

    if (alreadyParticipating) {
      return res.status(400).json({
        success: false,
        message: 'Already participating in this competition'
      });
    }

    competition.participants.push({
      student: req.user._id
    });

    await competition.save();

    res.json({
      success: true,
      message: 'Successfully joined competition'
    });
  } catch (error) {
    console.error('Join competition error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

module.exports = router;