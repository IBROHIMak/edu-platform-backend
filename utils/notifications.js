const User = require('../models/User');
const Message = require('../models/Message');

// Notification types
const NOTIFICATION_TYPES = {
  HOMEWORK_ASSIGNED: 'homework_assigned',
  HOMEWORK_GRADED: 'homework_graded',
  HOMEWORK_DUE_SOON: 'homework_due_soon',
  HOMEWORK_OVERDUE: 'homework_overdue',
  GRADE_UPDATED: 'grade_updated',
  ATTENDANCE_MARKED: 'attendance_marked',
  COMPETITION_STARTED: 'competition_started',
  COMPETITION_ENDED: 'competition_ended',
  REWARD_AVAILABLE: 'reward_available',
  MESSAGE_RECEIVED: 'message_received',
  PARENT_NOTIFICATION: 'parent_notification'
};

// Create notification
const createNotification = async (io, data) => {
  const {
    type,
    recipient,
    title,
    message,
    relatedData = {},
    priority = 'normal'
  } = data;

  try {
    // Create system message as notification
    const notification = await Message.create({
      sender: null, // System message
      recipient,
      content: message,
      type: 'system',
      priority,
      relatedHomework: relatedData.homeworkId,
      relatedStudent: relatedData.studentId
    });

    // Emit real-time notification
    if (io) {
      io.to(`user_${recipient}`).emit('notification', {
        id: notification._id,
        type,
        title,
        message,
        priority,
        createdAt: notification.createdAt,
        relatedData
      });
    }

    return notification;
  } catch (error) {
    console.error('Error creating notification:', error);
    throw error;
  }
};

// Send homework assignment notification to students
const notifyHomeworkAssigned = async (io, homework) => {
  try {
    const students = await User.find({ 
      group: homework.group,
      role: 'student' 
    });

    const notifications = students.map(student => 
      createNotification(io, {
        type: NOTIFICATION_TYPES.HOMEWORK_ASSIGNED,
        recipient: student._id,
        title: 'Yangi uy vazifasi',
        message: `"${homework.title}" uy vazifasi berildi. Muddat: ${new Date(homework.dueDate).toLocaleDateString('uz-UZ')}`,
        relatedData: { homeworkId: homework._id },
        priority: 'normal'
      })
    );

    await Promise.all(notifications);
    
    // Also notify parents
    const parents = await User.find({
      role: 'parent',
      children: { $in: students.map(s => s._id) }
    });

    const parentNotifications = parents.map(parent =>
      createNotification(io, {
        type: NOTIFICATION_TYPES.PARENT_NOTIFICATION,
        recipient: parent._id,
        title: 'Farzandingizga uy vazifasi berildi',
        message: `"${homework.title}" uy vazifasi berildi. Muddat: ${new Date(homework.dueDate).toLocaleDateString('uz-UZ')}`,
        relatedData: { homeworkId: homework._id },
        priority: 'normal'
      })
    );

    await Promise.all(parentNotifications);
  } catch (error) {
    console.error('Error sending homework notifications:', error);
  }
};

// Send homework graded notification
const notifyHomeworkGraded = async (io, homework, studentId, grade) => {
  try {
    // Notify student
    await createNotification(io, {
      type: NOTIFICATION_TYPES.HOMEWORK_GRADED,
      recipient: studentId,
      title: 'Uy vazifasi baholandi',
      message: `"${homework.title}" uy vazifangiz baholandi. Baho: ${grade}`,
      relatedData: { homeworkId: homework._id, grade },
      priority: 'normal'
    });

    // Notify parent
    const student = await User.findById(studentId);
    const parents = await User.find({
      role: 'parent',
      children: studentId
    });

    const parentNotifications = parents.map(parent =>
      createNotification(io, {
        type: NOTIFICATION_TYPES.PARENT_NOTIFICATION,
        recipient: parent._id,
        title: 'Farzandingizning uy vazifasi baholandi',
        message: `${student.firstName} ${student.lastName}ning "${homework.title}" uy vazifasi baholandi. Baho: ${grade}`,
        relatedData: { homeworkId: homework._id, studentId, grade },
        priority: 'normal'
      })
    );

    await Promise.all(parentNotifications);
  } catch (error) {
    console.error('Error sending grade notifications:', error);
  }
};

// Send homework due soon notification
const notifyHomeworkDueSoon = async (io, homework) => {
  try {
    const students = await User.find({ 
      group: homework.group,
      role: 'student' 
    });

    // Find students who haven't submitted
    const unsubmittedStudents = students.filter(student => {
      const submission = homework.submissions.find(sub => 
        sub.student.toString() === student._id.toString()
      );
      return !submission;
    });

    const notifications = unsubmittedStudents.map(student => 
      createNotification(io, {
        type: NOTIFICATION_TYPES.HOMEWORK_DUE_SOON,
        recipient: student._id,
        title: 'Uy vazifasi muddati yaqinlashmoqda',
        message: `"${homework.title}" uy vazifasining muddati yaqinlashmoqda. Muddat: ${new Date(homework.dueDate).toLocaleDateString('uz-UZ')}`,
        relatedData: { homeworkId: homework._id },
        priority: 'high'
      })
    );

    await Promise.all(notifications);
  } catch (error) {
    console.error('Error sending due soon notifications:', error);
  }
};

// Send competition notification
const notifyCompetitionStarted = async (io, competition) => {
  try {
    const students = await User.find({ 
      group: { $in: competition.eligibleGroups },
      role: 'student' 
    });

    const notifications = students.map(student => 
      createNotification(io, {
        type: NOTIFICATION_TYPES.COMPETITION_STARTED,
        recipient: student._id,
        title: 'Yangi musobaqa boshlandi',
        message: `"${competition.title}" musobaqasi boshlandi. Ishtirok eting!`,
        relatedData: { competitionId: competition._id },
        priority: 'normal'
      })
    );

    await Promise.all(notifications);
  } catch (error) {
    console.error('Error sending competition notifications:', error);
  }
};

// Send reward available notification
const notifyRewardAvailable = async (io, studentId, reward) => {
  try {
    await createNotification(io, {
      type: NOTIFICATION_TYPES.REWARD_AVAILABLE,
      recipient: studentId,
      title: 'Yangi mukofot mavjud',
      message: `"${reward.title}" mukofotini olishingiz mumkin! Kerakli ball: ${reward.pointsRequired}`,
      relatedData: { rewardId: reward._id },
      priority: 'normal'
    });
  } catch (error) {
    console.error('Error sending reward notification:', error);
  }
};

// Send message notification
const notifyNewMessage = async (io, message) => {
  try {
    const sender = await User.findById(message.sender);
    
    await createNotification(io, {
      type: NOTIFICATION_TYPES.MESSAGE_RECEIVED,
      recipient: message.recipient,
      title: 'Yangi xabar',
      message: `${sender.firstName} ${sender.lastName}dan yangi xabar keldi`,
      relatedData: { messageId: message._id, senderId: message.sender },
      priority: message.priority || 'normal'
    });
  } catch (error) {
    console.error('Error sending message notification:', error);
  }
};

// Batch notification sender (for scheduled tasks)
const sendBatchNotifications = async (io) => {
  try {
    const now = new Date();
    const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000);

    // Find homework due tomorrow
    const Homework = require('../models/Homework');
    const homeworkDueSoon = await Homework.find({
      dueDate: {
        $gte: now,
        $lte: tomorrow
      },
      isActive: true
    });

    // Send due soon notifications
    for (const homework of homeworkDueSoon) {
      await notifyHomeworkDueSoon(io, homework);
    }

    // Find overdue homework
    const overdueHomework = await Homework.find({
      dueDate: { $lt: now },
      isActive: true
    });

    for (const homework of overdueHomework) {
      const students = await User.find({ 
        group: homework.group,
        role: 'student' 
      });

      const unsubmittedStudents = students.filter(student => {
        const submission = homework.submissions.find(sub => 
          sub.student.toString() === student._id.toString()
        );
        return !submission;
      });

      const notifications = unsubmittedStudents.map(student => 
        createNotification(io, {
          type: NOTIFICATION_TYPES.HOMEWORK_OVERDUE,
          recipient: student._id,
          title: 'Uy vazifasi muddati o\'tdi',
          message: `"${homework.title}" uy vazifasining muddati o'tgan. Tezroq topshiring!`,
          relatedData: { homeworkId: homework._id },
          priority: 'urgent'
        })
      );

      await Promise.all(notifications);
    }

    console.log('Batch notifications sent successfully');
  } catch (error) {
    console.error('Error sending batch notifications:', error);
  }
};

module.exports = {
  NOTIFICATION_TYPES,
  createNotification,
  notifyHomeworkAssigned,
  notifyHomeworkGraded,
  notifyHomeworkDueSoon,
  notifyCompetitionStarted,
  notifyRewardAvailable,
  notifyNewMessage,
  sendBatchNotifications
};