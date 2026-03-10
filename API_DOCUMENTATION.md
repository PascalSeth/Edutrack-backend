# Edutrack Backend API Documentation

This document provides comprehensive documentation for the Edutrack backend API, including all endpoints, request/response schemas, and authentication requirements.

## Base URL
```
/api
```

## Authentication
All endpoints require authentication via JWT token in the Authorization header:
```
Authorization: Bearer <token>
```

Role-based access control is implemented with the following roles:
- `SUPER_ADMIN`: Full system access
- `SCHOOL_ADMIN`: School-level administration
- `PRINCIPAL`: School principal access
- `TEACHER`: Teaching staff access
- `PARENT`: Parent access

## API Endpoints

### Authentication Routes (`/auth`)
- `POST /auth/login` - User login
- `POST /auth/register` - User registration
- `POST /auth/refresh` - Refresh access token
- `POST /auth/logout` - User logout

### User Management (`/users`)
- `GET /users` - Get all users (SUPER_ADMIN, PRINCIPAL, TEACHER, PARENT)
- `GET /users/:id` - Get user by ID (SUPER_ADMIN, PRINCIPAL, TEACHER, PARENT)
- `PUT /users/:id` - Update user (SUPER_ADMIN, PRINCIPAL, TEACHER, PARENT)
- `DELETE /users/:id` - Delete user (SUPER_ADMIN only)

### School Management (`/schools`)
- `GET /schools` - Get all schools (SUPER_ADMIN, PRINCIPAL, SCHOOL_ADMIN, TEACHER, PARENT)
- `GET /schools/:id` - Get school by ID (SUPER_ADMIN, SCHOOL_ADMIN, PRINCIPAL, TEACHER, PARENT)
- `GET /schools/:id/stats` - Get school statistics (SUPER_ADMIN, PRINCIPAL, TEACHER, PARENT)
- `POST /schools` - Create school (SUPER_ADMIN only)
- `PUT /schools/:id` - Update school (SUPER_ADMIN, SCHOOL_ADMIN)
- `PATCH /schools/:id/verify` - Verify school (SUPER_ADMIN, SCHOOL_ADMIN)
- `POST /schools/:id/logo` - Upload school logo (SUPER_ADMIN, SCHOOL_ADMIN)
- `POST /schools/:id/accreditation` - Upload accreditation documents (SUPER_ADMIN, SCHOOL_ADMIN)
- `DELETE /schools/:id` - Delete school (SUPER_ADMIN only)

### Subject Management (`/subjects`)
- `GET /subjects` - Get all subjects (SUPER_ADMIN, SCHOOL_ADMIN, PRINCIPAL, TEACHER, PARENT)
- `GET /subjects/:id` - Get subject by ID (SUPER_ADMIN, SCHOOL_ADMIN, PRINCIPAL, TEACHER, PARENT)
- `POST /subjects` - Create subject (SUPER_ADMIN, PRINCIPAL, SCHOOL_ADMIN)
- `PUT /subjects/:id` - Update subject (SUPER_ADMIN, PRINCIPAL, SCHOOL_ADMIN)
- `DELETE /subjects/:id` - Delete subject (SUPER_ADMIN, PRINCIPAL, SCHOOL_ADMIN)
- `POST /subjects/:id/teachers` - Assign teacher to subject (SUPER_ADMIN, PRINCIPAL, SCHOOL_ADMIN)
- `DELETE /subjects/:id/teachers` - Remove teacher from subject (SUPER_ADMIN, PRINCIPAL, SCHOOL_ADMIN)

### Teacher Management (`/teachers`)
- `GET /teachers` - Get all teachers (SUPER_ADMIN, PRINCIPAL, SCHOOL_ADMIN)
- `GET /teachers/:id` - Get teacher by ID (SUPER_ADMIN, PRINCIPAL, TEACHER, SCHOOL_ADMIN)
- `POST /teachers` - Create teacher (SUPER_ADMIN, PRINCIPAL, SCHOOL_ADMIN)
- `PUT /teachers/:id` - Update teacher (SUPER_ADMIN, PRINCIPAL, SCHOOL_ADMIN)
- `PUT /teachers/:id/verify` - Verify teacher (SUPER_ADMIN, PRINCIPAL, SCHOOL_ADMIN)
- `DELETE /teachers/:id` - Delete teacher (SUPER_ADMIN, PRINCIPAL, SCHOOL_ADMIN)

### Student Management (`/students`)
- `GET /students` - Get all students (SUPER_ADMIN, PRINCIPAL, SCHOOL_ADMIN, TEACHER, PARENT)
- `GET /students/by-school` - Get students by school (SUPER_ADMIN, PRINCIPAL, SCHOOL_ADMIN)
- `GET /students/:id` - Get student by ID (SUPER_ADMIN, PRINCIPAL, SCHOOL_ADMIN, TEACHER, PARENT)
- `POST /students` - Create student (SUPER_ADMIN, PRINCIPAL, SCHOOL_ADMIN)
- `PUT /students/:id` - Update student (SUPER_ADMIN, PRINCIPAL, SCHOOL_ADMIN, TEACHER, PARENT)
- `DELETE /students/:id` - Delete student (SUPER_ADMIN, PRINCIPAL, SCHOOL_ADMIN)

### Parent Management (`/parents`)
- `GET /parents` - Get all parents (SUPER_ADMIN, PRINCIPAL, SCHOOL_ADMIN, TEACHER)
- `GET /parents/by-school` - Get parents by school (SUPER_ADMIN, PRINCIPAL, SCHOOL_ADMIN)
- `GET /parents/:id` - Get parent by ID (SUPER_ADMIN, PRINCIPAL, SCHOOL_ADMIN, TEACHER, PARENT)
- `GET /parents/:id/children` - Get parent's children (SUPER_ADMIN, PRINCIPAL, SCHOOL_ADMIN, TEACHER, PARENT)
- `POST /parents` - Create parent (SUPER_ADMIN, PRINCIPAL, SCHOOL_ADMIN)
- `PUT /parents/:id` - Update parent (SUPER_ADMIN, PRINCIPAL, SCHOOL_ADMIN, PARENT)
- `PUT /parents/:id/verify` - Verify parent (SUPER_ADMIN, PRINCIPAL, SCHOOL_ADMIN)
- `DELETE /parents/:id` - Delete parent (SUPER_ADMIN only)

### Principal Management (`/principals`)
- `GET /principals` - Get all principals (SUPER_ADMIN, PRINCIPAL, SCHOOL_ADMIN)
- `GET /principals/:id` - Get principal by ID (SUPER_ADMIN, PRINCIPAL, SCHOOL_ADMIN)
- `POST /principals` - Create principal (SUPER_ADMIN, PRINCIPAL, SCHOOL_ADMIN)
- `PUT /principals/:id` - Update principal (SUPER_ADMIN, PRINCIPAL, SCHOOL_ADMIN)
- `PUT /principals/:id/verify` - Verify principal (SUPER_ADMIN, SCHOOL_ADMIN)
- `DELETE /principals/:id` - Delete principal (SUPER_ADMIN, PRINCIPAL, SCHOOL_ADMIN)

### Class Management (`/classes`)
- `GET /classes` - Get all classes (SUPER_ADMIN, PRINCIPAL, SCHOOL_ADMIN, TEACHER)
- `GET /classes/:id` - Get class by ID (SUPER_ADMIN, PRINCIPAL, SCHOOL_ADMIN, TEACHER)
- `POST /classes` - Create class (SUPER_ADMIN, PRINCIPAL, SCHOOL_ADMIN)
- `PUT /classes/:id` - Update class (SUPER_ADMIN, PRINCIPAL, SCHOOL_ADMIN)
- `DELETE /classes/:id` - Delete class (SUPER_ADMIN, PRINCIPAL, SCHOOL_ADMIN)

### Grade Management (`/grades`)
- `GET /grades` - Get all grades (SUPER_ADMIN, PRINCIPAL, SCHOOL_ADMIN, TEACHER)
- `GET /grades/:id` - Get grade by ID (SUPER_ADMIN, PRINCIPAL, SCHOOL_ADMIN, TEACHER)
- `POST /grades` - Create grade (SUPER_ADMIN, PRINCIPAL, SCHOOL_ADMIN)
- `PUT /grades/:id` - Update grade (SUPER_ADMIN, PRINCIPAL, SCHOOL_ADMIN)
- `DELETE /grades/:id` - Delete grade (SUPER_ADMIN, PRINCIPAL, SCHOOL_ADMIN)

### Assignment Management (`/assignments`)
- `GET /assignments` - Get all assignments (SUPER_ADMIN, PRINCIPAL, TEACHER, PARENT)
- `GET /assignments/:id` - Get assignment by ID (SUPER_ADMIN, PRINCIPAL, TEACHER, PARENT)
- `POST /assignments` - Create assignment (TEACHER, PRINCIPAL, SCHOOL_ADMIN)
- `PUT /assignments/:id` - Update assignment (TEACHER, PRINCIPAL, SCHOOL_ADMIN)
- `DELETE /assignments/:id` - Delete assignment (TEACHER, PRINCIPAL, SCHOOL_ADMIN)
- `POST /assignments/:id/files` - Upload assignment files (TEACHER, PRINCIPAL, SCHOOL_ADMIN)
- `POST /assignments/:id/submit` - Submit assignment (PARENT)
- `GET /assignments/student/:studentId` - Get student assignments (SUPER_ADMIN, PRINCIPAL, SCHOOL_ADMIN, TEACHER, PARENT)

### Exam Management (`/exams`)
- `GET /exams` - Get all exams (SUPER_ADMIN, PRINCIPAL, SCHOOL_ADMIN, TEACHER)
- `GET /exams/:id` - Get exam by ID (SUPER_ADMIN, PRINCIPAL, SCHOOL_ADMIN, TEACHER)
- `POST /exams` - Create exam (SUPER_ADMIN, PRINCIPAL, SCHOOL_ADMIN)
- `PUT /exams/:id` - Update exam (SUPER_ADMIN, PRINCIPAL, SCHOOL_ADMIN)
- `DELETE /exams/:id` - Delete exam (SUPER_ADMIN, PRINCIPAL, SCHOOL_ADMIN)
- `GET /exams/:examId/sessions` - Get exam sessions (SUPER_ADMIN, PRINCIPAL, SCHOOL_ADMIN, TEACHER)
- `POST /exams/sessions` - Create exam session (SUPER_ADMIN, PRINCIPAL, SCHOOL_ADMIN)
- `PUT /exams/sessions/:id` - Update exam session (SUPER_ADMIN, PRINCIPAL, SCHOOL_ADMIN)
- `DELETE /exams/sessions/:id` - Delete exam session (SUPER_ADMIN, PRINCIPAL, SCHOOL_ADMIN)

### Timetable Management (`/timetables`)
- `GET /timetables` - Get all timetables (SUPER_ADMIN, PRINCIPAL, SCHOOL_ADMIN, TEACHER)
- `GET /timetables/:id` - Get timetable by ID (SUPER_ADMIN, PRINCIPAL, SCHOOL_ADMIN, TEACHER)
- `POST /timetables` - Create timetable (SUPER_ADMIN, PRINCIPAL, SCHOOL_ADMIN)
- `PUT /timetables/:id` - Update timetable (SUPER_ADMIN, PRINCIPAL, SCHOOL_ADMIN)
- `DELETE /timetables/:id` - Delete timetable (SUPER_ADMIN, PRINCIPAL, SCHOOL_ADMIN)
- `POST /timetables/slots` - Create timetable slot (SUPER_ADMIN, PRINCIPAL, SCHOOL_ADMIN)
- `PUT /timetables/slots/:id` - Update timetable slot (SUPER_ADMIN, PRINCIPAL, SCHOOL_ADMIN)
- `DELETE /timetables/slots/:id` - Delete timetable slot (SUPER_ADMIN, PRINCIPAL, SCHOOL_ADMIN)
- `GET /timetables/teacher/:teacherId` - Get teacher timetable (SUPER_ADMIN, PRINCIPAL, SCHOOL_ADMIN, TEACHER)
- `GET /timetables/class/:classId` - Get class timetable (SUPER_ADMIN, PRINCIPAL, SCHOOL_ADMIN, TEACHER)

### Attendance Management (`/attendance`)
- `POST /attendance` - Record single attendance (TEACHER, SUPER_ADMIN)
- `POST /attendance/bulk` - Record bulk attendance (TEACHER, SUPER_ADMIN)
- `GET /attendance/student/:studentId` - Get student attendance (SUPER_ADMIN, PRINCIPAL, SCHOOL_ADMIN, TEACHER, PARENT)
- `GET /attendance/class/:classId` - Get class attendance (SUPER_ADMIN, PRINCIPAL, TEACHER)
- `GET /attendance/analytics` - Get attendance analytics (SUPER_ADMIN, PRINCIPAL, TEACHER, PARENT)

### Curriculum Management (`/curriculum`)
- `GET /curriculum` - Get all curriculums (SUPER_ADMIN, PRINCIPAL, SCHOOL_ADMIN, TEACHER)
- `GET /curriculum/:id` - Get curriculum by ID (SUPER_ADMIN, PRINCIPAL, SCHOOL_ADMIN, TEACHER)
- `POST /curriculum` - Create curriculum (SUPER_ADMIN, PRINCIPAL, SCHOOL_ADMIN)
- `PUT /curriculum/:id` - Update curriculum (SUPER_ADMIN, PRINCIPAL, SCHOOL_ADMIN)
- `DELETE /curriculum/:id` - Delete curriculum (SUPER_ADMIN, PRINCIPAL, SCHOOL_ADMIN)
- `POST /curriculum/subjects` - Create curriculum subject (SUPER_ADMIN, PRINCIPAL, SCHOOL_ADMIN)
- `GET /curriculum/subjects/:curriculumSubjectId/objectives` - Get learning objectives (SUPER_ADMIN, PRINCIPAL, SCHOOL_ADMIN, TEACHER)
- `POST /curriculum/objectives` - Create learning objective (SUPER_ADMIN, PRINCIPAL, SCHOOL_ADMIN)
- `PUT /curriculum/progress` - Update student progress (SUPER_ADMIN, PRINCIPAL, SCHOOL_ADMIN, TEACHER)
- `GET /curriculum/progress/student/:studentId` - Get student progress (SUPER_ADMIN, PRINCIPAL, SCHOOL_ADMIN, TEACHER, PARENT)
- `GET /curriculum/:curriculumId/progress` - Get curriculum progress (SUPER_ADMIN, PRINCIPAL, SCHOOL_ADMIN, TEACHER)

### Event Management (`/events`)
- `GET /events` - Get all events (SUPER_ADMIN, PRINCIPAL, TEACHER, PARENT)
- `GET /events/upcoming` - Get upcoming events (SUPER_ADMIN, PRINCIPAL, TEACHER, PARENT)
- `GET /events/:id` - Get event by ID (SUPER_ADMIN, PRINCIPAL, TEACHER, PARENT)
- `POST /events` - Create event (PRINCIPAL, SCHOOL_ADMIN)
- `PUT /events/:id` - Update event (PRINCIPAL, SCHOOL_ADMIN)
- `DELETE /events/:id` - Delete event (PRINCIPAL, SCHOOL_ADMIN)
- `POST /events/:id/images` - Upload event images (PRINCIPAL, SCHOOL_ADMIN)
- `POST /events/:id/rsvp` - RSVP to event (SUPER_ADMIN, PRINCIPAL, TEACHER, PARENT)
- `GET /events/:id/rsvps` - Get event RSVPs (PRINCIPAL)

### Notification Management (`/notifications`)
- `GET /notifications` - Get user notifications (SUPER_ADMIN, PRINCIPAL, TEACHER, PARENT)
- `GET /notifications/stats` - Get notification statistics (SUPER_ADMIN, PRINCIPAL, TEACHER, PARENT)
- `GET /notifications/preferences` - Get notification preferences (SUPER_ADMIN, PRINCIPAL, TEACHER, PARENT)
- `POST /notifications` - Create notification (SUPER_ADMIN, PRINCIPAL, SCHOOL_ADMIN)
- `PATCH /notifications/read` - Mark notifications as read (SUPER_ADMIN, PRINCIPAL, TEACHER, PARENT)
- `PATCH /notifications/read-all` - Mark all notifications as read (SUPER_ADMIN, PRINCIPAL, TEACHER, PARENT)
- `PUT /notifications/preferences` - Update notification preferences (SUPER_ADMIN, PRINCIPAL, TEACHER, PARENT)
- `DELETE /notifications/:id` - Delete notification (SUPER_ADMIN, PRINCIPAL, TEACHER, PARENT)

### Material Management (`/materials`)
- `GET /materials/schools/:schoolId/categories` - Get material categories (All authenticated users)
- `POST /materials/schools/:schoolId/categories` - Create material category (All authenticated users)
- `GET /materials/categories/:categoryId/materials` - Get materials by category (All authenticated users)
- `GET /materials/materials/:materialId` - Get material (All authenticated users)
- `POST /materials/schools/:schoolId/materials` - Create material (All authenticated users)
- `PUT /materials/materials/:materialId` - Update material (All authenticated users)
- `DELETE /materials/materials/:materialId` - Delete material (All authenticated users)
- `GET /materials/parents/:parentId/schools/:schoolId/cart` - Get cart (All authenticated users)
- `POST /materials/parents/:parentId/schools/:schoolId/cart` - Add to cart (All authenticated users)
- `PUT /materials/cart-items/:cartItemId` - Update cart item (All authenticated users)
- `DELETE /materials/cart-items/:cartItemId` - Remove from cart (All authenticated users)
- `DELETE /materials/parents/:parentId/schools/:schoolId/cart` - Clear cart (All authenticated users)

### Material Order Management (`/material-orders`)
- `POST /material-orders/parents/:parentId/schools/:schoolId/orders` - Create order from cart (All authenticated users)
- `GET /material-orders/parents/:parentId/orders` - Get parent orders (All authenticated users)
- `GET /material-orders/schools/:schoolId/orders` - Get school orders (All authenticated users)
- `GET /material-orders/orders/:orderId` - Get order details (All authenticated users)
- `PUT /material-orders/orders/:orderId/status` - Update order status (All authenticated users)
- `PUT /material-orders/orders/:orderId/cancel` - Cancel order (All authenticated users)
- `POST /material-orders/orders/:orderId/payment/initialize` - Initialize order payment (All authenticated users)
- `GET /material-orders/orders/payment/verify/:reference` - Verify order payment (All authenticated users)

### Fee Breakdown Management (`/fee-breakdown`)
- `GET /fee-breakdown/schools/:schoolId/fee-structures` - Get fee structures (SCHOOL_ADMIN, PRINCIPAL)
- `GET /fee-breakdown/fee-structures/:feeStructureId` - Get fee structure (SCHOOL_ADMIN, PRINCIPAL)
- `POST /fee-breakdown/schools/:schoolId/fee-structures` - Create fee structure (SCHOOL_ADMIN, PRINCIPAL)
- `PUT /fee-breakdown/fee-structures/:feeStructureId` - Update fee structure (SCHOOL_ADMIN, PRINCIPAL)
- `POST /fee-breakdown/fee-structures/:feeStructureId/items` - Add fee breakdown item (SCHOOL_ADMIN, PRINCIPAL)
- `PUT /fee-breakdown/fee-breakdown-items/:itemId` - Update fee breakdown item (SCHOOL_ADMIN, PRINCIPAL)
- `DELETE /fee-breakdown/fee-breakdown-items/:itemId` - Delete fee breakdown item (SCHOOL_ADMIN, PRINCIPAL)
- `PUT /fee-breakdown/fee-breakdown-items/:itemId/students/:studentId/override` - Set student override (SCHOOL_ADMIN, PRINCIPAL)
- `GET /fee-breakdown/students/:studentId/fee-breakdown` - Get student fee breakdown (PARENT)

### Report Card Management (`/report-cards`)
- `GET /report-cards` - Get all report cards (SUPER_ADMIN, PRINCIPAL, SCHOOL_ADMIN, TEACHER)
- `GET /report-cards/:id` - Get report card by ID (SUPER_ADMIN, PRINCIPAL, SCHOOL_ADMIN, TEACHER)
- `POST /report-cards` - Create report card (SUPER_ADMIN, PRINCIPAL, SCHOOL_ADMIN)
- `PUT /report-cards/:id` - Update report card (SUPER_ADMIN, PRINCIPAL, SCHOOL_ADMIN)
- `POST /report-cards/:id/approve` - Approve report card (SUPER_ADMIN, PRINCIPAL, SCHOOL_ADMIN)
- `POST /report-cards/:id/publish` - Publish report card (SUPER_ADMIN, PRINCIPAL, SCHOOL_ADMIN)
- `POST /report-cards/generate` - Generate report cards (SUPER_ADMIN, PRINCIPAL, SCHOOL_ADMIN)
- `POST /report-cards/subject-reports` - Create subject report (SUPER_ADMIN, PRINCIPAL, SCHOOL_ADMIN)
- `PUT /report-cards/subject-reports/:id` - Update subject report (SUPER_ADMIN, PRINCIPAL, SCHOOL_ADMIN)
- `GET /report-cards/student/:studentId` - Get student report cards (SUPER_ADMIN, PRINCIPAL, SCHOOL_ADMIN, TEACHER, PARENT)

### Room Management (`/rooms`)
- `GET /rooms` - Get all rooms (SUPER_ADMIN, PRINCIPAL, SCHOOL_ADMIN, TEACHER)
- `GET /rooms/:id` - Get room by ID (SUPER_ADMIN, PRINCIPAL, SCHOOL_ADMIN, TEACHER)
- `POST /rooms` - Create room (SUPER_ADMIN, PRINCIPAL, SCHOOL_ADMIN)
- `PUT /rooms/:id` - Update room (SUPER_ADMIN, PRINCIPAL, SCHOOL_ADMIN)
- `DELETE /rooms/:id` - Delete room (SUPER_ADMIN, PRINCIPAL, SCHOOL_ADMIN)
- `GET /rooms/:id/availability` - Get room availability (SUPER_ADMIN, PRINCIPAL, SCHOOL_ADMIN, TEACHER)
- `GET /rooms/:id/utilization` - Get room utilization (SUPER_ADMIN, PRINCIPAL, SCHOOL_ADMIN, TEACHER)

### Academic Calendar Management (`/academic-calendar`)
- `GET /academic-calendar/terms` - Get all terms (SUPER_ADMIN, PRINCIPAL, SCHOOL_ADMIN, TEACHER)
- `GET /academic-calendar/terms/:id` - Get term by ID (SUPER_ADMIN, PRINCIPAL, SCHOOL_ADMIN, TEACHER)
- `POST /academic-calendar/terms` - Create term (SUPER_ADMIN, PRINCIPAL, SCHOOL_ADMIN)
- `PUT /academic-calendar/terms/:id` - Update term (SUPER_ADMIN, PRINCIPAL, SCHOOL_ADMIN)
- `DELETE /academic-calendar/terms/:id` - Delete term (SUPER_ADMIN, PRINCIPAL, SCHOOL_ADMIN)
- `GET /academic-calendar/holidays` - Get all holidays (SUPER_ADMIN, PRINCIPAL, SCHOOL_ADMIN, TEACHER)
- `POST /academic-calendar/holidays` - Create holiday (SUPER_ADMIN, PRINCIPAL, SCHOOL_ADMIN)
- `PUT /academic-calendar/holidays/:id` - Update holiday (SUPER_ADMIN, PRINCIPAL, SCHOOL_ADMIN)
- `DELETE /academic-calendar/holidays/:id` - Delete holiday (SUPER_ADMIN, PRINCIPAL, SCHOOL_ADMIN)
- `POST /academic-calendar/calendar-items` - Create calendar item (SUPER_ADMIN, PRINCIPAL, SCHOOL_ADMIN)
- `GET /academic-calendar/calendar/:academicCalendarId/items` - Get calendar items (SUPER_ADMIN, PRINCIPAL, SCHOOL_ADMIN, TEACHER)
- `GET /academic-calendar/calendar` - Get academic calendar overview (SUPER_ADMIN, PRINCIPAL, SCHOOL_ADMIN, TEACHER)

### Dashboard Routes (`/dashboard`)
- `GET /dashboard/super-admin` - Get super admin dashboard (SUPER_ADMIN)
- `GET /dashboard/school-admin` - Get school admin dashboard (SCHOOL_ADMIN)
- `GET /dashboard/principal` - Get principal dashboard (PRINCIPAL)
- `GET /dashboard/teacher` - Get teacher dashboard (TEACHER)
- `GET /dashboard/parent` - Get parent dashboard (PARENT)

### Analytics Routes (`/analytics`)
- `GET /analytics/school` - Get school analytics (SUPER_ADMIN, PRINCIPAL, SCHOOL_ADMIN)
- `GET /analytics/student/:studentId` - Get student analytics (SUPER_ADMIN, PRINCIPAL, SCHOOL_ADMIN, TEACHER, PARENT)
- `GET /analytics/class/:classId` - Get class analytics (SUPER_ADMIN, PRINCIPAL, TEACHER)
- `GET /analytics/engagement` - Get parent engagement analytics (SUPER_ADMIN, PRINCIPAL, SCHOOL_ADMIN)

### Parent Subscription Routes (`/parent-subscriptions`)
- `GET /parent-subscriptions` - Get parent subscription (All authenticated users)
- `POST /parent-subscriptions` - Create parent subscription (All authenticated users)
- `PUT /parent-subscriptions/:id/cancel` - Cancel parent subscription (All authenticated users)

### School Payment Routes (`/school-payments`)
- `GET /school-payments/schools/:schoolId/payment-account` - Get school payment account (All authenticated users)
- `POST /school-payments/schools/:schoolId/payment-account` - Create school payment account (All authenticated users)
- `PUT /school-payments/payment-accounts/:accountId/status` - Update payment account status (All authenticated users)
- `GET /school-payments/schools/:schoolId/payment-statistics` - Get payment statistics (All authenticated users)
- `GET /school-payments/schools/:schoolId/transfer-history` - Get transfer history (All authenticated users)

### Webhook Routes (`/webhooks`)
- `POST /webhooks/paystack` - Handle Paystack webhook
- `POST /webhooks/payments/:paymentId/retry-transfer` - Retry transfer

### Mobile Endpoint Routes (`/mobile/parent`)

#### Child Attendance (`/mobile/parent/children/:childId/attendance`)
- `GET /mobile/parent/children/:childId/attendance` - Get child attendance summary (PARENT only)
- **Response:** `{ present: number, absent: number, total: number, thisWeek: Array<{ date: string, status: "Present"|"Absent" }> }`

#### Child Assignments (`/mobile/parent/children/:childId/assignments`)
- `GET /mobile/parent/children/:childId/assignments` - Get child assignments (PARENT only)
- **Response:** `Array<{ id: string, title: string, subject: string, dueDate: string, status: "Pending"|"Completed"|"Overdue" }>`

#### Child Timetable (`/mobile/parent/children/:childId/timetable`)
- `GET /mobile/parent/children/:childId/timetable` - Get child timetable (PARENT only)
- **Response:** `{ [day: string]: Array<{ time: string, subject: string, teacher: string, room: string }> }`

#### Child Chat (`/mobile/parent/children/:childId/chat`)
- `GET /mobile/parent/children/:childId/chat` - Get child messages from teachers (PARENT only)
- **Response:** `Array<{ id: string, teacher: string, message: string, timestamp: string }>`

#### Child Grades (`/mobile/parent/children/:childId/grades`)
- `GET /mobile/parent/children/:childId/grades` - Get child grades summary (PARENT only)
- **Response:** `{ overall: string, courses: number }`

## Request/Response Schemas

### Common Response Format
All API responses follow this structure:
```json
{
  "message": "string",
  "data": "object or array",
  "pagination": {
    "page": "number",
    "limit": "number",
    "total": "number",
    "pages": "number"
  }
}
```

### Error Response Format
```json
{
  "message": "Error description",
  "errors": ["array of validation errors"] // for validation errors
}
```

### Pagination Parameters
Many GET endpoints support pagination:
- `page`: Page number (default: 1)
- `limit`: Items per page (default: 10)

### File Upload
Endpoints that accept file uploads use multipart/form-data with field names like `files`, `logo`, `documents`, etc.

### School Management Schemas

#### Register School Request
```json
{
  "name": "string (required)",
  "address": "string (required)",
  "city": "string (required)",
  "state": "string (required)",
  "country": "string (required)",
  "postalCode": "string (optional)",
  "phone": "string (optional)",
  "email": "string (optional)",
  "website": "string (optional)",
  "schoolType": "PRIMARY|SECONDARY|MONTESSORI|INTERNATIONAL|TECHNICAL|UNIVERSITY|OTHER (optional)",
  "missionStatement": "string (optional)",
  "virtualTourUrl": "string (optional)",
  "adminUserId": "string (UUID, optional)",
  "adminEmail": "string (optional)",
  "adminUsername": "string (optional)",
  "adminPassword": "string (optional)",
  "adminName": "string (optional)",
  "adminSurname": "string (optional)"
}
```

#### Update School Request
```json
{
  "name": "string (optional)",
  "address": "string (optional)",
  "city": "string (optional)",
  "state": "string (optional)",
  "country": "string (optional)",
  "postalCode": "string (optional)",
  "phone": "string (optional)",
  "email": "string (optional)",
  "website": "string (optional)",
  "schoolType": "PRIMARY|SECONDARY|MONTESSORI|INTERNATIONAL|TECHNICAL|UNIVERSITY|OTHER (optional)",
  "missionStatement": "string (optional)",
  "virtualTourUrl": "string (optional)"
}
```

#### Verify School Request
```json
{
  "status": "APPROVED|REJECTED",
  "comments": "string (optional)"
}
```

#### School Response
```json
{
  "id": "string",
  "name": "string",
  "address": "string",
  "city": "string",
  "state": "string",
  "country": "string",
  "logoUrl": "string",
  "schoolType": "string",
  "registrationStatus": "PENDING|APPROVED|REJECTED",
  "isVerified": "boolean",
  "createdAt": "string",
  "_count": {
    "students": "number",
    "teachers": "number"
  }
}
```

#### School Stats Response
```json
{
  "school": {
    "id": "string",
    "name": "string",
    "registrationStatus": "string",
    "isVerified": "boolean"
  },
  "counts": {
    "students": "number",
    "teachers": "number",
    "classes": "number",
    "grades": "number",
    "subjects": "number",
    "events": "number",
    "announcements": "number",
    "payments": "number",
    "parents": "number"
  },
  "financial": {
    "totalRevenue": "number",
    "pendingPayments": "number"
  },
  "activity": {
    "recentNotifications": "number"
  }
}
```

### Subject Management Schemas

#### Create Subject Request
```json
{
  "name": "string (required)",
  "code": "string (optional)",
  "description": "string (optional)",
  "schoolId": "string (UUID, required for SUPER_ADMIN)"
}
```

#### Update Subject Request
```json
{
  "name": "string (optional)",
  "code": "string (optional)",
  "description": "string (optional)"
}
```

#### Subject Response
```json
{
  "id": "string",
  "name": "string",
  "code": "string",
  "description": "string",
  "schoolId": "string",
  "teachers": [
    {
      "id": "string",
      "user": {
        "name": "string",
        "surname": "string"
      }
    }
  ],
  "_count": {
    "lessons": "number",
    "assignments": "number",
    "examQuestions": "number"
  }
}
```

#### Assign/Remove Teacher Request
```json
{
  "teacherId": "string (required)"
}
```

### Assignment Management Schemas

#### Create Assignment Request
```json
{
  "title": "string (required)",
  "description": "string (optional)",
  "instructions": "string (optional)",
  "startDate": "string (ISO datetime, required)",
  "dueDate": "string (ISO datetime, required)",
  "maxScore": "number (optional)",
  "subjectId": "string (UUID, required)",
  "classId": "string (UUID, optional)",
  "assignmentType": "INDIVIDUAL|GROUP|CLASS_WIDE (default: INDIVIDUAL)"
}
```

#### Update Assignment Request
```json
{
  "title": "string (optional)",
  "description": "string (optional)",
  "instructions": "string (optional)",
  "startDate": "string (ISO datetime, optional)",
  "dueDate": "string (ISO datetime, optional)",
  "maxScore": "number (optional)",
  "assignmentType": "INDIVIDUAL|GROUP|CLASS_WIDE (optional)"
}
```

#### Submit Assignment Request
```json
{
  "comments": "string (optional)"
}
```

#### Assignment Response
```json
{
  "id": "string",
  "title": "string",
  "description": "string",
  "instructions": "string",
  "startDate": "string",
  "dueDate": "string",
  "maxScore": "number",
  "subjectId": "string",
  "classId": "string",
  "teacherId": "string",
  "schoolId": "string",
  "assignmentType": "string",
  "documentUrls": ["string"],
  "subject": {
    "name": "string",
    "code": "string"
  },
  "class": {
    "name": "string"
  },
  "teacher": {
    "user": {
      "name": "string",
      "surname": "string"
    }
  },
  "_count": {
    "submissions": "number"
  }
}
```

#### Assignment Submission Response
```json
{
  "id": "string",
  "assignmentId": "string",
  "studentId": "string",
  "submissionUrls": ["string"],
  "comments": "string",
  "submittedAt": "string"
}
```

### User Management Schemas

#### Create/Update User Request
```json
{
  "email": "string (required)",
  "username": "string (required)",
  "name": "string (required)",
  "surname": "string (required)",
  "role": "SUPER_ADMIN|SCHOOL_ADMIN|PRINCIPAL|TEACHER|PARENT (required for create)",
  "isActive": "boolean (optional)"
}
```

#### User Response
```json
{
  "id": "string",
  "email": "string",
  "username": "string",
  "name": "string",
  "surname": "string",
  "role": "string",
  "isActive": "boolean",
  "createdAt": "string",
  "updatedAt": "string"
}
```

### Student Management Schemas

#### Create Student Request
```json
{
  "name": "string (required)",
  "surname": "string (required)",
  "dateOfBirth": "string (ISO date, required)",
  "gender": "MALE|FEMALE|OTHER (required)",
  "address": "string (optional)",
  "phone": "string (optional)",
  "email": "string (optional)",
  "enrollmentDate": "string (ISO date, optional)",
  "classId": "string (UUID, required)",
  "parentId": "string (UUID, optional)"
}
```

#### Update Student Request
```json
{
  "name": "string (optional)",
  "surname": "string (optional)",
  "dateOfBirth": "string (ISO date, optional)",
  "gender": "MALE|FEMALE|OTHER (optional)",
  "address": "string (optional)",
  "phone": "string (optional)",
  "email": "string (optional)",
  "enrollmentDate": "string (ISO date, optional)",
  "classId": "string (UUID, optional)",
  "parentId": "string (UUID, optional)"
}
```

#### Student Response
```json
{
  "id": "string",
  "name": "string",
  "surname": "string",
  "dateOfBirth": "string",
  "gender": "string",
  "address": "string",
  "phone": "string",
  "email": "string",
  "enrollmentDate": "string",
  "classId": "string",
  "parentId": "string",
  "schoolId": "string",
  "class": {
    "name": "string"
  },
  "parent": {
    "user": {
      "name": "string",
      "surname": "string"
    }
  }
}
```

### Teacher Management Schemas

#### Create Teacher Request
```json
{
  "user": {
    "email": "string (required)",
    "username": "string (required)",
    "name": "string (required)",
    "surname": "string (required)"
  },
  "specialization": "string (optional)",
  "qualification": "string (optional)",
  "experience": "number (optional)",
  "subjects": ["string"] (optional)"
}
```

#### Update Teacher Request
```json
{
  "specialization": "string (optional)",
  "qualification": "string (optional)",
  "experience": "number (optional)",
  "subjects": ["string"] (optional)"
}
```

#### Teacher Response
```json
{
  "id": "string",
  "userId": "string",
  "schoolId": "string",
  "specialization": "string",
  "qualification": "string",
  "experience": "number",
  "subjects": [
    {
      "id": "string",
      "name": "string"
    }
  ],
  "user": {
    "name": "string",
    "surname": "string",
    "email": "string"
  }
}
```

### Parent Management Schemas

#### Create Parent Request
```json
{
  "user": {
    "email": "string (required)",
    "username": "string (required)",
    "name": "string (required)",
    "surname": "string (required)"
  },
  "phone": "string (optional)",
  "occupation": "string (optional)",
  "relationship": "FATHER|MOTHER|GUARDIAN (optional)"
}
```

#### Update Parent Request
```json
{
  "phone": "string (optional)",
  "occupation": "string (optional)",
  "relationship": "FATHER|MOTHER|GUARDIAN (optional)"
}
```

#### Parent Response
```json
{
  "id": "string",
  "userId": "string",
  "phone": "string",
  "occupation": "string",
  "relationship": "string",
  "user": {
    "name": "string",
    "surname": "string",
    "email": "string"
  },
  "_count": {
    "children": "number"
  }
}
```

### Class Management Schemas

#### Create Class Request
```json
{
  "name": "string (required)",
  "gradeId": "string (UUID, required)",
  "schoolId": "string (UUID, required for SUPER_ADMIN)",
  "classTeacherId": "string (UUID, optional)",
  "capacity": "number (optional)",
  "roomId": "string (UUID, optional)"
}
```

#### Update Class Request
```json
{
  "name": "string (optional)",
  "gradeId": "string (UUID, optional)",
  "classTeacherId": "string (UUID, optional)",
  "capacity": "number (optional)",
  "roomId": "string (UUID, optional)"
}
```

#### Class Response
```json
{
  "id": "string",
  "name": "string",
  "gradeId": "string",
  "schoolId": "string",
  "classTeacherId": "string",
  "capacity": "number",
  "roomId": "string",
  "grade": {
    "name": "string"
  },
  "classTeacher": {
    "user": {
      "name": "string",
      "surname": "string"
    }
  },
  "_count": {
    "students": "number"
  }
}
```

### Event Management Schemas

#### Create Event Request
```json
{
  "title": "string (required)",
  "description": "string (optional)",
  "eventDate": "string (ISO datetime, required)",
  "endDate": "string (ISO datetime, optional)",
  "location": "string (optional)",
  "eventType": "ACADEMIC|SOCIAL|SPORTS|CULTURAL|OTHER (required)",
  "isPublic": "boolean (default: true)",
  "maxAttendees": "number (optional)",
  "schoolId": "string (UUID, required for SUPER_ADMIN)"
}
```

#### Update Event Request
```json
{
  "title": "string (optional)",
  "description": "string (optional)",
  "eventDate": "string (ISO datetime, optional)",
  "endDate": "string (ISO datetime, optional)",
  "location": "string (optional)",
  "eventType": "ACADEMIC|SOCIAL|SPORTS|CULTURAL|OTHER (optional)",
  "isPublic": "boolean (optional)",
  "maxAttendees": "number (optional)"
}
```

#### RSVP Request
```json
{
  "status": "ATTENDING|NOT_ATTENDING|MAYBE"
}
```

#### Event Response
```json
{
  "id": "string",
  "title": "string",
  "description": "string",
  "eventDate": "string",
  "endDate": "string",
  "location": "string",
  "eventType": "string",
  "isPublic": "boolean",
  "maxAttendees": "number",
  "schoolId": "string",
  "createdBy": "string",
  "_count": {
    "rsvps": "number"
  }
}
```

### Notification Management Schemas

#### Create Notification Request
```json
{
  "title": "string (required)",
  "content": "string (required)",
  "type": "GENERAL|ASSIGNMENT|EVENT|ANNOUNCEMENT|ALERT (required)",
  "priority": "LOW|MEDIUM|HIGH (default: MEDIUM)",
  "targetUsers": ["string"] (optional)",
  "targetRoles": ["SUPER_ADMIN|SCHOOL_ADMIN|PRINCIPAL|TEACHER|PARENT"] (optional)",
  "schoolId": "string (UUID, optional)"
}
```

#### Update Notification Preferences Request
```json
{
  "emailNotifications": "boolean (optional)",
  "pushNotifications": "boolean (optional)",
  "smsNotifications": "boolean (optional)",
  "notificationTypes": {
    "GENERAL": "boolean",
    "ASSIGNMENT": "boolean",
    "EVENT": "boolean",
    "ANNOUNCEMENT": "boolean",
    "ALERT": "boolean"
  }
}
```

#### Notification Response
```json
{
  "id": "string",
  "userId": "string",
  "title": "string",
  "content": "string",
  "type": "string",
  "priority": "string",
  "isRead": "boolean",
  "createdAt": "string",
  "metadata": "object"
}
```

### Material Management Schemas

#### Create Material Category Request
```json
{
  "name": "string (required)",
  "description": "string (optional)"
}
```

#### Create Material Request
```json
{
  "name": "string (required)",
  "description": "string (optional)",
  "price": "number (required)",
  "categoryId": "string (UUID, required)",
  "stockQuantity": "number (required)",
  "minStockLevel": "number (optional)",
  "supplier": "string (optional)"
}
```

#### Add to Cart Request
```json
{
  "materialId": "string (UUID, required)",
  "quantity": "number (required)"
}
```

#### Update Cart Item Request
```json
{
  "quantity": "number (required)"
}
```

#### Material Response
```json
{
  "id": "string",
  "name": "string",
  "description": "string",
  "price": "number",
  "categoryId": "string",
  "stockQuantity": "number",
  "minStockLevel": "number",
  "supplier": "string",
  "isActive": "boolean"
}
```

### Fee Management Schemas

#### Create Fee Structure Request
```json
{
  "name": "string (required)",
  "description": "string (optional)",
  "academicYear": "string (required)",
  "gradeId": "string (UUID, required)"
}
```

#### Add Fee Breakdown Item Request
```json
{
  "name": "string (required)",
  "description": "string (optional)",
  "amount": "number (required)",
  "frequency": "ONE_TIME|MONTHLY|QUARTERLY|ANNUALLY (required)",
  "isMandatory": "boolean (default: true)",
  "dueDate": "string (ISO date, optional)"
}
```

#### Set Student Override Request
```json
{
  "amount": "number (required)",
  "reason": "string (optional)"
}
```

#### Fee Breakdown Response
```json
{
  "id": "string",
  "feeStructureId": "string",
  "name": "string",
  "amount": "number",
  "frequency": "string",
  "isMandatory": "boolean",
  "dueDate": "string",
  "studentOverrides": [
    {
      "studentId": "string",
      "amount": "number",
      "reason": "string"
    }
  ]
}
```

This documentation covers detailed request/response schemas for the major API modules. For additional modules like exams, timetables, curriculum, analytics, and mobile endpoints, the patterns follow similar validation and response structures using Zod schemas. Refer to the source code in `src/controllers/` for complete implementation details.