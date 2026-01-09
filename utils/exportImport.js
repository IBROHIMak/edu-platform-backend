const XLSX = require('xlsx');
const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');

// Export data to Excel
const exportToExcel = async (data, filename, sheetName = 'Sheet1') => {
  try {
    // Create workbook and worksheet
    const workbook = XLSX.utils.book_new();
    const worksheet = XLSX.utils.json_to_sheet(data);
    
    // Add worksheet to workbook
    XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);
    
    // Ensure exports directory exists
    const exportsDir = path.join(__dirname, '../exports');
    if (!fs.existsSync(exportsDir)) {
      fs.mkdirSync(exportsDir, { recursive: true });
    }
    
    // Write file
    const filePath = path.join(exportsDir, `${filename}.xlsx`);
    XLSX.writeFile(workbook, filePath);
    
    return {
      success: true,
      filePath,
      filename: `${filename}.xlsx`
    };
  } catch (error) {
    console.error('Excel export error:', error);
    return {
      success: false,
      message: error.message
    };
  }
};

// Export data to PDF
const exportToPDF = async (data, filename, title = 'Report') => {
  try {
    const exportsDir = path.join(__dirname, '../exports');
    if (!fs.existsSync(exportsDir)) {
      fs.mkdirSync(exportsDir, { recursive: true });
    }
    
    const filePath = path.join(exportsDir, `${filename}.pdf`);
    const doc = new PDFDocument();
    
    // Pipe to file
    doc.pipe(fs.createWriteStream(filePath));
    
    // Add title
    doc.fontSize(20).text(title, 50, 50);
    doc.moveDown();
    
    // Add data
    if (Array.isArray(data) && data.length > 0) {
      const headers = Object.keys(data[0]);
      let yPosition = 120;
      
      // Add headers
      doc.fontSize(12);
      headers.forEach((header, index) => {
        doc.text(header, 50 + (index * 100), yPosition);
      });
      
      yPosition += 20;
      
      // Add data rows
      data.forEach((row, rowIndex) => {
        if (yPosition > 700) { // New page if needed
          doc.addPage();
          yPosition = 50;
        }
        
        headers.forEach((header, colIndex) => {
          const value = row[header] || '';
          doc.text(String(value).substring(0, 15), 50 + (colIndex * 100), yPosition);
        });
        
        yPosition += 15;
      });
    }
    
    doc.end();
    
    return {
      success: true,
      filePath,
      filename: `${filename}.pdf`
    };
  } catch (error) {
    console.error('PDF export error:', error);
    return {
      success: false,
      message: error.message
    };
  }
};

// Export student grades report
const exportStudentGradesReport = async (students, groupName) => {
  try {
    const reportData = students.map(student => ({
      'Ism': student.firstName,
      'Familiya': student.lastName,
      'O\'quvchi ID': student.studentId,
      'Umumiy ball': student.rating?.totalScore || 0,
      'Baholar': student.rating?.grades || 0,
      'Davomat': student.rating?.attendance || 0,
      'Uy vazifalari': student.rating?.homeworkCompletion || 0,
      'Faollik': student.rating?.classParticipation || 0,
      'Guruhda o\'rni': student.rating?.rankInGroup || 0,
      'Yig\'ilgan ballar': student.points || 0
    }));
    
    const filename = `grades_report_${groupName}_${Date.now()}`;
    return await exportToExcel(reportData, filename, 'Baholar hisoboti');
  } catch (error) {
    console.error('Student grades export error:', error);
    return { success: false, message: error.message };
  }
};

// Export attendance report
const exportAttendanceReport = async (attendanceData, groupName, period) => {
  try {
    const reportData = attendanceData.map(record => ({
      'Ism': record.student.firstName,
      'Familiya': record.student.lastName,
      'Sana': new Date(record.date).toLocaleDateString('uz-UZ'),
      'Holat': record.status === 'present' ? 'Kelgan' : 
              record.status === 'absent' ? 'Kelmagan' : 'Kech kelgan',
      'Vaqt': record.time || '',
      'Sabab': record.reason || ''
    }));
    
    const filename = `attendance_report_${groupName}_${period}_${Date.now()}`;
    return await exportToExcel(reportData, filename, 'Davomat hisoboti');
  } catch (error) {
    console.error('Attendance export error:', error);
    return { success: false, message: error.message };
  }
};

// Export homework report
const exportHomeworkReport = async (homeworkData, groupName) => {
  try {
    const reportData = [];
    
    homeworkData.forEach(homework => {
      homework.submissions.forEach(submission => {
        reportData.push({
          'Uy vazifasi': homework.title,
          'O\'quvchi': `${submission.student.firstName} ${submission.student.lastName}`,
          'Topshirish sanasi': submission.submittedAt ? 
            new Date(submission.submittedAt).toLocaleDateString('uz-UZ') : 'Topshirilmagan',
          'Holat': submission.status === 'submitted' ? 'Topshirilgan' :
                   submission.status === 'graded' ? 'Baholangan' :
                   submission.status === 'late' ? 'Kech topshirilgan' : 'Topshirilmagan',
          'Baho': submission.totalGrade || '',
          'Muddat': new Date(homework.dueDate).toLocaleDateString('uz-UZ'),
          'Muddatdan kechikish': submission.submittedAt && 
            new Date(submission.submittedAt) > new Date(homework.dueDate) ? 'Ha' : 'Yo\'q'
        });
      });
    });
    
    const filename = `homework_report_${groupName}_${Date.now()}`;
    return await exportToExcel(reportData, filename, 'Uy vazifalari hisoboti');
  } catch (error) {
    console.error('Homework export error:', error);
    return { success: false, message: error.message };
  }
};

// Export parent report
const exportParentReport = async (childData, parentName) => {
  try {
    const reportData = [{
      'Farzand ismi': `${childData.firstName} ${childData.lastName}`,
      'Guruh': childData.group?.name || '',
      'Umumiy ball': childData.rating?.totalScore || 0,
      'Guruhda o\'rni': childData.rating?.rankInGroup || 0,
      'Davomat foizi': childData.rating?.attendance || 0,
      'Uy vazifalari foizi': childData.homeworkCompletionRate || 0,
      'O\'rtacha baho': childData.rating?.averageGrade || 0,
      'Yig\'ilgan ballar': childData.points || 0,
      'Hisobot sanasi': new Date().toLocaleDateString('uz-UZ')
    }];
    
    const filename = `parent_report_${parentName}_${Date.now()}`;
    return await exportToExcel(reportData, filename, 'Ota-ona hisoboti');
  } catch (error) {
    console.error('Parent report export error:', error);
    return { success: false, message: error.message };
  }
};

// Import students from Excel
const importStudentsFromExcel = async (filePath) => {
  try {
    const workbook = XLSX.readFile(filePath);
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    const data = XLSX.utils.sheet_to_json(worksheet);
    
    const students = data.map(row => ({
      firstName: row['Ism'] || row['firstName'],
      lastName: row['Familiya'] || row['lastName'],
      studentId: row['O\'quvchi ID'] || row['studentId'],
      email: row['Email'] || row['email'],
      phone: row['Telefon'] || row['phone'],
      birthDate: row['Tug\'ilgan sana'] || row['birthDate'],
      address: row['Manzil'] || row['address']
    }));
    
    return {
      success: true,
      data: students,
      count: students.length
    };
  } catch (error) {
    console.error('Import students error:', error);
    return {
      success: false,
      message: error.message
    };
  }
};

// Import homework from Excel
const importHomeworkFromExcel = async (filePath) => {
  try {
    const workbook = XLSX.readFile(filePath);
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    const data = XLSX.utils.sheet_to_json(worksheet);
    
    const homework = data.map(row => ({
      title: row['Sarlavha'] || row['title'],
      description: row['Tavsif'] || row['description'],
      dueDate: row['Muddat'] || row['dueDate'],
      exercises: [
        {
          title: row['Mashq sarlavhasi'] || row['exerciseTitle'],
          description: row['Mashq tavsifi'] || row['exerciseDescription'],
          videoUrl: row['Video URL'] || row['videoUrl']
        }
      ]
    }));
    
    return {
      success: true,
      data: homework,
      count: homework.length
    };
  } catch (error) {
    console.error('Import homework error:', error);
    return {
      success: false,
      message: error.message
    };
  }
};

// Generate comprehensive school report
const generateSchoolReport = async (schoolData) => {
  try {
    const {
      totalStudents,
      totalTeachers,
      totalGroups,
      averageGrade,
      attendanceRate,
      homeworkCompletionRate,
      topPerformers,
      groupStatistics
    } = schoolData;
    
    const reportData = [
      { 'Ko\'rsatkich': 'Jami o\'quvchilar', 'Qiymat': totalStudents },
      { 'Ko\'rsatkich': 'Jami o\'qituvchilar', 'Qiymat': totalTeachers },
      { 'Ko\'rsatkich': 'Jami guruhlar', 'Qiymat': totalGroups },
      { 'Ko\'rsatkich': 'O\'rtacha baho', 'Qiymat': averageGrade },
      { 'Ko\'rsatkich': 'Davomat foizi', 'Qiymat': `${attendanceRate}%` },
      { 'Ko\'rsatkich': 'Uy vazifalari foizi', 'Qiymat': `${homeworkCompletionRate}%` }
    ];
    
    const filename = `school_report_${Date.now()}`;
    return await exportToExcel(reportData, filename, 'Maktab hisoboti');
  } catch (error) {
    console.error('School report error:', error);
    return { success: false, message: error.message };
  }
};

module.exports = {
  exportToExcel,
  exportToPDF,
  exportStudentGradesReport,
  exportAttendanceReport,
  exportHomeworkReport,
  exportParentReport,
  importStudentsFromExcel,
  importHomeworkFromExcel,
  generateSchoolReport
};