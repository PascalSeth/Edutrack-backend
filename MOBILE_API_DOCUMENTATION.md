# Mobile API Documentation

This document outlines the API endpoints specifically designed for mobile applications, particularly for parent access to child-related data in the EduTrack system.

## Base URLs
- Authentication: `http://10.41.36.132/api/auth`
- Mobile Endpoints: `http://10.41.36.132/mobile/parent`

## Authentication

### Login
**Endpoint:** `POST /api/auth/login`

**Description:** Authenticates a user and returns access/refresh tokens for API access.

**Request Body:**
```json
{
  "email": "parent@example.com",
  "password": "password123"
}
```

**Request Fields:**
- `email` (string, required): User's email address
- `password` (string, required): User's password

**Response (200 OK):**
```json
{
  "message": "Login successful",
  "user": {
    "id": "user-uuid",
    "email": "parent@example.com",
    "name": "John",
    "surname": "Doe",
    "role": "PARENT",
    "approvalStatus": "APPROVED",
    "profileImageUrl": null,
    "isSuperAdmin": false,
    "isParent": true
  },
  "children": [
    {
      "id": "child-uuid-1",
      "name": "Jane",
      "surname": "Doe",
      "school": {
        "id": "school-uuid",
        "name": "Example School"
      },
      "class": {
        "id": "class-uuid",
        "name": "Grade 5A"
      }
    }
  ],
  "school": null,
  "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

**Response Fields:**
- `user` (object): User information
  - `id` (string): User UUID
  - `email` (string): User email
  - `name` (string): First name
  - `surname` (string): Last name
  - `role` (string): User role ("PARENT" for mobile users)
  - `approvalStatus` (string): Account approval status
  - `profileImageUrl` (string|null): Profile image URL
  - `isSuperAdmin` (boolean): Whether user is super admin
  - `isParent` (boolean): Whether user is parent
- `children` (array): List of children (only for PARENT role)
  - `id` (string): Child UUID
  - `name` (string): Child first name
  - `surname` (string): Child last name
  - `school` (object): School information
  - `class` (object): Class information
- `school` (object|null): School information (null for parents)
- `accessToken` (string): JWT access token (expires in 30 minutes)
- `refreshToken` (string): JWT refresh token (expires in 7 days)

**Error Responses:**
- `400 Bad Request`: Invalid input (validation errors)
- `401 Unauthorized`: Invalid credentials or inactive account
- `403 Forbidden`: School not verified

---

## Mobile Endpoints Authentication
All mobile endpoints require authentication via JWT token in the Authorization header:
```
Authorization: Bearer <jwt_token>
```

All endpoints are restricted to users with the "PARENT" role. The JWT token must be obtained through the login endpoint above.

## Common Error Responses
- **401 Unauthorized**: Invalid or missing JWT token
- **403 Forbidden**: User does not have PARENT role or access to the specified child
- **404 Not Found**: Child not found or access denied
- **500 Internal Server Error**: Server error

## Endpoints

### 1. Get Child Attendance
**Endpoint:** `GET /children/{childId}/attendance`

**Description:** Retrieves the attendance summary for a specific child for the current week.

**Path Parameters:**
- `childId` (string, required): The unique identifier of the child

**Authentication:** Required (PARENT role)

**Response (200 OK):**
```json
{
  "present": 5,
  "absent": 1,
  "total": 6,
  "thisWeek": [
    {
      "date": "2023-10-16",
      "status": "Present"
    },
    {
      "date": "2023-10-17",
      "status": "Absent"
    },
    {
      "date": "2023-10-18",
      "status": "Present"
    },
    {
      "date": "2023-10-19",
      "status": "Present"
    },
    {
      "date": "2023-10-20",
      "status": "Present"
    },
    {
      "date": "2023-10-21",
      "status": "Present"
    }
  ]
}
```

**Response Fields:**
- `present` (number): Number of days the child was present
- `absent` (number): Number of days the child was absent
- `total` (number): Total number of attendance records for the week
- `thisWeek` (array): Array of daily attendance records
  - `date` (string): Date in YYYY-MM-DD format
  - `status` (string): "Present" or "Absent"

---

### 2. Get Child Assignments
**Endpoint:** `GET /children/{childId}/assignments`

**Description:** Retrieves all assignments for a specific child, including class-specific and school-wide assignments.

**Path Parameters:**
- `childId` (string, required): The unique identifier of the child

**Authentication:** Required (PARENT role)

**Response (200 OK):**
```json
[
  {
    "id": "assignment-uuid-1",
    "title": "Math Homework Chapter 5",
    "subject": "Mathematics",
    "dueDate": "2023-10-25",
    "status": "Pending"
  },
  {
    "id": "assignment-uuid-2",
    "title": "Science Project",
    "subject": "Science",
    "dueDate": "2023-10-20",
    "status": "Completed"
  },
  {
    "id": "assignment-uuid-3",
    "title": "English Essay",
    "subject": "English",
    "dueDate": "2023-10-18",
    "status": "Overdue"
  }
]
```

**Response Fields:** Array of assignment objects
- `id` (string): Unique identifier of the assignment
- `title` (string): Title of the assignment
- `subject` (string): Name of the subject
- `dueDate` (string): Due date in YYYY-MM-DD format
- `status` (string): "Pending", "Completed", or "Overdue"

---

### 3. Get Child Timetable
**Endpoint:** `GET /children/{childId}/timetable`

**Description:** Retrieves the weekly timetable for a specific child's class.

**Path Parameters:**
- `childId` (string, required): The unique identifier of the child

**Authentication:** Required (PARENT role)

**Response (200 OK):**
```json
{
  "MONDAY": [
    {
      "time": "08:00",
      "subject": "Mathematics",
      "teacher": "John Smith",
      "room": "Room 101"
    },
    {
      "time": "09:00",
      "subject": "English",
      "teacher": "Jane Doe",
      "room": "Room 102"
    }
  ],
  "TUESDAY": [
    {
      "time": "08:00",
      "subject": "Science",
      "teacher": "Bob Johnson",
      "room": "Lab 1"
    }
  ],
  "WEDNESDAY": [],
  "THURSDAY": [
    {
      "time": "08:00",
      "subject": "History",
      "teacher": "Alice Brown",
      "room": "Room 103"
    }
  ],
  "FRIDAY": [
    {
      "time": "08:00",
      "subject": "Physical Education",
      "teacher": "Charlie Wilson",
      "room": "Gym"
    }
  ],
  "SATURDAY": [],
  "SUNDAY": []
}
```

**Response Fields:** Object with day names as keys
- Each day contains an array of timetable slots
  - `time` (string): Start time in HH:MM format
  - `subject` (string): Name of the subject
  - `teacher` (string): Full name of the teacher
  - `room` (string): Name of the classroom or "TBD" if not assigned

---

### 4. Get Child Chat/Messages
**Endpoint:** `GET /children/{childId}/chat`

**Description:** Retrieves recent messages/notifications sent to the parent regarding the child.

**Path Parameters:**
- `childId` (string, required): The unique identifier of the child

**Authentication:** Required (PARENT role)

**Response (200 OK):**
```json
[
  {
    "id": "message-uuid-1",
    "teacher": "John Smith",
    "message": "Your child completed the math assignment successfully.",
    "timestamp": "2023-10-16T14:30:00.000Z"
  },
  {
    "id": "message-uuid-2",
    "teacher": "Jane Doe",
    "message": "Please review the homework due tomorrow.",
    "timestamp": "2023-10-15T09:15:00.000Z"
  }
]
```

**Response Fields:** Array of message objects
- `id` (string): Unique identifier of the message
- `teacher` (string): Full name of the teacher who sent the message
- `message` (string): Content of the message
- `timestamp` (string): ISO 8601 timestamp of when the message was sent

---

### 5. Get Child Grades
**Endpoint:** `GET /children/{childId}/grades`

**Description:** Retrieves the overall grade summary for a specific child.

**Path Parameters:**
- `childId` (string, required): The unique identifier of the child

**Authentication:** Required (PARENT role)

**Response (200 OK):**
```json
{
  "overall": "85%",
  "courses": 6
}
```

**Response Fields:**
- `overall` (string): Overall percentage grade across all subjects
- `courses` (number): Number of courses/subjects the child is enrolled in

## Implementation Notes
- All endpoints verify that the authenticated parent has access to the specified child
- Timetable data is grouped by day of the week
- Attendance data covers the current week (Monday to Sunday)
- Assignments include both class-specific and school-wide assignments
- Chat messages are limited to the 50 most recent messages
- Grades are calculated as an average percentage across all exam results

## Error Handling
All endpoints follow consistent error handling:
- Return appropriate HTTP status codes
- Include descriptive error messages in JSON response
- Log errors for debugging purposes

## Rate Limiting
Consider implementing rate limiting on mobile endpoints to prevent abuse, especially for frequently called endpoints like attendance and timetable.