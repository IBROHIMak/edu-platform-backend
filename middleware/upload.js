const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Ensure upload directories exist
const ensureDirectoryExists = (dir) => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
};

// Storage configuration
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    let uploadPath = 'uploads/';
    
    // Determine upload path based on file type and user role
    if (file.fieldname === 'avatar') {
      uploadPath += 'avatars/';
    } else if (file.fieldname === 'homework') {
      uploadPath += 'homework/';
    } else if (file.fieldname === 'video') {
      uploadPath += 'videos/';
    } else if (file.fieldname === 'document') {
      uploadPath += 'documents/';
    } else {
      uploadPath += 'misc/';
    }
    
    ensureDirectoryExists(uploadPath);
    cb(null, uploadPath);
  },
  filename: (req, file, cb) => {
    // Generate unique filename
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const extension = path.extname(file.originalname);
    const baseName = path.basename(file.originalname, extension);
    cb(null, `${baseName}-${uniqueSuffix}${extension}`);
  }
});

// File filter
const fileFilter = (req, file, cb) => {
  // Define allowed file types
  const allowedTypes = {
    avatar: /jpeg|jpg|png|gif/,
    homework: /pdf|doc|docx|txt|jpeg|jpg|png/,
    video: /mp4|avi|mov|wmv|flv|webm/,
    document: /pdf|doc|docx|txt|xls|xlsx|ppt|pptx/
  };
  
  const fieldType = file.fieldname;
  const fileExtension = path.extname(file.originalname).toLowerCase().slice(1);
  
  if (allowedTypes[fieldType] && allowedTypes[fieldType].test(fileExtension)) {
    cb(null, true);
  } else {
    cb(new Error(`Invalid file type for ${fieldType}. Allowed types: ${allowedTypes[fieldType]}`), false);
  }
};

// Size limits (in bytes)
const limits = {
  fileSize: 50 * 1024 * 1024, // 50MB max file size
  files: 5 // Maximum 5 files per request
};

// Create multer instance
const upload = multer({
  storage,
  fileFilter,
  limits
});

// Middleware for different upload types
const uploadMiddleware = {
  // Single avatar upload
  avatar: upload.single('avatar'),
  
  // Multiple homework files
  homework: upload.array('homework', 5),
  
  // Single video upload
  video: upload.single('video'),
  
  // Multiple document uploads
  documents: upload.array('document', 10),
  
  // Mixed uploads
  mixed: upload.fields([
    { name: 'avatar', maxCount: 1 },
    { name: 'homework', maxCount: 5 },
    { name: 'video', maxCount: 1 },
    { name: 'document', maxCount: 10 }
  ])
};

// Error handling middleware
const handleUploadError = (error, req, res, next) => {
  if (error instanceof multer.MulterError) {
    if (error.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({
        success: false,
        message: 'File too large. Maximum size is 50MB.'
      });
    }
    if (error.code === 'LIMIT_FILE_COUNT') {
      return res.status(400).json({
        success: false,
        message: 'Too many files. Maximum allowed files exceeded.'
      });
    }
    if (error.code === 'LIMIT_UNEXPECTED_FILE') {
      return res.status(400).json({
        success: false,
        message: 'Unexpected file field.'
      });
    }
  }
  
  if (error.message.includes('Invalid file type')) {
    return res.status(400).json({
      success: false,
      message: error.message
    });
  }
  
  next(error);
};

// Utility function to delete files
const deleteFile = (filePath) => {
  try {
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
      return true;
    }
    return false;
  } catch (error) {
    console.error('Error deleting file:', error);
    return false;
  }
};

// Utility function to get file URL
const getFileUrl = (req, filePath) => {
  if (!filePath) return null;
  const baseUrl = `${req.protocol}://${req.get('host')}`;
  return `${baseUrl}/${filePath.replace(/\\/g, '/')}`;
};

module.exports = {
  uploadMiddleware,
  handleUploadError,
  deleteFile,
  getFileUrl
};