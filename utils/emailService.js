const nodemailer = require('nodemailer');

// Email templates
const emailTemplates = {
  homeworkAssigned: (data) => ({
    subject: `Yangi uy vazifasi: ${data.homeworkTitle}`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #2563eb;">Yangi uy vazifasi berildi</h2>
        <p>Hurmatli ${data.studentName},</p>
        <p><strong>"${data.homeworkTitle}"</strong> uy vazifasi berildi.</p>
        <div style="background-color: #f3f4f6; padding: 15px; border-radius: 8px; margin: 20px 0;">
          <p><strong>Muddat:</strong> ${data.dueDate}</p>
          <p><strong>Fan:</strong> ${data.subject}</p>
          <p><strong>Ustoz:</strong> ${data.teacherName}</p>
        </div>
        <p>Uy vazifasini ko'rish uchun platformaga kiring.</p>
        <a href="${data.platformUrl}" style="background-color: #2563eb; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; display: inline-block;">Platformaga kirish</a>
      </div>
    `
  }),

  homeworkGraded: (data) => ({
    subject: `Uy vazifangiz baholandi: ${data.homeworkTitle}`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #059669;">Uy vazifangiz baholandi</h2>
        <p>Hurmatli ${data.studentName},</p>
        <p><strong>"${data.homeworkTitle}"</strong> uy vazifangiz baholandi.</p>
        <div style="background-color: #f0fdf4; padding: 15px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #059669;">
          <p><strong>Baho:</strong> <span style="font-size: 24px; color: #059669;">${data.grade}/10</span></p>
          ${data.feedback ? `<p><strong>Ustoz izohi:</strong> ${data.feedback}</p>` : ''}
        </div>
        <p>Batafsil ma'lumot uchun platformaga kiring.</p>
        <a href="${data.platformUrl}" style="background-color: #059669; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; display: inline-block;">Natijalarni ko'rish</a>
      </div>
    `
  }),

  parentNotification: (data) => ({
    subject: `Farzandingiz haqida xabar: ${data.subject}`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #7c3aed;">Farzandingiz haqida xabar</h2>
        <p>Hurmatli ${data.parentName},</p>
        <p>Farzandingiz <strong>${data.childName}</strong> haqida yangi ma'lumot:</p>
        <div style="background-color: #faf5ff; padding: 15px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #7c3aed;">
          <p>${data.message}</p>
        </div>
        <p>Batafsil ma'lumot uchun platformaga kiring.</p>
        <a href="${data.platformUrl}" style="background-color: #7c3aed; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; display: inline-block;">Platformaga kirish</a>
      </div>
    `
  }),

  competitionStarted: (data) => ({
    subject: `Yangi musobaqa: ${data.competitionTitle}`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #dc2626;">🏆 Yangi musobaqa boshlandi!</h2>
        <p>Hurmatli ${data.studentName},</p>
        <p><strong>"${data.competitionTitle}"</strong> musobaqasi boshlandi!</p>
        <div style="background-color: #fef2f2; padding: 15px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #dc2626;">
          <p><strong>Boshlanish sanasi:</strong> ${data.startDate}</p>
          <p><strong>Tugash sanasi:</strong> ${data.endDate}</p>
          <p><strong>Mukofotlar:</strong></p>
          <ul>
            ${data.prizes.map(prize => `<li>${prize.position}-o'rin: ${prize.description}</li>`).join('')}
          </ul>
        </div>
        <p>Ishtirok etish uchun platformaga kiring!</p>
        <a href="${data.platformUrl}" style="background-color: #dc2626; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; display: inline-block;">Ishtirok etish</a>
      </div>
    `
  }),

  weeklyReport: (data) => ({
    subject: `Haftalik hisobot: ${data.studentName}`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #2563eb;">📊 Haftalik hisobot</h2>
        <p>Hurmatli ${data.parentName},</p>
        <p>Farzandingiz <strong>${data.studentName}</strong>ning o'tgan hafta natijalari:</p>
        
        <div style="background-color: #f8fafc; padding: 20px; border-radius: 8px; margin: 20px 0;">
          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px;">
            <div>
              <h3 style="color: #374151; margin-bottom: 10px;">📚 Uy vazifalari</h3>
              <p>Bajarilgan: <strong>${data.homeworkCompleted}/${data.homeworkTotal}</strong></p>
              <p>O'rtacha baho: <strong>${data.averageGrade}</strong></p>
            </div>
            <div>
              <h3 style="color: #374151; margin-bottom: 10px;">🕐 Davomat</h3>
              <p>Kelgan kunlar: <strong>${data.attendedDays}/${data.totalDays}</strong></p>
              <p>Davomat foizi: <strong>${data.attendanceRate}%</strong></p>
            </div>
          </div>
          
          <div style="margin-top: 20px;">
            <h3 style="color: #374151; margin-bottom: 10px;">🏆 Yutuqlar</h3>
            <p>Yig'ilgan ballar: <strong>+${data.pointsEarned}</strong></p>
            <p>Guruhda o'rni: <strong>${data.rankInGroup}-o'rin</strong></p>
          </div>
        </div>
        
        <p>Batafsil hisobot uchun platformaga kiring.</p>
        <a href="${data.platformUrl}" style="background-color: #2563eb; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; display: inline-block;">Batafsil ko'rish</a>
      </div>
    `
  })
};

// Create email transporter
const createTransporter = () => {
  return nodemailer.createTransporter({
    host: process.env.SMTP_HOST || 'smtp.gmail.com',
    port: process.env.SMTP_PORT || 587,
    secure: false,
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS
    }
  });
};

// Send email function
const sendEmail = async (to, templateName, data) => {
  try {
    if (!process.env.SMTP_USER || !process.env.SMTP_PASS) {
      console.log('Email service not configured. Skipping email send.');
      return { success: false, message: 'Email service not configured' };
    }

    const transporter = createTransporter();
    const template = emailTemplates[templateName];
    
    if (!template) {
      throw new Error(`Email template '${templateName}' not found`);
    }

    const { subject, html } = template(data);

    const mailOptions = {
      from: `"EduPlatform" <${process.env.SMTP_USER}>`,
      to,
      subject,
      html
    };

    const result = await transporter.sendMail(mailOptions);
    
    return {
      success: true,
      messageId: result.messageId,
      message: 'Email sent successfully'
    };
  } catch (error) {
    console.error('Email send error:', error);
    return {
      success: false,
      message: error.message
    };
  }
};

// Send homework assignment email
const sendHomeworkAssignedEmail = async (student, homework, teacher) => {
  if (!student.email) return { success: false, message: 'Student email not found' };

  return await sendEmail(student.email, 'homeworkAssigned', {
    studentName: `${student.firstName} ${student.lastName}`,
    homeworkTitle: homework.title,
    dueDate: new Date(homework.dueDate).toLocaleDateString('uz-UZ'),
    subject: homework.subject || 'Umumiy',
    teacherName: `${teacher.firstName} ${teacher.lastName}`,
    platformUrl: process.env.CLIENT_URL || 'http://localhost:3000'
  });
};

// Send homework graded email
const sendHomeworkGradedEmail = async (student, homework, grade, feedback) => {
  if (!student.email) return { success: false, message: 'Student email not found' };

  return await sendEmail(student.email, 'homeworkGraded', {
    studentName: `${student.firstName} ${student.lastName}`,
    homeworkTitle: homework.title,
    grade,
    feedback,
    platformUrl: process.env.CLIENT_URL || 'http://localhost:3000'
  });
};

// Send parent notification email
const sendParentNotificationEmail = async (parent, child, subject, message) => {
  if (!parent.email) return { success: false, message: 'Parent email not found' };

  return await sendEmail(parent.email, 'parentNotification', {
    parentName: `${parent.firstName} ${parent.lastName}`,
    childName: `${child.firstName} ${child.lastName}`,
    subject,
    message,
    platformUrl: process.env.CLIENT_URL || 'http://localhost:3000'
  });
};

// Send competition started email
const sendCompetitionStartedEmail = async (student, competition) => {
  if (!student.email) return { success: false, message: 'Student email not found' };

  return await sendEmail(student.email, 'competitionStarted', {
    studentName: `${student.firstName} ${student.lastName}`,
    competitionTitle: competition.title,
    startDate: new Date(competition.startDate).toLocaleDateString('uz-UZ'),
    endDate: new Date(competition.endDate).toLocaleDateString('uz-UZ'),
    prizes: competition.prizes,
    platformUrl: process.env.CLIENT_URL || 'http://localhost:3000'
  });
};

// Send weekly report email to parents
const sendWeeklyReportEmail = async (parent, child, reportData) => {
  if (!parent.email) return { success: false, message: 'Parent email not found' };

  return await sendEmail(parent.email, 'weeklyReport', {
    parentName: `${parent.firstName} ${parent.lastName}`,
    studentName: `${child.firstName} ${child.lastName}`,
    ...reportData,
    platformUrl: process.env.CLIENT_URL || 'http://localhost:3000'
  });
};

// Bulk email sender
const sendBulkEmails = async (recipients, templateName, dataGenerator) => {
  const results = [];
  
  for (const recipient of recipients) {
    try {
      const data = await dataGenerator(recipient);
      const result = await sendEmail(recipient.email, templateName, data);
      results.push({ recipient: recipient.email, ...result });
    } catch (error) {
      results.push({ 
        recipient: recipient.email, 
        success: false, 
        message: error.message 
      });
    }
  }
  
  return results;
};

module.exports = {
  sendEmail,
  sendHomeworkAssignedEmail,
  sendHomeworkGradedEmail,
  sendParentNotificationEmail,
  sendCompetitionStartedEmail,
  sendWeeklyReportEmail,
  sendBulkEmails
};