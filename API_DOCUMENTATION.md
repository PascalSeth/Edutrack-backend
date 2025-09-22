# EduTrack Backend API Documentation

## Overview

EduTrack is a comprehensive school management system built with Node.js, Express, TypeScript, and Prisma. This API provides endpoints for managing schools, students, teachers, parents, academic records, and more.

## Base URL
```
http://localhost:3000/api
```

## Authentication

The API uses JWT (JSON Web Tokens) for authentication. Include the token in the Authorization header:

```
Authorization: Bearer <your_jwt_token>
```

### Token Expiration
- **Access Token**: Expires in 30 minutes
- **Refresh Token**: Expires in 7 days
- Use the `/auth/refresh-token` endpoint to get a new access token before expiration

### User Roles
- `SUPER_ADMIN`: Full system access
- `SCHOOL_ADMIN`: School-level administration
- `PRINCIPAL`: School principal access
- `TEACHER`: Teacher access
- `PARENT`: Parent access

## Email Configuration

The API includes comprehensive email functionality for sending welcome emails to newly created user accounts. Configure the following environment variables:

```env
# SMTP Configuration
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password

# Email Settings
EMAIL_FROM_NAME=EduTrack
FRONTEND_URL=https://your-app.com
```

**Note**: For Gmail, use an "App Password" instead of your regular password for SMTP authentication.

**Email Features:**
- **Parent Welcome Emails**: Automatically sent when creating new parent accounts with auto-generated login credentials
- **Teacher Welcome Emails**: Automatically sent when creating new teacher accounts with auto-generated login credentials
- **Principal Welcome Emails**: Automatically sent when creating new principal accounts with auto-generated login credentials
- **School Admin Welcome Emails**: Automatically sent when creating new school admin accounts with auto-generated login credentials
- **Password Generation**: Secure 12-character passwords with mixed case, numbers, and special characters
- **Email Templates**: Professional HTML and plain text templates tailored for each user role

## Health Check

### GET /health
Check if the API is running.

**Response:**
```json
{
  "status": "OK",
  "timestamp": "2025-09-15T03:56:18.769Z",
  "uptime": 123.456
}
```

---

# Authentication Endpoints

## POST /auth/register
Register a new user account.

**Request Body:**
```json
{
  "email": "user@example.com",
  "username": "johndoe",
  "password": "securepassword123",
  "name": "John",
  "surname": "Doe",
  "role": "TEACHER",
  "schoolId": "school-uuid",
  "phone": "+1234567890",
  "address": "123 Main St",
  "qualifications": "Bachelor's in Education",
  "bio": "Experienced teacher"
}
```

**Response:**
```json
{
  "message": "User registered successfully",
  "user": {
    "id": "user-uuid",
    "email": "user@example.com",
    "role": "TEACHER",
    "needsApproval": true
  },
  "accessToken": "jwt-access-token",
  "refreshToken": "jwt-refresh-token"
}
```

## POST /auth/login
Authenticate user and get tokens.

**Request Body:**
```json
{
  "email": "user@example.com",
  "password": "securepassword123"
}
```

**Response:**
```json
{
  "message": "Login successful",
  "user": {
    "id": "user-uuid",
    "email": "user@example.com",
    "name": "John",
    "surname": "Doe",
    "role": "TEACHER",
    "approvalStatus": "APPROVED"
  },
  "school": {
    "id": "school-uuid",
    "name": "Example School",
    "logoUrl": "https://...",
    "city": "New York"
  },
  "accessToken": "jwt-access-token",
  "refreshToken": "jwt-refresh-token"
}
```

## POST /auth/refresh-token
Refresh access token using refresh token.

**Request Body:**
```json
{
  "refreshToken": "jwt-refresh-token"
}
```

**Response:**
```json
{
  "message": "Token refreshed successfully",
  "accessToken": "new-jwt-access-token"
}
```

## POST /auth/logout
Logout user by invalidating refresh token.

**Request Body:**
```json
{
  "refreshToken": "jwt-refresh-token"
}
```

**Response:**
```json
{
  "message": "Logout successful"
}
```

---

# User Management

## GET /users
Get all users (paginated).

**Query Parameters:**
- `page` (optional): Page number (default: 1)
- `limit` (optional): Items per page (default: 10)

**Response:**
```json
{
  "message": "Users retrieved successfully",
  "users": [
    {
      "id": "user-uuid",
      "email": "user@example.com",
      "name": "John",
      "surname": "Doe",
      "role": "TEACHER",
      "isActive": true
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 10,
    "total": 25,
    "pages": 3
  }
}
```

## GET /users/:id
Get user by ID.

**Response:**
```json
{
  "message": "User retrieved successfully",
  "user": {
    "id": "user-uuid",
    "email": "user@example.com",
    "name": "John",
    "surname": "Doe",
    "role": "TEACHER",
    "phone": "+1234567890",
    "address": "123 Main St",
    "profileImageUrl": "https://...",
    "isActive": true
  }
}
```

## PUT /users/:id
Update user information.

**Request Body:**
```json
{
  "name": "Updated Name",
  "phone": "+1987654321",
  "address": "456 Updated St"
}
```

**Response:**
```json
{
  "message": "User updated successfully",
  "user": {
    "id": "user-uuid",
    "name": "Updated Name",
    "phone": "+1987654321"
  }
}
```

## DELETE /users/:id
Delete user account.

**Response:**
```json
{
  "message": "User deleted successfully"
}
```

---

# School Management

## GET /schools
Get all schools (paginated).

**Query Parameters:**
- `page`, `limit` (pagination)
- `city`, `state`, `country` (filters)

**Response:**
```json
{
  "message": "Schools retrieved successfully",
  "schools": [
    {
      "id": "school-uuid",
      "name": "Example School",
      "address": "123 School St",
      "city": "New York",
      "state": "NY",
      "country": "USA",
      "phone": "+1234567890",
      "email": "info@example.edu",
      "website": "https://example.edu",
      "logoUrl": "https://...",
      "isVerified": true,
      "missionStatement": "Educating tomorrow's leaders"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 10,
    "total": 5,
    "pages": 1
  }
}
```

## GET /schools/:id
Get school by ID.

**Response:**
```json
{
  "message": "School retrieved successfully",
  "school": {
    "id": "school-uuid",
    "name": "Example School",
    "address": "123 School St",
    "city": "New York",
    "phone": "+1234567890",
    "isVerified": true,
    "principal": {
      "user": {
        "name": "Jane",
        "surname": "Smith"
      }
    }
  }
}
```

## GET /schools/:id/stats
Get school statistics.

**Response:**
```json
{
  "message": "School statistics retrieved successfully",
  "stats": {
    "totalStudents": 500,
    "totalTeachers": 30,
    "totalClasses": 25,
    "totalSubjects": 15,
    "enrollmentTrend": [450, 475, 500],
    "attendanceRate": 95.2
  }
}
```

## POST /schools
Create new school with optional admin user creation (Super Admin only).

**Request Body (Option 1 - Link existing admin):**
```json
{
  "name": "New School",
  "address": "456 Education Ave",
  "city": "Boston",
  "state": "MA",
  "country": "USA",
  "phone": "+1987654321",
  "email": "info@newschool.edu",
  "website": "https://newschool.edu",
  "missionStatement": "Building future innovators",
  "adminUserId": "existing-user-uuid"
}
```

**Request Body (Option 2 - Create new admin):**
```json
{
  "name": "New School",
  "address": "456 Education Ave",
  "city": "Boston",
  "state": "MA",
  "country": "USA",
  "phone": "+1987654321",
  "email": "info@newschool.edu",
  "website": "https://newschool.edu",
  "missionStatement": "Building future innovators",
  "adminEmail": "admin@newschool.edu",
  "adminUsername": "admin.newschool",
  "adminName": "John",
  "adminSurname": "Admin"
}
```

**Response:**
```json
{
  "message": "School registered successfully. Awaiting verification.",
  "school": {
    "id": "school-uuid",
    "name": "New School",
    "registrationStatus": "PENDING"
  },
  "adminCredentials": {
    "email": "admin@newschool.edu",
    "username": "admin.newschool",
    "password": "Ab3$Xy9#mP2!"
  }
}
```

**Notes:**
- Either `adminUserId` (for existing user) or all admin details (`adminEmail`, `adminUsername`, `adminName`, `adminSurname`) must be provided
- **Email Notifications**: New school admins automatically receive a welcome email with their auto-generated login credentials
- **Password Generation**: Secure 12-character passwords are automatically generated for new admin accounts (mixed case, numbers, symbols)
- **Security**: Admins should change their temporary password after first login

## PUT /schools/:id
Update school information.

**Request Body:**
```json
{
  "name": "Updated School Name",
  "phone": "+1555123456"
}
```

**Response:**
```json
{
  "message": "School updated successfully",
  "school": {
    "id": "school-uuid",
    "name": "Updated School Name"
  }
}
```

## PATCH /schools/:id/verify
Verify school (Super Admin only).

**Request Body:**
```json
{
  "isVerified": true
}
```

**Response:**
```json
{
  "message": "School verification updated successfully",
  "school": {
    "id": "school-uuid",
    "isVerified": true
  }
}
```

---

# Student Management

## Overview

The Student Management API supports advanced features including:

### Multiple Parent Relationships
Students can have multiple parents/guardians with defined relationships:
- **MOTHER**: Biological or adoptive mother
- **FATHER**: Biological or adoptive father
- **GUARDIAN**: Legal guardian
- **OTHER**: Other relationship types

Each parent relationship can be marked as primary contact, and all parents receive notifications about their child's activities.

### Enhanced Tenant Filtering
All student endpoints implement comprehensive tenant filtering:
- **SUPER_ADMIN**: Full access across all schools
- **SCHOOL_ADMIN/PRINCIPAL**: Restricted to their assigned school
- **TEACHER**: Limited to students in their classes/lessons within their school
- **PARENT**: Restricted to their own children within their school

This ensures data security and prevents unauthorized access across school boundaries.

## GET /students
Get all students (paginated, role-based access with tenant filtering).

**Query Parameters:**
- `page`, `limit` (pagination)
- `schoolId`, `classId`, `gradeId` (filters)

**Role-based Access & Tenant Filtering:**
- **SUPER_ADMIN**: Can view all students across all schools
- **SCHOOL_ADMIN/PRINCIPAL**: Can only view students in their assigned school
- **TEACHER**: Can view students in their classes/lessons within their school
- **PARENT**: Can only view their own children within their school

**Response:**
```json
{
  "message": "Students retrieved successfully",
  "students": [
    {
      "id": "student-uuid",
      "registrationNumber": "STU001",
      "name": "Alice",
      "surname": "Johnson",
      "birthday": "2010-05-15T00:00:00.000Z",
      "sex": "FEMALE",
      "school": {
        "id": "school-uuid",
        "name": "Example School"
      },
      "class": {
        "id": "class-uuid",
        "name": "Grade 5A"
      },
      "parent": {
        "user": {
          "name": "Bob",
          "surname": "Johnson",
          "email": "bob.johnson@email.com"
        }
      },
      "_count": {
        "attendances": 120,
        "results": 15,
        "assignmentSubmissions": 25
      }
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 10,
    "total": 150,
    "pages": 15
  }
}
```

**Notes:**
- All queries include tenant filtering to ensure users can only access data within their authorized school
- Parent access is restricted to their own children
- Teacher access is limited to students in their supervised classes or lessons

## GET /students/:id
Get student by ID with role-based access and tenant filtering.

**Role-based Access & Tenant Filtering:**
- **SUPER_ADMIN**: Can view any student
- **SCHOOL_ADMIN/PRINCIPAL**: Can only view students in their assigned school
- **TEACHER**: Can view students in their supervised classes or lessons within their school
- **PARENT**: Can only view their own children within their school

**Response:**
```json
{
  "message": "Student retrieved successfully",
  "student": {
    "id": "student-uuid",
    "registrationNumber": "STU001",
    "name": "Alice",
    "surname": "Johnson",
    "birthday": "2010-05-15T00:00:00.000Z",
    "sex": "FEMALE",
    "address": "123 Home St",
    "imageUrl": "https://...",
    "bloodType": "O+",
    "school": {
      "id": "school-uuid",
      "name": "Example School",
      "address": "123 School St",
      "city": "New York"
    },
    "class": {
      "id": "class-uuid",
      "name": "Grade 5A",
      "supervisor": {
        "user": {
          "name": "Ms.",
          "surname": "Davis"
        }
      }
    },
    "grade": {
      "name": "Grade 5",
      "level": 5
    },
    "parent": {
      "user": {
        "id": "parent-uuid",
        "name": "Bob",
        "surname": "Johnson",
        "email": "bob.johnson@email.com",
        "phone": "+1234567890"
      }
    },
    "attendances": [
      {
        "date": "2025-09-10T00:00:00.000Z",
        "present": true,
        "lesson": {
          "subject": {
            "name": "Mathematics"
          }
        }
      }
    ],
    "results": [
      {
        "score": 85,
        "assignment": {
          "title": "Algebra Quiz",
          "subject": {
            "name": "Mathematics"
          }
        }
      }
    ],
    "_count": {
      "attendances": 120,
      "results": 15,
      "assignmentSubmissions": 25
    }
  }
}
```

**Notes:**
- Access is restricted by tenant filtering - users can only view students within their authorized school
- For students with multiple parents, the `parent` field shows the primary parent
- Additional parent relationships are available through the StudentParent junction table

## POST /students
Create new student with support for multiple parents.

**Request Body (Option 1 - Create new parents):**
```json
{
  "registrationNumber": "STU002",
  "name": "Charlie",
  "surname": "Brown",
  "birthday": "2011-03-20",
  "sex": "MALE",
  "address": "456 Student Ave",
  "schoolId": "school-uuid",
  "classId": "class-uuid",
  "gradeId": "grade-uuid",
  "parentDetails": [
    {
      "email": "father@example.com",
      "username": "john.brown",
      "name": "John",
      "surname": "Brown",
      "phone": "+1234567890",
      "relationship": "FATHER",
      "isPrimary": true
    },
    {
      "email": "mother@example.com",
      "username": "jane.brown",
      "name": "Jane",
      "surname": "Brown",
      "phone": "+1234567891",
      "relationship": "MOTHER",
      "isPrimary": false
    }
  ]
}
```

**Request Body (Option 2 - Use existing parents):**
```json
{
  "registrationNumber": "STU002",
  "name": "Charlie",
  "surname": "Brown",
  "birthday": "2011-03-20",
  "sex": "MALE",
  "address": "456 Student Ave",
  "schoolId": "school-uuid",
  "classId": "class-uuid",
  "gradeId": "grade-uuid",
  "parentRelationships": [
    {
      "parentId": "parent-uuid-1",
      "relationship": "FATHER",
      "isPrimary": true
    },
    {
      "parentId": "parent-uuid-2",
      "relationship": "MOTHER",
      "isPrimary": false
    }
  ]
}
```

**Response:**
```json
{
  "message": "Student created successfully",
  "student": {
    "id": "student-uuid",
    "registrationNumber": "STU002",
    "name": "Charlie",
    "surname": "Brown",
    "school": {
      "name": "Example School"
    },
    "parent": {
      "user": {
        "name": "John",
        "surname": "Brown"
      }
    }
  },
  "parentCreated": true
}
```

**Parent Relationship Types:**
- `MOTHER`: Mother
- `FATHER`: Father
- `GUARDIAN`: Legal guardian
- `OTHER`: Other relationship

**Notes:**
- Either `parentDetails` (for creating new parents) or `parentRelationships` (for existing parents) must be provided
- At least one parent must be marked as `isPrimary: true`
- All parents must belong to the same school as the student (enforced by tenant filtering)
- New parent accounts are created with role `PARENT` and sent welcome notifications
- **Email Notifications**: New parents automatically receive a welcome email with their auto-generated login credentials
- **Multiple Parent Support**: When creating multiple parents, each parent receives their own personalized welcome email with individual login credentials
- **Password Generation**: Secure 12-character passwords are automatically generated for new parent accounts (mixed case, numbers, symbols)
- **Security**: Parents should change their temporary password after first login
- **Email Templates**: Professional HTML and plain text welcome emails with login instructions and school information
- **Individual Credentials**: Each parent gets unique login credentials (email + generated password) sent to their personal email address
- **Email Delivery**: All emails are sent asynchronously - if one email fails, others are still delivered successfully

## PUT /students/:id
Update student information with role-based access and tenant filtering.

**Role-based Access & Tenant Filtering:**
- **SUPER_ADMIN**: Can update any student
- **SCHOOL_ADMIN/PRINCIPAL**: Can only update students in their assigned school
- **TEACHER**: Can update students in their supervised classes or lessons within their school
- **PARENT**: Can only update their own children within their school (cannot change verification status)

**Request Body:**
```json
{
  "name": "Updated Name",
  "address": "789 Updated St",
  "classId": "new-class-uuid"
}
```

**Response:**
```json
{
  "message": "Student updated successfully",
  "student": {
    "id": "student-uuid",
    "name": "Updated Name",
    "address": "789 Updated St"
  }
}
```

**Notes:**
- All updates include tenant filtering to ensure users can only modify students within their authorized school
- Parents cannot update verification status (only admins/principals/teachers can)
- Teachers cannot update verification status
- Changes to verification status trigger notifications to all associated parents

## DELETE /students/:id
Delete student with role-based access and tenant filtering.

**Role-based Access & Tenant Filtering:**
- **SUPER_ADMIN**: Can delete any student
- **SCHOOL_ADMIN/PRINCIPAL**: Can only delete students in their assigned school
- **TEACHER/PARENT**: Cannot delete students (only view/update access)

**Response:**
```json
{
  "message": "Student deleted successfully"
}
```

**Notes:**
- Only Super Admins, School Admins, and Principals can delete students
- Deletion includes tenant filtering to ensure users can only delete students within their authorized school
- Cannot delete students with associated attendance records, results, or assignment submissions

---

# Principal Management

## GET /principals
Get all principals (paginated, role-based access).

**Query Parameters:**
- `page` (optional): Page number (default: 1)
- `limit` (optional): Items per page (default: 10)

**Response:**
```json
{
  "message": "Principals retrieved successfully",
  "principals": [
    {
      "id": "principal-uuid",
      "user": {
        "id": "user-uuid",
        "email": "principal@school.edu",
        "name": "Jane",
        "surname": "Smith",
        "username": "jane.smith",
        "profileImageUrl": "https://..."
      },
      "school": {
        "id": "school-uuid",
        "name": "Example School"
      },
      "qualifications": "Master's in Education",
      "bio": "Experienced school principal with 15 years in education",
      "approval": {
        "status": "APPROVED"
      }
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 10,
    "total": 5,
    "pages": 1
  }
}
```

## GET /principals/:id
Get principal by ID.

**Response:**
```json
{
  "message": "Principal retrieved successfully",
  "principal": {
    "id": "principal-uuid",
    "user": {
      "id": "user-uuid",
      "email": "principal@school.edu",
      "name": "Jane",
      "surname": "Smith",
      "username": "jane.smith",
      "profileImageUrl": "https://..."
    },
    "school": {
      "id": "school-uuid",
      "name": "Example School",
      "address": "123 School St",
      "city": "New York"
    },
    "qualifications": "Master's in Education",
    "bio": "Experienced school principal with 15 years in education",
    "approval": {
      "status": "APPROVED"
    }
  }
}
```

## POST /principals
Create new principal with optional password generation and email notification (Super Admin, Principal, or School Admin only).

**Request Body (Option 1 - Provide password):**
```json
{
  "schoolId": "school-uuid",
  "email": "new.principal@school.edu",
  "password": "securepassword123",
  "name": "John",
  "surname": "Doe",
  "username": "john.doe",
  "profileImageUrl": "https://...",
  "qualifications": "Bachelor's in Education",
  "bio": "New principal joining our team"
}
```

**Request Body (Option 2 - Auto-generate password):**
```json
{
  "schoolId": "school-uuid",
  "email": "new.principal@school.edu",
  "name": "John",
  "surname": "Doe",
  "username": "john.doe",
  "qualifications": "Bachelor's in Education"
}
```

**Response:**
```json
{
  "message": "Principal created successfully",
  "principal": {
    "id": "principal-uuid",
    "user": {
      "id": "user-uuid",
      "email": "new.principal@school.edu",
      "name": "John",
      "surname": "Doe",
      "username": "john.doe"
    },
    "school": {
      "id": "school-uuid",
      "name": "Example School"
    },
    "qualifications": "Bachelor's in Education"
  },
  "generatedCredentials": {
    "email": "new.principal@school.edu",
    "password": "Ab3$Xy9#mP2!"
  }
}
```

**Notes:**
- **Email Notifications**: New principals automatically receive a welcome email with their login credentials
- **Password Generation**: If no password is provided, a secure 12-character password is automatically generated
- **Security**: Principals should change their temporary password after first login
- **Email Templates**: Professional welcome emails with principal-specific leadership features and instructions

## PUT /principals/:id
Update principal information (Super Admin, Principal, or School Admin only).

**Request Body:**
```json
{
  "qualifications": "Updated qualifications",
  "bio": "Updated bio",
  "profileImageUrl": "https://updated-image.jpg"
}
```

**Response:**
```json
{
  "message": "Principal updated successfully",
  "principal": {
    "id": "principal-uuid",
    "qualifications": "Updated qualifications",
    "bio": "Updated bio",
    "user": {
      "profileImageUrl": "https://updated-image.jpg"
    }
  }
}
```

## DELETE /principals/:id
Delete principal (Super Admin, Principal, or School Admin only).

**Response:**
```json
{
  "message": "Principal deleted successfully"
}
```

## PUT /principals/:id/verify
Verify principal account (School Admins and Super Admins only).

**Request Body:**
```json
{
  "status": "APPROVED",
  "comments": "Principal qualifications verified"
}
```

**Status Options:**
- `APPROVED`: Approve the principal account
- `REJECTED`: Reject the principal account

**Response:**
```json
{
  "message": "Principal approved successfully",
  "principal": {
    "id": "principal-uuid",
    "user": {
      "name": "Jane",
      "surname": "Smith",
      "email": "jane.smith@school.edu"
    },
    "approvalStatus": "APPROVED"
  }
}
```

**Notes:**
- Only School Admins and Super Admins can verify principals
- For non-super admins, can only verify principals in their school
- Creates notification for the principal about approval/rejection status
- Updates principal approval record

**Note:** Principals and School Admins have comprehensive permissions for managing their school including:
- Creating and managing classes, grades, subjects, and students
- Assigning and removing teachers from classes and subjects
- Managing school events, academic calendars, timetables, and rooms
- Creating and managing assignments, exams, and report cards
- Approving academic records and managing curriculum
- Managing school-wide announcements and communications
- Full administrative control over all school operations

---

# Grade Management

## GET /grades
Get all grades (paginated, role-based access).

**Query Parameters:**
- `page` (optional): Page number (default: 1)
- `limit` (optional): Items per page (default: 10)

**Notes:**
- SUPER_ADMIN: Can view all grades across all schools
- SCHOOL_ADMIN, PRINCIPAL: Can only view grades for their assigned school

**Response:**
```json
{
  "message": "Grades retrieved successfully",
  "grades": [
    {
      "id": "grade-uuid",
      "name": "Grade 8",
      "level": 8,
      "schoolId": "school-uuid"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 10,
    "total": 12,
    "pages": 2
  }
}
```

## GET /grades/:id
Get grade by ID (role-based access).

**Notes:**
- SUPER_ADMIN: Can view any grade
- SCHOOL_ADMIN, PRINCIPAL: Can only view grades belonging to their school

**Response:**
```json
{
  "message": "Grade retrieved successfully",
  "grade": {
    "id": "grade-uuid",
    "name": "Grade 8",
    "level": 8,
    "schoolId": "school-uuid"
  }
}
```

## POST /grades
Create new grade (role-based access).

**Notes:**
- SUPER_ADMIN: Can specify any schoolId
- SCHOOL_ADMIN, PRINCIPAL: schoolId is automatically set to their assigned school

**Request Body:**
```json
{
  "name": "Grade 9",
  "level": 9,
  "schoolId": "school-uuid"
}
```

**Response:**
```json
{
  "message": "Grade created successfully",
  "grade": {
    "id": "grade-uuid",
    "name": "Grade 9",
    "level": 9,
    "schoolId": "school-uuid"
  }
}
```

## PUT /grades/:id
Update grade information (role-based access).

**Notes:**
- SUPER_ADMIN: Can update any grade
- SCHOOL_ADMIN, PRINCIPAL: Can only update grades belonging to their school

**Request Body:**
```json
{
  "name": "Updated Grade Name",
  "level": 9
}
```

**Response:**
```json
{
  "message": "Grade updated successfully",
  "grade": {
    "id": "grade-uuid",
    "name": "Updated Grade Name",
    "level": 9
  }
}
```

## DELETE /grades/:id
Delete grade (role-based access).

**Notes:**
- SUPER_ADMIN: Can delete any grade
- SCHOOL_ADMIN, PRINCIPAL: Can only delete grades belonging to their school

**Response:**
```json
{
  "message": "Grade deleted successfully"
}
```

---

# Class Management

## GET /classes
Get all classes (paginated, role-based access).

**Query Parameters:**
- `page` (optional): Page number (default: 1)
- `limit` (optional): Items per page (default: 10)

**Notes:**
- SUPER_ADMIN: Can view all classes across all schools
- SCHOOL_ADMIN, PRINCIPAL: Can only view classes for their assigned school

**Response:**
```json
{
  "message": "Classes retrieved successfully",
  "classes": [
    {
      "id": "class-uuid",
      "name": "Grade 8A",
      "capacity": 30,
      "schoolId": "school-uuid",
      "gradeId": "grade-uuid",
      "supervisorId": "teacher-uuid"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 10,
    "total": 25,
    "pages": 3
  }
}
```

## GET /classes/:id
Get class by ID (role-based access).

**Notes:**
- SUPER_ADMIN: Can view any class
- SCHOOL_ADMIN, PRINCIPAL: Can only view classes belonging to their school

**Response:**
```json
{
  "message": "Class retrieved successfully",
  "class": {
    "id": "class-uuid",
    "name": "Grade 8A",
    "capacity": 30,
    "schoolId": "school-uuid",
    "gradeId": "grade-uuid",
    "supervisorId": "teacher-uuid"
  }
}
```

## POST /classes
Create new class (role-based access).

**Notes:**
- SUPER_ADMIN: Can specify any schoolId
- SCHOOL_ADMIN, PRINCIPAL: schoolId is automatically set to their assigned school

**Request Body:**
```json
{
  "name": "Grade 9B",
  "capacity": 28,
  "schoolId": "school-uuid",
  "gradeId": "grade-uuid",
  "supervisorId": "teacher-uuid"
}
```

**Response:**
```json
{
  "message": "Class created successfully",
  "class": {
    "id": "class-uuid",
    "name": "Grade 9B",
    "capacity": 28,
    "schoolId": "school-uuid",
    "gradeId": "grade-uuid",
    "supervisorId": "teacher-uuid"
  }
}
```

## PUT /classes/:id
Update class information (role-based access).

**Notes:**
- SUPER_ADMIN: Can update any class
- SCHOOL_ADMIN, PRINCIPAL: Can only update classes belonging to their school

**Request Body:**
```json
{
  "name": "Updated Class Name",
  "capacity": 32,
  "supervisorId": "new-teacher-uuid"
}
```

**Response:**
```json
{
  "message": "Class updated successfully",
  "class": {
    "id": "class-uuid",
    "name": "Updated Class Name",
    "capacity": 32,
    "supervisorId": "new-teacher-uuid"
  }
}
```

## DELETE /classes/:id
Delete class (role-based access).

**Notes:**
- SUPER_ADMIN: Can delete any class
- SCHOOL_ADMIN, PRINCIPAL: Can only delete classes belonging to their school

**Response:**
```json
{
  "message": "Class deleted successfully"
}
```

---

# Teacher Management

## GET /teachers
Get all teachers (paginated, role-based access).

**Query Parameters:**
- `page` (optional): Page number (default: 1)
- `limit` (optional): Items per page (default: 10)

**Notes:**
- SUPER_ADMIN: Can view all teachers across all schools
- SCHOOL_ADMIN/PRINCIPAL: Can only view teachers for their assigned school
- TEACHER: Can only view their own record
- PARENT: Can view teachers who teach their children

**Response:**
```json
{
  "message": "Teachers retrieved successfully",
  "teachers": [
    {
      "id": "teacher-uuid",
      "user": {
        "id": "user-uuid",
        "email": "teacher@school.edu",
        "name": "John",
        "surname": "Smith",
        "username": "john.smith",
        "profileImageUrl": "https://..."
      },
      "school": {
        "id": "school-uuid",
        "name": "Example School"
      },
      "qualifications": "Master's in Education",
      "bio": "Experienced mathematics teacher",
      "subjects": [
        {
          "id": "subject-uuid",
          "name": "Mathematics"
        }
      ],
      "supervisedClasses": [
        {
          "id": "class-uuid",
          "name": "Grade 8A"
        }
      ],
      "approval": {
        "status": "APPROVED"
      },
      "_count": {
        "subjects": 2,
        "supervisedClasses": 1,
        "lessons": 45
      }
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 10,
    "total": 25,
    "pages": 3
  }
}
```

## GET /teachers/:id
Get teacher by ID (role-based access).

**Notes:**
- SUPER_ADMIN: Can view any teacher
- SCHOOL_ADMIN/PRINCIPAL: Can only view teachers belonging to their school
- TEACHER: Can only view their own record
- PARENT: Can view teachers who teach their children

**Response:**
```json
{
  "message": "Teacher retrieved successfully",
  "teacher": {
    "id": "teacher-uuid",
    "user": {
      "id": "user-uuid",
      "email": "teacher@school.edu",
      "name": "John",
      "surname": "Smith",
      "username": "john.smith",
      "profileImageUrl": "https://..."
    },
    "school": {
      "id": "school-uuid",
      "name": "Example School"
    },
    "qualifications": "Master's in Education",
    "bio": "Experienced mathematics teacher",
    "bloodType": "O+",
    "sex": "MALE",
    "birthday": "1985-03-15T00:00:00.000Z",
    "subjects": [
      {
        "id": "subject-uuid",
        "name": "Mathematics"
      }
    ],
    "supervisedClasses": [
      {
        "id": "class-uuid",
        "name": "Grade 8A"
      }
    ],
    "approval": {
      "status": "APPROVED"
    }
  }
}
```

## POST /teachers
Create new teacher with optional password generation and email notification (role-based access).

**Notes:**
- SUPER_ADMIN: Can specify any schoolId
- SCHOOL_ADMIN/PRINCIPAL: schoolId is automatically set to their assigned school

**Request Body (Option 1 - Provide password):**
```json
{
  "schoolId": "school-uuid",
  "email": "new.teacher@school.edu",
  "password": "securepassword123",
  "name": "Jane",
  "surname": "Doe",
  "username": "jane.doe",
  "profileImageUrl": "https://...",
  "qualifications": "Bachelor's in Education",
  "bio": "New teacher joining our team",
  "bloodType": "A+",
  "sex": "FEMALE",
  "birthday": "1990-05-20"
}
```

**Request Body (Option 2 - Auto-generate password):**
```json
{
  "schoolId": "school-uuid",
  "email": "new.teacher@school.edu",
  "name": "Jane",
  "surname": "Doe",
  "username": "jane.doe",
  "qualifications": "Bachelor's in Education"
}
```

**Response:**
```json
{
  "message": "Teacher created successfully",
  "teacher": {
    "id": "teacher-uuid",
    "user": {
      "id": "user-uuid",
      "email": "new.teacher@school.edu",
      "name": "Jane",
      "surname": "Doe",
      "username": "jane.doe"
    },
    "school": {
      "id": "school-uuid",
      "name": "Example School"
    },
    "qualifications": "Bachelor's in Education"
  },
  "generatedCredentials": {
    "email": "new.teacher@school.edu",
    "password": "Ab3$Xy9#mP2!"
  }
}
```

**Notes:**
- **Email Notifications**: New teachers automatically receive a welcome email with their login credentials
- **Password Generation**: If no password is provided, a secure 12-character password is automatically generated
- **Security**: Teachers should change their temporary password after first login
- **Email Templates**: Professional welcome emails with teacher-specific features and instructions

## PUT /teachers/:id
Update teacher information (role-based access).

**Notes:**
- SUPER_ADMIN: Can update any teacher
- SCHOOL_ADMIN/PRINCIPAL: Can only update teachers belonging to their school
- TEACHER: Can only update their own record

**Request Body:**
```json
{
  "qualifications": "Updated qualifications",
  "bio": "Updated bio",
  "profileImageUrl": "https://updated-image.jpg",
  "bloodType": "B+"
}
```

**Response:**
```json
{
  "message": "Teacher updated successfully",
  "teacher": {
    "id": "teacher-uuid",
    "qualifications": "Updated qualifications",
    "bio": "Updated bio",
    "user": {
      "profileImageUrl": "https://updated-image.jpg"
    }
  }
}
```

## DELETE /teachers/:id
Delete teacher (role-based access).

**Notes:**
- SUPER_ADMIN: Can delete any teacher
- SCHOOL_ADMIN/PRINCIPAL: Can only delete teachers belonging to their school
- TEACHER: Can only delete their own record

**Response:**
```json
{
  "message": "Teacher deleted successfully"
}
```

## PUT /teachers/:id/verify
Verify teacher account (Principals and School Admins only).

**Request Body:**
```json
{
  "status": "APPROVED",
  "comments": "Teacher qualifications verified"
}
```

**Status Options:**
- `APPROVED`: Approve the teacher account
- `REJECTED`: Reject the teacher account

**Response:**
```json
{
  "message": "Teacher approved successfully",
  "teacher": {
    "id": "teacher-uuid",
    "user": {
      "name": "John",
      "surname": "Smith",
      "email": "john.smith@school.edu"
    },
    "approvalStatus": "APPROVED"
  }
}
```

**Notes:**
- Only Principals and School Admins can verify teachers
- For non-super admins, can only verify teachers in their school
- Creates notification for the teacher about approval/rejection status
- Updates teacher approval status and approval record

---

# Subject Management

## GET /subjects
Get all subjects (paginated, role-based access).

**Query Parameters:**
- `page` (optional): Page number (default: 1)
- `limit` (optional): Items per page (default: 10)

**Notes:**
- SUPER_ADMIN: Can view all subjects across all schools
- SCHOOL_ADMIN, PRINCIPAL: Can only view subjects for their assigned school

**Response:**
```json
{
  "message": "Subjects retrieved successfully",
  "subjects": [
    {
      "id": "subject-uuid",
      "name": "Mathematics",
      "code": "MATH",
      "description": "Advanced mathematics course",
      "schoolId": "school-uuid",
      "teachers": [
        {
          "user": {
            "name": "John",
            "surname": "Smith"
          }
        }
      ],
      "_count": {
        "lessons": 45,
        "assignments": 12,
        "examQuestions": 8
      }
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 10,
    "total": 25,
    "pages": 3
  }
}
```

## GET /subjects/:id
Get subject by ID (role-based access).

**Notes:**
- SUPER_ADMIN: Can view any subject
- SCHOOL_ADMIN, PRINCIPAL: Can only view subjects belonging to their school

**Response:**
```json
{
  "message": "Subject retrieved successfully",
  "subject": {
    "id": "subject-uuid",
    "name": "Mathematics",
    "code": "MATH",
    "description": "Advanced mathematics course",
    "schoolId": "school-uuid",
    "teachers": [
      {
        "user": {
          "name": "John",
          "surname": "Smith",
          "email": "john.smith@school.edu"
        }
      }
    ],
    "lessons": [
      {
        "class": {
          "name": "Grade 8A"
        },
        "teacher": {
          "user": {
            "name": "John",
            "surname": "Smith"
          }
        }
      }
    ],
    "assignments": [
      {
        "id": "assignment-uuid",
        "title": "Algebra Quiz",
        "dueDate": "2025-09-20T23:59:59.000Z",
        "class": {
          "name": "Grade 8A"
        }
      }
    ],
    "_count": {
      "lessons": 45,
      "assignments": 12,
      "examQuestions": 8
    }
  }
}
```

## POST /subjects
Create new subject (role-based access).

**Notes:**
- SUPER_ADMIN: Can specify any schoolId
- SCHOOL_ADMIN, PRINCIPAL: schoolId is automatically set to their assigned school

**Request Body:**
```json
{
  "name": "Computer Science",
  "code": "CS101",
  "description": "Introduction to programming",
  "schoolId": "school-uuid"
}
```

**Response:**
```json
{
  "message": "Subject created successfully",
  "subject": {
    "id": "subject-uuid",
    "name": "Computer Science",
    "code": "CS101",
    "description": "Introduction to programming",
    "schoolId": "school-uuid"
  }
}
```

## PUT /subjects/:id
Update subject information (role-based access).

**Notes:**
- SUPER_ADMIN: Can update any subject
- SCHOOL_ADMIN, PRINCIPAL: Can only update subjects belonging to their school

**Request Body:**
```json
{
  "name": "Advanced Computer Science",
  "code": "CS201",
  "description": "Advanced programming concepts"
}
```

**Response:**
```json
{
  "message": "Subject updated successfully",
  "subject": {
    "id": "subject-uuid",
    "name": "Advanced Computer Science",
    "code": "CS201",
    "description": "Advanced programming concepts"
  }
}
```

## DELETE /subjects/:id
Delete subject (role-based access).

**Notes:**
- SUPER_ADMIN: Can delete any subject
- SCHOOL_ADMIN, PRINCIPAL: Can only delete subjects belonging to their school
- Cannot delete subjects with associated lessons, assignments, or exam questions

**Response:**
```json
{
  "message": "Subject deleted successfully"
}
```

## POST /subjects/:id/assign-teacher
Assign teacher to subject (role-based access).

**Notes:**
- SUPER_ADMIN: Can assign any teacher to any subject
- SCHOOL_ADMIN, PRINCIPAL: Can only assign teachers within their school

**Request Body:**
```json
{
  "teacherId": "teacher-uuid"
}
```

**Response:**
```json
{
  "message": "Teacher assigned to subject successfully"
}
```

## POST /subjects/:id/remove-teacher
Remove teacher from subject (role-based access).

**Notes:**
- SUPER_ADMIN: Can remove any teacher from any subject
- SCHOOL_ADMIN, PRINCIPAL: Can only remove teachers within their school

**Request Body:**
```json
{
  "teacherId": "teacher-uuid"
}
```

**Response:**
```json
{
  "message": "Teacher removed from subject successfully"
}
```

---

# Subject Management

## GET /subjects
Get all subjects (paginated, role-based access).

**Query Parameters:**
- `page` (optional): Page number (default: 1)
- `limit` (optional): Items per page (default: 10)

**Notes:**
- SUPER_ADMIN: Can view all subjects across all schools
- SCHOOL_ADMIN, PRINCIPAL: Can only view subjects for their assigned school

**Response:**
```json
{
  "message": "Subjects retrieved successfully",
  "subjects": [
    {
      "id": "subject-uuid",
      "name": "Mathematics",
      "code": "MATH",
      "description": "Advanced mathematics course",
      "schoolId": "school-uuid",
      "teachers": [
        {
          "user": {
            "name": "John",
            "surname": "Smith"
          }
        }
      ],
      "_count": {
        "lessons": 45,
        "assignments": 12,
        "examQuestions": 8
      }
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 10,
    "total": 25,
    "pages": 3
  }
}
```

## GET /subjects/:id
Get subject by ID (role-based access).

**Notes:**
- SUPER_ADMIN: Can view any subject
- SCHOOL_ADMIN, PRINCIPAL: Can only view subjects belonging to their school

**Response:**
```json
{
  "message": "Subject retrieved successfully",
  "subject": {
    "id": "subject-uuid",
    "name": "Mathematics",
    "code": "MATH",
    "description": "Advanced mathematics course",
    "schoolId": "school-uuid",
    "teachers": [
      {
        "user": {
          "name": "John",
          "surname": "Smith",
          "email": "john.smith@school.edu"
        }
      }
    ],
    "lessons": [
      {
        "class": {
          "name": "Grade 8A"
        },
        "teacher": {
          "user": {
            "name": "John",
            "surname": "Smith"
          }
        }
      }
    ],
    "assignments": [
      {
        "id": "assignment-uuid",
        "title": "Algebra Quiz",
        "dueDate": "2025-09-20T23:59:59.000Z",
        "class": {
          "name": "Grade 8A"
        }
      }
    ],
    "_count": {
      "lessons": 45,
      "assignments": 12,
      "examQuestions": 8
    }
  }
}
```

## POST /subjects
Create new subject (role-based access).

**Notes:**
- SUPER_ADMIN: Can specify any schoolId
- SCHOOL_ADMIN, PRINCIPAL: schoolId is automatically set to their assigned school

**Request Body:**
```json
{
  "name": "Computer Science",
  "code": "CS101",
  "description": "Introduction to programming",
  "schoolId": "school-uuid"
}
```

**Response:**
```json
{
  "message": "Subject created successfully",
  "subject": {
    "id": "subject-uuid",
    "name": "Computer Science",
    "code": "CS101",
    "description": "Introduction to programming",
    "schoolId": "school-uuid"
  }
}
```

## PUT /subjects/:id
Update subject information (role-based access).

**Notes:**
- SUPER_ADMIN: Can update any subject
- SCHOOL_ADMIN, PRINCIPAL: Can only update subjects belonging to their school

**Request Body:**
```json
{
  "name": "Advanced Computer Science",
  "code": "CS201",
  "description": "Advanced programming concepts"
}
```

**Response:**
```json
{
  "message": "Subject updated successfully",
  "subject": {
    "id": "subject-uuid",
    "name": "Advanced Computer Science",
    "code": "CS201",
    "description": "Advanced programming concepts"
  }
}
```

## DELETE /subjects/:id
Delete subject (role-based access).

**Notes:**
- SUPER_ADMIN: Can delete any subject
- SCHOOL_ADMIN, PRINCIPAL: Can only delete subjects belonging to their school
- Cannot delete subjects with associated lessons, assignments, or exam questions

**Response:**
```json
{
  "message": "Subject deleted successfully"
}
```

## POST /subjects/:id/assign-teacher
Assign teacher to subject (role-based access).

**Notes:**
- SUPER_ADMIN: Can assign any teacher to any subject
- SCHOOL_ADMIN, PRINCIPAL: Can only assign teachers within their school

**Request Body:**
```json
{
  "teacherId": "teacher-uuid"
}
```

**Response:**
```json
{
  "message": "Teacher assigned to subject successfully"
}
```

## POST /subjects/:id/remove-teacher
Remove teacher from subject (role-based access).

**Notes:**
- SUPER_ADMIN: Can remove any teacher from any subject
- SCHOOL_ADMIN, PRINCIPAL: Can only remove teachers within their school

**Request Body:**
```json
{
  "teacherId": "teacher-uuid"
}
```

**Response:**
```json
{
  "message": "Teacher removed from subject successfully"
}
```

---

# Parent Management

## GET /parents
Get all parents (paginated, role-based access).

**Query Parameters:**
- `page` (optional): Page number (default: 1)
- `limit` (optional): Items per page (default: 10)

**Notes:**
- SUPER_ADMIN: Can view all parents
- SCHOOL_ADMIN/PRINCIPAL: Can only view parents with children in their school
- TEACHER: Can view parents of students in their classes/lessons
- PARENT: Can only view their own record

**Response:**
```json
{
  "message": "Parents retrieved successfully",
  "parents": [
    {
      "id": "parent-uuid",
      "user": {
        "id": "user-uuid",
        "email": "parent@example.com",
        "name": "Bob",
        "surname": "Johnson",
        "phone": "+1234567890"
      },
      "verificationStatus": "VERIFIED",
      "_count": {
        "children": 2,
        "payments": 4,
        "feedbacks": 1
      }
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 10,
    "total": 25,
    "pages": 3
  }
}
```

## GET /parents/:id
Get parent by ID (role-based access).

**Notes:**
- SUPER_ADMIN: Can view any parent
- SCHOOL_ADMIN/PRINCIPAL: Can only view parents with children in their school
- TEACHER: Can view parents of students in their classes/lessons
- PARENT: Can only view their own record

**Response:**
```json
{
  "message": "Parent retrieved successfully",
  "parent": {
    "id": "parent-uuid",
    "user": {
      "id": "user-uuid",
      "email": "parent@example.com",
      "name": "Bob",
      "surname": "Johnson",
      "phone": "+1234567890",
      "address": "123 Home St",
      "profileImageUrl": "https://..."
    },
    "verificationStatus": "VERIFIED",
    "children": [
      {
        "id": "student-uuid",
        "name": "Alice",
        "surname": "Johnson",
        "school": {
          "name": "Example School"
        },
        "class": {
          "name": "Grade 8A"
        }
      }
    ]
  }
}
```

## POST /parents
Create new parent (Super Admin, Principal, or School Admin only).

**Request Body:**
```json
{
  "userDetails": {
    "email": "new.parent@example.com",
    "name": "Jane",
    "surname": "Doe",
    "phone": "+1234567890",
    "password": "securepassword123"
  }
}
```

**Response:**
```json
{
  "message": "Parent created successfully",
  "parent": {
    "id": "parent-uuid",
    "user": {
      "email": "new.parent@example.com",
      "name": "Jane",
      "surname": "Doe"
    },
    "verificationStatus": "PENDING"
  }
}
```

## PUT /parents/:id
Update parent information (role-based access).

**Notes:**
- SUPER_ADMIN/PRINCIPAL/SCHOOL_ADMIN: Can update verification status
- PARENT: Can only update their own basic information

**Request Body:**
```json
{
  "verificationStatus": "VERIFIED"
}
```

**Response:**
```json
{
  "message": "Parent updated successfully",
  "parent": {
    "id": "parent-uuid",
    "verificationStatus": "VERIFIED"
  }
}
```

## PUT /parents/:id/verify
Verify parent account (School Admins, Principals, and Super Admins only).

**Request Body:**
```json
{
  "status": "VERIFIED",
  "comments": "Parent identity verified"
}
```

**Status Options:**
- `VERIFIED`: Verify the parent account
- `REJECTED`: Reject the parent account

**Response:**
```json
{
  "message": "Parent verified successfully",
  "parent": {
    "id": "parent-uuid",
    "user": {
      "name": "Bob",
      "surname": "Johnson",
      "email": "bob.johnson@example.com"
    },
    "verificationStatus": "VERIFIED"
  }
}
```

**Notes:**
- Only School Admins, Principals, and Super Admins can verify parents
- For non-super admins, can only verify parents with children in their school
- Creates notification for the parent about verification/rejection status
- Updates parent verification status and sets verifiedAt timestamp

## DELETE /parents/:id
Delete parent (Super Admin only).

**Response:**
```json
{
  "message": "Parent deleted successfully"
}
```

---

# Dashboard Management

## GET /dashboard/super-admin
Get dashboard data for Super Admin users.

**Response:**
```json
{
  "message": "Super admin dashboard retrieved successfully",
  "dashboard": {
    "overview": {
      "totalSchools": 25,
      "verifiedSchools": 20,
      "pendingSchools": 5,
      "totalUsers": 1500,
      "totalStudents": 1200,
      "totalRevenue": 50000
    },
    "recentSchools": [
      {
        "id": "school-uuid",
        "name": "New International School",
        "city": "Lagos",
        "registrationStatus": "PENDING",
        "createdAt": "2025-09-10T10:00:00.000Z"
      }
    ],
    "schoolStats": {
      "PENDING": 5,
      "APPROVED": 18,
      "REJECTED": 2
    }
  }
}
```

## GET /dashboard/school-admin
Get dashboard data for School Admin users.

**Response:**
```json
{
  "message": "School admin dashboard retrieved successfully",
  "dashboard": {
    "overview": {
      "totalStudents": 500,
      "totalTeachers": 30,
      "totalParents": 450,
      "totalClasses": 25,
      "pendingPayments": 15,
      "completedPayments": 485,
      "attendanceRate": 94.5
    },
    "recentEvents": [
      {
        "id": "event-uuid",
        "title": "Parent-Teacher Conference",
        "startTime": "2025-09-20T14:00:00.000Z",
        "eventType": "MEETING"
      }
    ]
  }
}
```

## GET /dashboard/principal
Get dashboard data for Principal users.

**Response:**
```json
{
  "message": "Principal dashboard retrieved successfully",
  "dashboard": {
    "overview": {
      "totalStudents": 500,
      "totalTeachers": 30,
      "totalClasses": 25,
      "pendingApprovals": 8,
      "attendanceRate": 94.5,
      "averagePerformance": 85.3
    },
    "recentAssignments": [
      {
        "id": "assignment-uuid",
        "title": "Mathematics Quiz",
        "createdAt": "2025-09-14T09:00:00.000Z",
        "teacher": {
          "user": {
            "name": "John",
            "surname": "Smith"
          }
        },
        "subject": {
          "name": "Mathematics"
        },
        "_count": {
          "submissions": 45
        }
      }
    ],
    "upcomingEvents": [
      {
        "id": "event-uuid",
        "title": "Science Fair",
        "startTime": "2025-10-15T10:00:00.000Z",
        "eventType": "ACADEMIC"
      }
    ]
  }
}
```

## GET /dashboard/teacher
Get dashboard data for Teacher users.

**Response:**
```json
{
  "message": "Teacher dashboard retrieved successfully",
  "dashboard": {
    "overview": {
      "totalClasses": 3,
      "totalSubjects": 4,
      "totalAssignments": 12,
      "pendingSubmissions": 8
    },
    "myClasses": [
      {
        "id": "class-uuid",
        "name": "Grade 8A",
        "capacity": 30,
        "grade": {
          "name": "Grade 8"
        },
        "_count": {
          "students": 28
        }
      }
    ],
    "mySubjects": [
      {
        "id": "subject-uuid",
        "name": "Mathematics",
        "_count": {
          "assignments": 5,
          "lessons": 20
        }
      }
    ],
    "recentAssignments": [
      {
        "id": "assignment-uuid",
        "title": "Algebra Homework",
        "subject": {
          "name": "Mathematics"
        },
        "class": {
          "name": "Grade 8A"
        },
        "_count": {
          "submissions": 25
        }
      }
    ],
    "recentAttendance": [
      {
        "date": "2025-09-14T00:00:00.000Z",
        "present": true,
        "student": {
          "name": "Alice",
          "surname": "Johnson"
        },
        "lesson": {
          "subject": {
            "name": "Mathematics"
          },
          "class": {
            "name": "Grade 8A"
          }
        }
      }
    ],
    "upcomingLessons": [
      {
        "startTime": "2025-09-16T08:00:00.000Z",
        "endTime": "2025-09-16T09:00:00.000Z",
        "lesson": {
          "subject": {
            "name": "Mathematics"
          },
          "class": {
            "name": "Grade 8A"
          }
        }
      }
    ]
  }
}
```

## GET /dashboard/parent
Get dashboard data for Parent users.

**Response:**
```json
{
  "message": "Parent dashboard retrieved successfully",
  "dashboard": {
    "overview": {
      "totalChildren": 2,
      "schoolsCount": 1,
      "pendingPaymentsCount": 1,
      "unreadNotifications": 3
    },
    "children": [
      {
        "id": "student-uuid",
        "name": "Alice",
        "surname": "Johnson",
        "birthday": "2010-05-15T00:00:00.000Z",
        "school": {
          "id": "school-uuid",
          "name": "Example School"
        },
        "class": {
          "name": "Grade 8A"
        },
        "grade": {
          "name": "Grade 8"
        },
        "attendanceSummary": {
          "total_days": 20,
          "present_days": 18,
          "attendance_rate": 90.0
        }
      }
    ],
    "recentNotifications": [
      {
        "id": "notification-uuid",
        "title": "Assignment Due",
        "content": "Mathematics assignment is due tomorrow",
        "type": "ASSIGNMENT",
        "isRead": false,
        "createdAt": "2025-09-14T10:00:00.000Z"
      }
    ],
    "upcomingEvents": [
      {
        "id": "event-uuid",
        "title": "Parent-Teacher Conference",
        "startTime": "2025-09-20T14:00:00.000Z",
        "eventType": "MEETING",
        "school": {
          "name": "Example School"
        }
      }
    ],
    "pendingPayments": [
      {
        "id": "payment-uuid",
        "amount": 50000,
        "feeStructure": {
          "name": "Term 1 Tuition",
          "amount": 50000
        },
        "school": {
          "name": "Example School"
        }
      }
    ],
    "recentResults": [
      {
        "id": "result-uuid",
        "score": 85,
        "maxScore": 100,
        "percentage": 85.0,
        "grade": "A",
        "student": {
          "name": "Alice",
          "surname": "Johnson"
        },
        "assignment": {
          "title": "Mathematics Quiz",
          "subject": {
            "name": "Mathematics"
          }
        }
      }
    ]
  }
}
```

---

# Event Management

## GET /events
Get all events (paginated).

**Query Parameters:**
- `page`, `limit` (pagination)
- `eventType` (ACADEMIC, SPORTS, CULTURAL, etc.)
- `classId` (filter by class)
- `upcoming` (true/false)
- `startDate`, `endDate` (date range)

**Response:**
```json
{
  "message": "Events retrieved successfully",
  "events": [
    {
      "id": "event-uuid",
      "title": "Science Fair",
      "description": "Annual science fair for grades 3-5",
      "location": "School Auditorium",
      "startTime": "2025-10-15T10:00:00.000Z",
      "endTime": "2025-10-15T16:00:00.000Z",
      "eventType": "ACADEMIC",
      "rsvpRequired": true,
      "school": {
        "name": "Example School"
      },
      "class": {
        "name": "Grade 4A"
      },
      "createdBy": {
        "user": {
          "name": "Ms.",
          "surname": "Davis"
        }
      },
      "_count": {
        "rsvps": 25
      }
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 10,
    "total": 5,
    "pages": 1
  }
}
```

## GET /events/upcoming
Get upcoming events.

**Query Parameters:**
- `limit` (default: 5)

**Response:**
```json
{
  "message": "Upcoming events retrieved successfully",
  "events": [
    {
      "id": "event-uuid",
      "title": "Parent-Teacher Conference",
      "startTime": "2025-09-20T14:00:00.000Z",
      "endTime": "2025-09-20T18:00:00.000Z",
      "eventType": "MEETING",
      "class": {
        "name": "Grade 3B"
      },
      "_count": {
        "rsvps": 15
      }
    }
  ]
}
```

## GET /events/:id
Get event by ID.

**Response:**
```json
{
  "message": "Event retrieved successfully",
  "event": {
    "id": "event-uuid",
    "title": "Sports Day",
    "description": "Annual sports competition",
    "location": "School Field",
    "startTime": "2025-11-05T09:00:00.000Z",
    "endTime": "2025-11-05T15:00:00.000Z",
    "eventType": "SPORTS",
    "rsvpRequired": true,
    "imageUrls": ["https://..."],
    "school": {
      "name": "Example School"
    },
    "class": {
      "name": "All Grades"
    },
    "createdBy": {
      "user": {
        "name": "Mr.",
        "surname": "Johnson",
        "email": "johnson@school.edu"
      }
    },
    "rsvps": [
      {
        "user": {
          "name": "Alice",
          "surname": "Smith"
        },
        "response": "ATTENDING",
        "respondedAt": "2025-09-10T10:30:00.000Z"
      }
    ],
    "userRsvp": "ATTENDING"
  }
}
```

## POST /events
Create new event (Principals only).

**Request Body:**
```json
{
  "title": "Mathematics Olympiad",
  "description": "School-level mathematics competition",
  "location": "Room 201",
  "startTime": "2025-12-10T09:00:00.000Z",
  "endTime": "2025-12-10T12:00:00.000Z",
  "eventType": "ACADEMIC",
  "classId": "class-uuid",
  "rsvpRequired": true
}
```

**Response:**
```json
{
  "message": "Event created successfully",
  "event": {
    "id": "event-uuid",
    "title": "Mathematics Olympiad",
    "startTime": "2025-12-10T09:00:00.000Z",
    "endTime": "2025-12-10T12:00:00.000Z",
    "eventType": "ACADEMIC",
    "rsvpRequired": true
  }
}
```

## PUT /events/:id
Update event (Principals only).

**Request Body:**
```json
{
  "title": "Updated Event Title",
  "location": "Updated Location",
  "startTime": "2025-12-10T10:00:00.000Z"
}
```

**Response:**
```json
{
  "message": "Event updated successfully",
  "event": {
    "id": "event-uuid",
    "title": "Updated Event Title"
  }
}
```

## DELETE /events/:id
Delete event (Principals only).

**Response:**
```json
{
  "message": "Event deleted successfully"
}
```

## POST /events/:id/rsvp
RSVP to event.

**Request Body:**
```json
{
  "response": "ATTENDING"
}
```

**Response:**
```json
{
  "message": "RSVP recorded successfully",
  "rsvp": {
    "eventId": "event-uuid",
    "userId": "user-uuid",
    "response": "ATTENDING",
    "respondedAt": "2025-09-15T03:56:18.769Z"
  }
}
```

---

# Mobile Endpoints

**Note:** Mobile endpoints are currently not mounted in the main application. They are intended to be mounted under `/api/mobile` and provide mobile-optimized responses for parent access.

## GET /mobile/home-screen
Get home screen data for logged-in parent.

**Response:**
```json
{
  "message": "Home screen data retrieved successfully",
  "parentProfile": {
    "id": "parent-uuid",
    "name": "Bob",
    "surname": "Johnson",
    "email": "bob.johnson@email.com",
    "profileImageUrl": "https://..."
  },
  "childrenData": [
    {
      "id": "student-uuid",
      "name": "Alice",
      "surname": "Johnson",
      "age": 14,
      "imageUrl": "https://...",
      "school": {
        "id": "school-uuid",
        "name": "Example School",
        "logoUrl": "https://..."
      },
      "class": {
        "id": "class-uuid",
        "name": "Grade 8A"
      },
      "grade": {
        "id": "grade-uuid",
        "name": "Grade 8",
        "level": 8
      },
      "attendanceSummary": {
        "totalDays": 30,
        "presentDays": 28,
        "absentDays": 2,
        "attendanceRate": 93.33
      },
      "assignmentSummary": {
        "totalAssignments": 15,
        "submittedAssignments": 14,
        "percentageCompleted": 93.33
      },
      "feeStatus": {
        "status": "Up-to-date",
        "outstandingAmount": 0,
        "lastPaymentDate": "2025-09-01T00:00:00.000Z"
      }
    }
  ]
}
```

## GET /mobile/child-profile
Get list of children for logged-in parent.

**Response:**
```json
{
  "message": "Children list retrieved successfully",
  "children": [
    {
      "id": "student-uuid",
      "name": "Alice",
      "surname": "Johnson",
      "birthday": "2010-05-15T00:00:00.000Z",
      "age": 14,
      "imageUrl": "https://...",
      "registrationNumber": "STU001",
      "school": {
        "id": "school-uuid",
        "name": "Example School",
        "city": "New York",
        "logoUrl": "https://..."
      },
      "class": {
        "id": "class-uuid",
        "name": "Grade 8A"
      },
      "grade": {
        "id": "grade-uuid",
        "name": "Grade 8",
        "level": 8
      }
    }
  ]
}
```

## GET /mobile/academic-calendar
Get academic calendar events.

**Query Parameters:**
- `startDate`, `endDate` (date range)
- `eventTypes` (array of event types)

**Response:**
```json
{
  "message": "Academic calendar events retrieved successfully",
  "events": [
    {
      "id": "event-uuid",
      "title": "First Term Exam",
      "description": "End of term examination",
      "startDate": "2025-12-15",
      "endDate": "2025-12-20",
      "eventType": "EXAMINATION",
      "isHoliday": false
    }
  ]
}
```

## GET /mobile/time-table/:studentId
Get timetable for specific student.

**Response:**
```json
{
  "message": "Timetable retrieved successfully",
  "timetable": [
    {
      "day": "MONDAY",
      "periods": [
        {
          "startTime": "08:00",
          "endTime": "09:00",
          "subject": {
            "name": "Mathematics",
            "code": "MATH"
          },
          "teacher": {
            "name": "Mr.",
            "surname": "Smith"
          },
          "room": {
            "name": "Room 101"
          }
        }
      ]
    }
  ]
}
```

## GET /mobile/attendance-record
Get attendance records.

**Query Parameters:**
- `studentId`, `startDate`, `endDate`, `subjectId`

**Response:**
```json
{
  "message": "Attendance records retrieved successfully",
  "records": [
    {
      "date": "2025-09-10",
      "present": true,
      "subject": {
        "name": "Mathematics"
      },
      "teacher": {
        "name": "Mr.",
        "surname": "Smith"
      }
    }
  ],
  "summary": {
    "totalDays": 20,
    "presentDays": 18,
    "absentDays": 2,
    "attendanceRate": 90.0
  }
}
```

---

# Additional Endpoints

## GET /dashboard/:role
Get dashboard data based on user role.

**Available roles:** super-admin, school-admin, principal, teacher, parent

**Response (Parent Dashboard):**
```json
{
  "message": "Parent dashboard retrieved successfully",
  "dashboard": {
    "childrenCount": 2,
    "totalAssignments": 15,
    "pendingAssignments": 3,
    "upcomingEvents": 5,
    "recentNotifications": 8,
    "children": [
      {
        "name": "Alice Johnson",
        "school": "Example School",
        "attendanceRate": 95.2,
        "pendingAssignments": 2
      }
    ]
  }
}
```

## GET /analytics/school
Get school analytics (Principals and School Admins).

**Response:**
```json
{
  "message": "School analytics retrieved successfully",
  "analytics": {
    "totalStudents": 500,
    "totalTeachers": 30,
    "averageAttendance": 94.5,
    "enrollmentTrend": {
      "labels": ["Jan", "Feb", "Mar"],
      "data": [480, 490, 500]
    },
    "performanceMetrics": {
      "averageGrade": 85.3,
      "passRate": 92.1
    }
  }
}
```

## GET /notifications
Get user notifications.

**Query Parameters:**
- `page`, `limit` (pagination)
- `isRead` (true/false)

**Response:**
```json
{
  "message": "Notifications retrieved successfully",
  "notifications": [
    {
      "id": "notification-uuid",
      "title": "Assignment Due",
      "content": "Mathematics assignment is due tomorrow",
      "type": "ASSIGNMENT",
      "isRead": false,
      "createdAt": "2025-09-14T10:00:00.000Z"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 10,
    "total": 25,
    "pages": 3
  }
}
```

---

# Error Responses

All endpoints may return the following error responses:

## 400 Bad Request
```json
{
  "message": "Invalid input",
  "errors": [
    {
      "code": "invalid_type",
      "expected": "string",
      "received": "number",
      "path": ["email"],
      "message": "Expected string, received number"
    }
  ]
}
```

## 401 Unauthorized
```json
{
  "message": "Invalid credentials"
}
```

## 403 Forbidden
```json
{
  "message": "Access denied. Only principals can create events"
}
```

## 404 Not Found
```json
{
  "message": "Student not found"
}
```

## 409 Conflict
```json
{
  "message": "A student with this registration number already exists in this school"
}
```

## 500 Internal Server Error
```json
{
  "message": "Internal server error"
}
```

---

# Rate Limiting

The API implements rate limiting:
- 100 requests per 15 minutes per IP address
- Health check endpoint is exempt from rate limiting

---

# File Upload

Some endpoints support file uploads using multipart/form-data:

## POST /schools/:id/logo
Upload school logo.

**Content-Type:** multipart/form-data
**Field:** logo (image file)

## POST /events/:id/images
Upload event images.

**Content-Type:** multipart/form-data
**Field:** images (multiple image files, max 10)

## POST /assignments/:id/files
Upload assignment files.

**Content-Type:** multipart/form-data
**Field:** files (multiple files, max 10)

---

# Webhooks

## POST /webhooks/paystack
Handle Paystack payment webhooks.

**Headers:**
```
x-paystack-signature: <signature>
Content-Type: application/json
```

**Body:** Paystack webhook payload

---

This documentation covers the main endpoints. For complete implementation details, refer to the source code and database schema.