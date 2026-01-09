const express = require('express');
const Homework = require('../models/Homework');
const Rating = require('../models/Rating');
const { auth, authorize } = require('../middleware/auth');

const router = express.Router();

// @route   GET /api/homework/student
// @desc    Get homework for student
// @access  Private (Student)
router.get('/student', auth, authorize('student'), async (req, res) => {
  try {
    const homework = await Homework.find({ 
      group: req.user.group,
      isActive: true 
    })
    .populate('teacher', 'firstName lastName')
    .sort({ createdAt: -1 });

    // Add submission status for each homework
    const homeworkWithStatus = homework.map(hw => {
      const submission = hw.submissions.find(sub => 
        sub.student.toString() === req.user._id.toString()
      );
      
      return {
        ...hw.toObject(),
        submissionStatus: submission ? submission.status : 'not_submitted',
        studentGrade: submission ? submission.totalGrade : null,
        isOverdue: new Date() > hw.dueDate && !submission
      };
    });

    res.json({
      success: true,
      data: { homework: homeworkWithStatus }
    });
  } catch (error) {
    console.error('Get student homework error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// @route   POST /api/homework
// @desc    Create homework
// @access  Private (Teacher)
router.post('/', auth, authorize('teacher'), async (req, res) => {
  try {
    const { title, description, group, exercises, dueDate } = req.body;

    const homework = await Homework.create({
      title,
      description,
      group,
      teacher: req.user._id,
      exercises,
      dueDate
    });

    res.status(201).json({
      success: true,
      message: 'Homework created successfully',
      data: { homework }
    });
  } catch (error) {
    console.error('Create homework error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// @route   POST /api/homework/:id/submit
// @desc    Submit homework
// @access  Private (Student)
router.post('/:id/submit', auth, authorize('student'), async (req, res) => {
  try {
    const { exercises } = req.body;
    
    const homework = await Homework.findById(req.params.id);
    if (!homework) {
      return res.status(404).json({
        success: false,
        message: 'Homework not found'
      });
    }

    // Check if already submitted
    const existingSubmission = homework.submissions.find(sub => 
      sub.student.toString() === req.user._id.toString()
    );

    if (existingSubmission) {
      return res.status(400).json({
        success: false,
        message: 'Homework already submitted'
      });
    }

    const submission = {
      student: req.user._id,
      exercises,
      status: new Date() > homework.dueDate ? 'late' : 'submitted'
    };

    homework.submissions.push(submission);
    await homework.save();

    res.json({
      success: true,
      message: 'Homework submitted successfully'
    });
  } catch (error) {
    console.error('Submit homework error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// @route   PUT /api/homework/:id/grade
// @desc    Grade homework submission
// @access  Private (Teacher)
router.put('/:id/grade', auth, authorize('teacher'), async (req, res) => {
  try {
    const { studentId, exerciseGrades, totalGrade, feedback } = req.body;
    
    const homework = await Homework.findById(req.params.id);
    if (!homework) {
      return res.status(404).json({
        success: false,
        message: 'Homework not found'
      });
    }

    const submission = homework.submissions.find(sub => 
      sub.student.toString() === studentId
    );

    if (!submission) {
      return res.status(404).json({
        success: false,
        message: 'Submission not found'
      });
    }

    // Update grades
    submission.exercises.forEach((exercise, index) => {
      if (exerciseGrades[index]) {
        exercise.grade = exerciseGrades[index].grade;
        exercise.feedback = exerciseGrades[index].feedback;
        exercise.gradedAt = new Date();
        exercise.gradedBy = req.user._id;
      }
    });

    submission.totalGrade = totalGrade;
    submission.status = 'graded';

    await homework.save();

    // Update student rating
    await updateStudentRating(studentId, homework.group);

    res.json({
      success: true,
      message: 'Homework graded successfully'
    });
  } catch (error) {
    console.error('Grade homework error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// Helper function to update student rating
async function updateStudentRating(studentId, groupId) {
  try {
    const rating = await Rating.findOne({ student: studentId, group: groupId });
    if (!rating) return;

    // Get all graded homework for this student
    const homework = await Homework.find({ group: groupId });
    let totalGrades = 0;
    let gradeCount = 0;
    let completedHomeworks = 0;
    let totalHomeworks = homework.length;

    homework.forEach(hw => {
      const submission = hw.submissions.find(sub => 
        sub.student.toString() === studentId
      );
      if (submission) {
        completedHomeworks++;
        if (submission.totalGrade) {
          totalGrades += submission.totalGrade;
          gradeCount++;
        }
      }
    });

    rating.averageGrade = gradeCount > 0 ? totalGrades / gradeCount : 0;
    rating.grades = rating.averageGrade;
    rating.totalHomeworks = totalHomeworks;
    rating.completedHomeworks = completedHomeworks;

    await rating.save();
  } catch (error) {
    console.error('Update rating error:', error);
  }
}

module.exports = router;