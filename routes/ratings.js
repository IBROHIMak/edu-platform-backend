const express = require('express');
const Rating = require('../models/Rating');
const User = require('../models/User');
const { auth, authorize } = require('../middleware/auth');

const router = express.Router();

// @route   GET /api/ratings/student/:studentId
// @desc    Get student rating
// @access  Private
router.get('/student/:studentId', auth, async (req, res) => {
  try {
    const studentId = req.params.studentId;
    
    // Permission check
    if (req.user.role === 'student' && req.user._id.toString() !== studentId) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized'
      });
    }

    if (req.user.role === 'parent') {
      const isChild = req.user.children.some(child => child.toString() === studentId);
      if (!isChild) {
        return res.status(403).json({
          success: false,
          message: 'Not authorized'
        });
      }
    }

    const student = await User.findById(studentId).populate('group');
    if (!student) {
      return res.status(404).json({
        success: false,
        message: 'Student not found'
      });
    }

    const rating = await Rating.findOne({ 
      student: studentId, 
      group: student.group._id 
    });

    if (!rating) {
      return res.status(404).json({
        success: false,
        message: 'Rating not found'
      });
    }

    // Get group rankings
    const groupRatings = await Rating.find({ 
      group: student.group._id 
    })
    .populate('student', 'firstName lastName')
    .sort({ totalScore: -1 });

    // Update rankings
    groupRatings.forEach((r, index) => {
      r.rankInGroup = index + 1;
    });

    // Save updated rankings
    await Promise.all(groupRatings.map(r => r.save()));

    const currentRating = groupRatings.find(r => 
      r.student._id.toString() === studentId
    );

    res.json({
      success: true,
      data: { 
        rating: currentRating,
        groupRankings: groupRatings
      }
    });
  } catch (error) {
    console.error('Get rating error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// @route   PUT /api/ratings/student/:studentId
// @desc    Update student rating
// @access  Private (Teacher)
router.put('/student/:studentId', auth, authorize('teacher'), async (req, res) => {
  try {
    const { 
      grades, 
      attendance, 
      homeworkCompletion, 
      classParticipation,
      attendedClasses,
      totalClasses,
      participationCount
    } = req.body;

    const student = await User.findById(req.params.studentId).populate('group');
    if (!student) {
      return res.status(404).json({
        success: false,
        message: 'Student not found'
      });
    }

    let rating = await Rating.findOne({ 
      student: req.params.studentId, 
      group: student.group._id 
    });

    if (!rating) {
      rating = new Rating({
        student: req.params.studentId,
        group: student.group._id
      });
    }

    // Update rating components
    if (grades !== undefined) rating.grades = grades;
    if (attendance !== undefined) rating.attendance = attendance;
    if (homeworkCompletion !== undefined) rating.homeworkCompletion = homeworkCompletion;
    if (classParticipation !== undefined) rating.classParticipation = classParticipation;
    if (attendedClasses !== undefined) rating.attendedClasses = attendedClasses;
    if (totalClasses !== undefined) rating.totalClasses = totalClasses;
    if (participationCount !== undefined) rating.participationCount = participationCount;

    await rating.save();

    res.json({
      success: true,
      message: 'Rating updated successfully',
      data: { rating }
    });
  } catch (error) {
    console.error('Update rating error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// @route   GET /api/ratings/group/:groupId
// @desc    Get group rankings
// @access  Private (Teacher)
router.get('/group/:groupId', auth, authorize('teacher'), async (req, res) => {
  try {
    const ratings = await Rating.find({ group: req.params.groupId })
      .populate('student', 'firstName lastName points')
      .sort({ totalScore: -1 });

    // Update rankings
    ratings.forEach((rating, index) => {
      rating.rankInGroup = index + 1;
    });

    // Save updated rankings
    await Promise.all(ratings.map(r => r.save()));

    res.json({
      success: true,
      data: { ratings }
    });
  } catch (error) {
    console.error('Get group ratings error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

module.exports = router;