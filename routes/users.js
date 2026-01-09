const express = require('express');
const User = require('../models/User');
const Rating = require('../models/Rating');
const { auth, authorize } = require('../middleware/auth');

const router = express.Router();

// @route   GET /api/users/students/:groupId
// @desc    Get students in a group with ratings
// @access  Private (Teacher)
router.get('/students/:groupId', auth, authorize('teacher'), async (req, res) => {
  try {
    const students = await User.find({ 
      group: req.params.groupId, 
      role: 'student' 
    }).select('-password');

    const studentsWithRatings = await Promise.all(
      students.map(async (student) => {
        const rating = await Rating.findOne({ 
          student: student._id, 
          group: req.params.groupId 
        });
        return {
          ...student.toObject(),
          rating: rating || { totalScore: 0, rankInGroup: 0 }
        };
      })
    );

    // Sort by total score for ranking
    studentsWithRatings.sort((a, b) => b.rating.totalScore - a.rating.totalScore);
    
    // Update rankings
    studentsWithRatings.forEach((student, index) => {
      student.rating.rankInGroup = index + 1;
    });

    res.json({
      success: true,
      data: { students: studentsWithRatings }
    });
  } catch (error) {
    console.error('Get students error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// @route   GET /api/users/student-stats/:studentId
// @desc    Get detailed student statistics
// @access  Private (Teacher, Parent, Student)
router.get('/student-stats/:studentId', auth, async (req, res) => {
  try {
    const studentId = req.params.studentId;
    
    // Check permissions
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

    const student = await User.findById(studentId)
      .select('-password')
      .populate('group', 'name subject level');

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

    res.json({
      success: true,
      data: { 
        student,
        rating: rating || { totalScore: 0, rankInGroup: 0 }
      }
    });
  } catch (error) {
    console.error('Get student stats error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

module.exports = router;
// @route   GET /api/users/parent/children
// @desc    Get parent's children with detailed info
// @access  Private (Parent)
router.get('/parent/children', auth, authorize('parent'), async (req, res) => {
  try {
    const children = await User.find({ 
      _id: { $in: req.user.children } 
    })
    .select('-password')
    .populate('group', 'name subject level teacher')
    .populate('group.teacher', 'firstName lastName');

    const childrenWithStats = await Promise.all(
      children.map(async (child) => {
        const rating = await Rating.findOne({ 
          student: child._id, 
          group: child.group._id 
        });

        // Get recent homework completion
        const Homework = require('../models/Homework');
        const recentHomework = await Homework.find({ 
          group: child.group._id 
        })
        .sort({ createdAt: -1 })
        .limit(10);

        let completedHomework = 0;
        recentHomework.forEach(hw => {
          const submission = hw.submissions.find(sub => 
            sub.student.toString() === child._id.toString()
          );
          if (submission) completedHomework++;
        });

        const homeworkCompletionRate = recentHomework.length > 0 
          ? Math.round((completedHomework / recentHomework.length) * 100) 
          : 0;

        return {
          ...child.toObject(),
          rating: rating || { 
            totalScore: 0, 
            rankInGroup: 0, 
            attendance: 0,
            grades: 0 
          },
          homeworkCompletionRate,
          recentGrades: rating?.recentGrades || []
        };
      })
    );

    res.json({
      success: true,
      data: { children: childrenWithStats }
    });
  } catch (error) {
    console.error('Get parent children error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// @route   GET /api/users/parent/child-progress/:childId
// @desc    Get detailed progress data for a child
// @access  Private (Parent)
router.get('/parent/child-progress/:childId', auth, authorize('parent'), async (req, res) => {
  try {
    const childId = req.params.childId;
    
    // Verify this is parent's child
    const isChild = req.user.children.some(child => child.toString() === childId);
    if (!isChild) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized'
      });
    }

    const child = await User.findById(childId)
      .select('-password')
      .populate('group', 'name subject level');

    const rating = await Rating.findOne({ 
      student: childId, 
      group: child.group._id 
    });

    // Get homework statistics
    const Homework = require('../models/Homework');
    const homework = await Homework.find({ group: child.group._id });
    
    let homeworkStats = {
      total: homework.length,
      completed: 0,
      pending: 0,
      overdue: 0,
      averageGrade: 0
    };

    let totalGrades = 0;
    let gradeCount = 0;

    homework.forEach(hw => {
      const submission = hw.submissions.find(sub => 
        sub.student.toString() === childId
      );
      
      if (submission) {
        homeworkStats.completed++;
        if (submission.totalGrade) {
          totalGrades += submission.totalGrade;
          gradeCount++;
        }
      } else {
        if (new Date() > hw.dueDate) {
          homeworkStats.overdue++;
        } else {
          homeworkStats.pending++;
        }
      }
    });

    homeworkStats.averageGrade = gradeCount > 0 ? totalGrades / gradeCount : 0;

    res.json({
      success: true,
      data: { 
        child,
        rating: rating || { totalScore: 0, rankInGroup: 0 },
        homeworkStats,
        progressData: {
          overallProgress: {
            currentGrade: rating?.grades || 0,
            previousGrade: (rating?.grades || 0) - 0.3,
            trend: 'up',
            improvement: 0.3
          }
        }
      }
    });
  } catch (error) {
    console.error('Get child progress error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// @route   PUT /api/users/profile
// @desc    Update user profile
// @access  Private
router.put('/profile', auth, async (req, res) => {
  try {
    const { firstName, lastName, phone, email, address, birthDate, occupation } = req.body;
    
    const updateData = {};
    if (firstName) updateData.firstName = firstName;
    if (lastName) updateData.lastName = lastName;
    if (phone) updateData.phone = phone;
    if (email) updateData.email = email;
    if (address) updateData.address = address;
    if (birthDate) updateData.birthDate = birthDate;
    if (occupation) updateData.occupation = occupation;

    const user = await User.findByIdAndUpdate(
      req.user._id,
      updateData,
      { new: true }
    ).select('-password');

    res.json({
      success: true,
      message: 'Profile updated successfully',
      data: { user }
    });
  } catch (error) {
    console.error('Update profile error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});