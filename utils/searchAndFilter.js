const mongoose = require('mongoose');

// Advanced search and filter utility
class SearchAndFilter {
  constructor(model, query, queryString) {
    this.model = model;
    this.query = query;
    this.queryString = queryString;
  }

  // Text search
  search() {
    if (this.queryString.search) {
      const searchRegex = new RegExp(this.queryString.search, 'gi');
      
      // Define searchable fields for different models
      const searchFields = {
        User: ['firstName', 'lastName', 'email', 'studentId', 'teacherId'],
        Homework: ['title', 'description'],
        Competition: ['title', 'description'],
        Group: ['name', 'subject', 'level', 'description'],
        Message: ['content'],
        Reward: ['title', 'description']
      };

      const modelName = this.model.modelName;
      const fields = searchFields[modelName] || [];

      if (fields.length > 0) {
        const searchQuery = {
          $or: fields.map(field => ({
            [field]: { $regex: searchRegex }
          }))
        };
        this.query = this.query.find(searchQuery);
      }
    }
    return this;
  }

  // Filter by fields
  filter() {
    const queryObj = { ...this.queryString };
    
    // Exclude special query parameters
    const excludedFields = ['page', 'sort', 'limit', 'fields', 'search'];
    excludedFields.forEach(el => delete queryObj[el]);

    // Advanced filtering (gte, gt, lte, lt)
    let queryStr = JSON.stringify(queryObj);
    queryStr = queryStr.replace(/\b(gte|gt|lte|lt)\b/g, match => `$${match}`);
    
    const filterObj = JSON.parse(queryStr);

    // Handle special filters
    Object.keys(filterObj).forEach(key => {
      // Date range filtering
      if (key.includes('Date') && typeof filterObj[key] === 'object') {
        Object.keys(filterObj[key]).forEach(operator => {
          filterObj[key][operator] = new Date(filterObj[key][operator]);
        });
      }

      // Array filtering (for roles, groups, etc.)
      if (key === 'role' && Array.isArray(filterObj[key])) {
        filterObj[key] = { $in: filterObj[key] };
      }

      if (key === 'groups' && Array.isArray(filterObj[key])) {
        filterObj[key] = { $in: filterObj[key].map(id => mongoose.Types.ObjectId(id)) };
      }

      // Boolean filtering
      if (filterObj[key] === 'true') filterObj[key] = true;
      if (filterObj[key] === 'false') filterObj[key] = false;
    });

    this.query = this.query.find(filterObj);
    return this;
  }

  // Sort results
  sort() {
    if (this.queryString.sort) {
      const sortBy = this.queryString.sort.split(',').join(' ');
      this.query = this.query.sort(sortBy);
    } else {
      // Default sort by creation date (newest first)
      this.query = this.query.sort('-createdAt');
    }
    return this;
  }

  // Limit fields
  limitFields() {
    if (this.queryString.fields) {
      const fields = this.queryString.fields.split(',').join(' ');
      this.query = this.query.select(fields);
    } else {
      // Exclude sensitive fields by default
      this.query = this.query.select('-password -__v');
    }
    return this;
  }

  // Pagination
  paginate() {
    const page = parseInt(this.queryString.page, 10) || 1;
    const limit = parseInt(this.queryString.limit, 10) || 10;
    const skip = (page - 1) * limit;

    this.query = this.query.skip(skip).limit(limit);
    
    // Store pagination info
    this.paginationInfo = { page, limit, skip };
    return this;
  }

  // Execute query and return results with metadata
  async execute() {
    try {
      const results = await this.query;
      
      // Get total count for pagination
      const totalQuery = this.model.find(this.query.getFilter());
      const total = await totalQuery.countDocuments();
      
      const pagination = this.paginationInfo || { page: 1, limit: results.length };
      const totalPages = Math.ceil(total / pagination.limit);
      
      return {
        success: true,
        results: results.length,
        total,
        pagination: {
          page: pagination.page,
          limit: pagination.limit,
          totalPages,
          hasNext: pagination.page < totalPages,
          hasPrev: pagination.page > 1
        },
        data: results
      };
    } catch (error) {
      return {
        success: false,
        message: error.message,
        data: []
      };
    }
  }
}

// Predefined search configurations for different models
const searchConfigs = {
  students: {
    searchFields: ['firstName', 'lastName', 'studentId'],
    filterFields: ['group', 'isActive', 'points'],
    sortOptions: ['firstName', 'lastName', 'points', 'createdAt'],
    defaultSort: 'firstName'
  },
  
  teachers: {
    searchFields: ['firstName', 'lastName', 'teacherId', 'subject'],
    filterFields: ['subject', 'isActive'],
    sortOptions: ['firstName', 'lastName', 'subject', 'createdAt'],
    defaultSort: 'firstName'
  },
  
  parents: {
    searchFields: ['firstName', 'lastName', 'email'],
    filterFields: ['parentType', 'isActive'],
    sortOptions: ['firstName', 'lastName', 'createdAt'],
    defaultSort: 'firstName'
  },
  
  homework: {
    searchFields: ['title', 'description'],
    filterFields: ['group', 'teacher', 'isActive', 'dueDate'],
    sortOptions: ['title', 'dueDate', 'createdAt'],
    defaultSort: '-createdAt'
  },
  
  competitions: {
    searchFields: ['title', 'description'],
    filterFields: ['status', 'eligibleGroups', 'createdBy'],
    sortOptions: ['title', 'startDate', 'endDate', 'createdAt'],
    defaultSort: '-startDate'
  },
  
  messages: {
    searchFields: ['content'],
    filterFields: ['sender', 'recipient', 'type', 'isRead', 'priority'],
    sortOptions: ['createdAt', 'priority'],
    defaultSort: '-createdAt'
  }
};

// Helper function to build aggregation pipeline for complex searches
const buildAggregationPipeline = (searchParams, modelType) => {
  const pipeline = [];
  
  // Match stage
  const matchStage = {};
  
  // Text search
  if (searchParams.search) {
    const config = searchConfigs[modelType];
    if (config && config.searchFields) {
      matchStage.$or = config.searchFields.map(field => ({
        [field]: { $regex: searchParams.search, $options: 'i' }
      }));
    }
  }
  
  // Filters
  Object.keys(searchParams).forEach(key => {
    if (!['search', 'page', 'limit', 'sort', 'fields'].includes(key)) {
      matchStage[key] = searchParams[key];
    }
  });
  
  if (Object.keys(matchStage).length > 0) {
    pipeline.push({ $match: matchStage });
  }
  
  // Lookup stages for populated fields
  if (modelType === 'homework') {
    pipeline.push(
      {
        $lookup: {
          from: 'users',
          localField: 'teacher',
          foreignField: '_id',
          as: 'teacherInfo'
        }
      },
      {
        $lookup: {
          from: 'groups',
          localField: 'group',
          foreignField: '_id',
          as: 'groupInfo'
        }
      }
    );
  }
  
  // Sort stage
  const sortStage = {};
  if (searchParams.sort) {
    const sortFields = searchParams.sort.split(',');
    sortFields.forEach(field => {
      if (field.startsWith('-')) {
        sortStage[field.substring(1)] = -1;
      } else {
        sortStage[field] = 1;
      }
    });
  } else {
    sortStage.createdAt = -1;
  }
  pipeline.push({ $sort: sortStage });
  
  // Pagination
  const page = parseInt(searchParams.page, 10) || 1;
  const limit = parseInt(searchParams.limit, 10) || 10;
  const skip = (page - 1) * limit;
  
  pipeline.push({ $skip: skip });
  pipeline.push({ $limit: limit });
  
  return pipeline;
};

// Export utility functions
module.exports = {
  SearchAndFilter,
  searchConfigs,
  buildAggregationPipeline
};