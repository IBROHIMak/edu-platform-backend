const express = require('express');
const { body, validationResult } = require('express-validator');
const { auth } = require('../middleware/auth');
const User = require('../models/User');

const router = express.Router();

// Mock bonus tasks data
const bonusTasksData = [
  {
    id: 1,
    title: 'Kundalik o\'qish',
    description: '30 daqiqa kitob o\'qing',
    points: 10,
    type: 'daily',
    category: 'reading',
    difficulty: 'easy',
    timeLimit: 24 * 60 * 60 * 1000, // 24 hours
    requirements: ['Kamida 30 daqiqa o\'qish', 'Kitob haqida qisqa xulosani yozish']
  },
  {
    id: 2,
    title: 'Qo\'shimcha mashq',
    description: '5 ta qo\'shimcha masala yeching',
    points: 25,
    type: 'weekly',
    category: 'practice',
    difficulty: 'medium',
    timeLimit: 7 * 24 * 60 * 60 * 1000, // 7 days
    requirements: ['5 ta masala yechish', 'Yechim jarayonini tushuntirish']
  },
  {
    id: 3,
    title: 'Guruh yordamchisi',
    description: 'Sinfdoshingizga yordam bering',
    points: 15,
    type: 'social',
    category: 'teamwork',
    difficulty: 'easy',
    timeLimit: 3 * 24 * 60 * 60 * 1000, // 3 days
    requirements: ['Sinfdoshga yordam berish', 'Ustoz tasdig\'i olish']
  },
  {
    id: 4,
    title: 'Ijodiy loyiha',
    description: 'Fan bo\'yicha prezentatsiya tayyorlang',
    points: 50,
    type: 'project',
    category: 'creativity',
    difficulty: 'hard',
    timeLimit: 14 * 24 * 60 * 60 * 1000, // 14 days
    requirements: ['10 slaydli prezentatsiya', 'Kamida 3 ta manba', 'Amaliy misollar']
  },
  {
    id: 5,
    title: 'Laboratoriya tajribasi',
    description: 'Uyda xavfsiz tajriba o\'tkazing',
    points: 30,
    type: 'experiment',
    category: 'science',
    difficulty: 'medium',
    timeLimit: 5 * 24 * 60 * 60 * 1000, // 5 days
    requirements: ['Xavfsizlik qoidalarini bajarish', 'Natijalarni hujjatlash', 'Video yoki foto hisobot']
  },
  {
    id: 6,
    title: 'Matematik olimpiada tayyorligi',
    description: 'Olimpiada masalalarini yeching',
    points: 40,
    type: 'competition',
    category: 'mathematics',
    difficulty: 'hard',
    timeLimit: 10 * 24 * 60 * 60 * 1000, // 10 days
    requirements: ['20 ta olimpiada masalasi', 'Yechim strategiyalarini tahlil qilish']
  },
  {
    id: 7,
    title: 'Ekologik loyiha',
    description: 'Atrof-muhitni muhofaza qilish loyihasi',
    points: 35,
    type: 'environmental',
    category: 'ecology',
    difficulty: 'medium',
    timeLimit: 7 * 24 * 60 * 60 * 1000, // 7 days
    requirements: ['Muammo aniqlash', 'Yechim taklif qilish', 'Amaliy qadamlar rejasi']
  },
  {
    id: 8,
    title: 'Til o\'rganish',
    description: 'Yangi 50 ta so\'z o\'rganing',
    points: 20,
    type: 'language',
    category: 'linguistics',
    difficulty: 'easy',
    timeLimit: 7 * 24 * 60 * 60 * 1000, // 7 days
    requirements: ['50 ta yangi so\'z', 'Har bir so\'z bilan gap tuzish', 'Talaffuz mashqi']
  }
];

// @route   GET /api/bonus-tasks
// @desc    Get all available bonus tasks
// @access  Private
router.get('/', auth, async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    
    // Get user's completed tasks
    const completedTasks = user.completedBonusTasks || [];
    
    // Add completion status to tasks
    const tasksWithStatus = bonusTasksData.map(task => ({
      ...task,
      completed: completedTasks.some(ct => ct.taskId === task.id),
      completedAt: completedTasks.find(ct => ct.taskId === task.id)?.completedAt || null
    }));

    res.json({
      success: true,
      data: {
        tasks: tasksWithStatus,
        totalAvailable: bonusTasksData.length,
        totalCompleted: completedTasks.length,
        totalPoints: completedTasks.reduce((sum, ct) => {
          const task = bonusTasksData.find(t => t.id === ct.taskId);
          return sum + (task ? task.points : 0);
        }, 0)
      }
    });
  } catch (error) {
    console.error('Error fetching bonus tasks:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// @route   POST /api/bonus-tasks/:taskId/complete
// @desc    Mark a bonus task as completed
// @access  Private
router.post('/:taskId/complete', [
  body('proof').optional().isString().withMessage('Proof must be a string'),
  body('notes').optional().isString().withMessage('Notes must be a string')
], auth, async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation errors',
        errors: errors.array()
      });
    }

    const taskId = parseInt(req.params.taskId);
    const { proof, notes } = req.body;

    // Find the task
    const task = bonusTasksData.find(t => t.id === taskId);
    if (!task) {
      return res.status(404).json({
        success: false,
        message: 'Bonus task not found'
      });
    }

    const user = await User.findById(req.user._id);
    
    // Check if already completed
    const alreadyCompleted = user.completedBonusTasks?.some(ct => ct.taskId === taskId);
    if (alreadyCompleted) {
      return res.status(400).json({
        success: false,
        message: 'Task already completed'
      });
    }

    // Add to completed tasks
    if (!user.completedBonusTasks) {
      user.completedBonusTasks = [];
    }

    user.completedBonusTasks.push({
      taskId: taskId,
      completedAt: new Date(),
      proof: proof || '',
      notes: notes || '',
      pointsEarned: task.points
    });

    // Add points to user
    user.points = (user.points || 0) + task.points;

    // Add achievement if this is a milestone
    const completedCount = user.completedBonusTasks.length;
    if (completedCount === 1) {
      user.achievements.push({
        title: 'Birinchi bonus vazifa',
        description: 'Birinchi bonus vazifangizni muvaffaqiyatli bajardingiz!',
        earnedAt: new Date()
      });
    } else if (completedCount === 5) {
      user.achievements.push({
        title: 'Faol o\'quvchi',
        description: '5 ta bonus vazifani bajardingiz!',
        earnedAt: new Date()
      });
    } else if (completedCount === 10) {
      user.achievements.push({
        title: 'Bonus ustasi',
        description: '10 ta bonus vazifani bajardingiz!',
        earnedAt: new Date()
      });
    }

    await user.save();

    res.json({
      success: true,
      message: 'Bonus task completed successfully!',
      data: {
        pointsEarned: task.points,
        totalPoints: user.points,
        newAchievements: user.achievements.slice(-1) // Return last achievement if any
      }
    });
  } catch (error) {
    console.error('Error completing bonus task:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// @route   GET /api/bonus-tasks/leaderboard
// @desc    Get bonus tasks leaderboard
// @access  Private
router.get('/leaderboard', auth, async (req, res) => {
  try {
    const users = await User.find({ role: 'student' })
      .select('firstName lastName points completedBonusTasks')
      .sort({ points: -1 })
      .limit(10);

    const leaderboard = users.map((user, index) => ({
      rank: index + 1,
      name: `${user.firstName} ${user.lastName}`,
      points: user.points || 0,
      completedTasks: user.completedBonusTasks?.length || 0
    }));

    res.json({
      success: true,
      data: { leaderboard }
    });
  } catch (error) {
    console.error('Error fetching leaderboard:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

module.exports = router;