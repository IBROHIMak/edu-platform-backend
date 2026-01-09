const express = require('express');
const { body, validationResult } = require('express-validator');
const Message = require('../models/Message');
const User = require('../models/User');
const Group = require('../models/Group');
const { auth } = require('../middleware/auth');

const router = express.Router();

// @route   GET /api/messages
// @desc    Get messages for user
// @access  Private
router.get('/', auth, async (req, res) => {
  try {
    const { page = 1, limit = 20, conversationWith } = req.query;
    
    let query = {
      $or: [
        { sender: req.user._id },
        { recipient: req.user._id }
      ],
      isDeleted: false
    };

    // Filter by conversation partner
    if (conversationWith) {
      query = {
        $or: [
          { sender: req.user._id, recipient: conversationWith },
          { sender: conversationWith, recipient: req.user._id }
        ],
        isDeleted: false
      };
    }

    const messages = await Message.find(query)
      .populate('sender', 'firstName lastName role studentId teacherId')
      .populate('recipient', 'firstName lastName role studentId teacherId')
      .populate('relatedGroup', 'name')
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    // Mark messages as read if they're for current user
    const unreadMessages = messages.filter(msg => 
      msg.recipient._id.toString() === req.user._id.toString() && !msg.isRead
    );

    if (unreadMessages.length > 0) {
      await Message.updateMany(
        { 
          _id: { $in: unreadMessages.map(msg => msg._id) },
          recipient: req.user._id 
        },
        { 
          isRead: true, 
          readAt: new Date() 
        }
      );
    }

    res.json({
      success: true,
      data: { 
        messages,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total: await Message.countDocuments(query)
        }
      }
    });
  } catch (error) {
    console.error('Get messages error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// @route   GET /api/messages/available-contacts
// @desc    Get available contacts for messaging based on user role
// @access  Private
router.get('/available-contacts', auth, async (req, res) => {
  try {
    let contacts = [];

    if (req.user.role === 'student') {
      // Students can message their teachers
      const student = await User.findById(req.user._id);
      if (student.group) {
        const group = await Group.findById(student.group).populate('teacher', 'firstName lastName teacherId subject');
        if (group && group.teacher) {
          contacts.push({
            _id: group.teacher._id,
            firstName: group.teacher.firstName,
            lastName: group.teacher.lastName,
            role: 'teacher',
            teacherId: group.teacher.teacherId,
            subject: group.teacher.subject,
            groupName: group.name,
            relationship: 'O\'qituvchi'
          });
        }
      }
    } else if (req.user.role === 'teacher') {
      // Teachers can message their students
      const groups = await Group.find({ teacher: req.user._id }).populate('students', 'firstName lastName studentId');
      for (const group of groups) {
        for (const student of group.students) {
          contacts.push({
            _id: student._id,
            firstName: student.firstName,
            lastName: student.lastName,
            role: 'student',
            studentId: student.studentId,
            groupName: group.name,
            relationship: 'O\'quvchi'
          });
        }
      }
    } else if (req.user.role === 'parent') {
      // Parents can message their children's teachers
      const parent = await User.findById(req.user._id).populate('children');
      for (const child of parent.children) {
        if (child.group) {
          const group = await Group.findById(child.group).populate('teacher', 'firstName lastName teacherId subject');
          if (group && group.teacher) {
            contacts.push({
              _id: group.teacher._id,
              firstName: group.teacher.firstName,
              lastName: group.teacher.lastName,
              role: 'teacher',
              teacherId: group.teacher.teacherId,
              subject: group.teacher.subject,
              groupName: group.name,
              childName: `${child.firstName} ${child.lastName}`,
              relationship: 'Farzand o\'qituvchisi'
            });
          }
        }
      }
    } else if (req.user.role === 'admin') {
      // Admins can message everyone including parents
      const allUsers = await User.find({ 
        _id: { $ne: req.user._id },
        role: { $in: ['student', 'teacher', 'parent'] }
      }).select('firstName lastName role studentId teacherId parentType childName');
      
      contacts = allUsers.map(user => ({
        _id: user._id,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
        studentId: user.studentId,
        teacherId: user.teacherId,
        parentType: user.parentType,
        childName: user.childName,
        relationship: user.role === 'student' ? 'O\'quvchi' : 
                     user.role === 'teacher' ? 'O\'qituvchi' : 
                     user.role === 'parent' ? 'Ota-ona' : 'Foydalanuvchi'
      }));
    }

    res.json({
      success: true,
      data: { contacts }
    });
  } catch (error) {
    console.error('Get contacts error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// @route   POST /api/messages
// @desc    Send a message
// @access  Private
router.post('/', [
  body('recipient').notEmpty().withMessage('Recipient is required'),
  body('content').trim().notEmpty().withMessage('Message content is required')
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

    const { recipient, subject, content, type, priority, relatedGroup } = req.body;
    const recipientId = recipient;

    // Verify recipient exists
    const recipientUser = await User.findById(recipientId);
    if (!recipientUser) {
      return res.status(404).json({
        success: false,
        message: 'Recipient not found'
      });
    }

    // Create message
    const message = new Message({
      sender: req.user._id,
      recipient: recipientId,
      subject: subject || 'Message',
      content,
      type: type || 'general',
      priority: priority || 'normal',
      relatedGroup: relatedGroup || null
    });

    await message.save();

    // Populate the response
    await message.populate('sender', 'firstName lastName role studentId teacherId');
    await message.populate('recipient', 'firstName lastName role studentId teacherId');
    await message.populate('relatedGroup', 'name');

    // Emit real-time notification
    const io = req.app.get('io');
    if (io) {
      io.to(`user_${recipientId}`).emit('new_message', {
        message: message
      });
    }

    res.status(201).json({
      success: true,
      message: 'Message sent successfully',
      data: { message }
    });
  } catch (error) {
    console.error('Send message error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// @route   GET /api/messages/conversations
// @desc    Get conversation list
// @access  Private
router.get('/conversations', auth, async (req, res) => {
  try {
    const conversations = await Message.aggregate([
      {
        $match: {
          $or: [
            { sender: req.user._id },
            { recipient: req.user._id }
          ],
          isDeleted: false
        }
      },
      {
        $sort: { createdAt: -1 }
      },
      {
        $group: {
          _id: {
            $cond: [
              { $eq: ['$sender', req.user._id] },
              '$recipient',
              '$sender'
            ]
          },
          lastMessage: { $first: '$$ROOT' },
          unreadCount: {
            $sum: {
              $cond: [
                {
                  $and: [
                    { $eq: ['$recipient', req.user._id] },
                    { $eq: ['$isRead', false] }
                  ]
                },
                1,
                0
              ]
            }
          }
        }
      },
      {
        $lookup: {
          from: 'users',
          localField: '_id',
          foreignField: '_id',
          as: 'user'
        }
      },
      {
        $unwind: '$user'
      },
      {
        $project: {
          user: {
            _id: '$user._id',
            firstName: '$user.firstName',
            lastName: '$user.lastName',
            role: '$user.role',
            avatar: '$user.avatar',
            studentId: '$user.studentId',
            teacherId: '$user.teacherId'
          },
          lastMessage: '$lastMessage',
          unreadCount: '$unreadCount'
        }
      },
      {
        $sort: { 'lastMessage.createdAt': -1 }
      }
    ]);

    res.json({
      success: true,
      data: { conversations }
    });
  } catch (error) {
    console.error('Get conversations error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// @route   PUT /api/messages/:messageId/read
// @desc    Mark message as read
// @access  Private
router.put('/:messageId/read', auth, async (req, res) => {
  try {
    const message = await Message.findOneAndUpdate(
      { 
        _id: req.params.messageId,
        recipient: req.user._id 
      },
      { 
        isRead: true,
        readAt: new Date()
      },
      { new: true }
    );

    if (!message) {
      return res.status(404).json({
        success: false,
        message: 'Message not found'
      });
    }

    res.json({
      success: true,
      data: { message }
    });
  } catch (error) {
    console.error('Mark message read error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// @route   DELETE /api/messages/:messageId
// @desc    Delete message
// @access  Private
router.delete('/:messageId', auth, async (req, res) => {
  try {
    const message = await Message.findOneAndUpdate(
      { 
        _id: req.params.messageId,
        $or: [
          { sender: req.user._id },
          { recipient: req.user._id }
        ]
      },
      { isDeleted: true },
      { new: true }
    );

    if (!message) {
      return res.status(404).json({
        success: false,
        message: 'Message not found'
      });
    }

    res.json({
      success: true,
      message: 'Message deleted successfully'
    });
  } catch (error) {
    console.error('Delete message error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

module.exports = router;