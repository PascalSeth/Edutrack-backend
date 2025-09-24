# Comparison: Edutrack-Dashboard vs Edutrack-backend-1

## Overview
This document compares the structure of the Edutrack-Dashboard (frontend, Next.js app) to the Edutrack-backend-1 (backend, Node.js/TypeScript) to identify missing files, folders, or functional components in the dashboard relative to the backend.

## Backend Modules (from Controllers)
The backend includes the following key modules based on controllers:
- Academic Calendar
- Analytics
- Assignments
- Attendance
- Auth
- Classes
- Curriculum
- Dashboard
- Events
- Exams
- Fee Breakdown
- Grades
- Materials
- Material Orders
- Notifications
- Parents
- Parent Subscriptions
- Principals
- Report Cards
- Rooms
- Schools
- School Payments
- Students
- Subjects
- Teachers
- Timetables
- Users
- Webhooks
- Mobile Endpoints: Academic Calendar, Academic Results, Announcements, Attendance Record, Child Profile, Fee Status, Home Screen, Onboarding, Time Table

## Dashboard Coverage
The dashboard (Edutrack-Dashboard) has API routes, pages, and components for most backend modules. Key covered areas:
- Analytics (class, engagement, school, student)
- Assignments
- Attendance
- Auth
- Classes
- Dashboard (role-based: parent, principal, school-admin, super-admin, teacher)
- Events
- Grades
- Multi-tenant features (parent children/schools, principal overview, teacher classes/students/subjects, student assignment)
- Notifications
- Parents
- Principals
- Schools
- Students
- Subjects
- Teachers
- Users

Pages exist for: analytics, attendance, classes, dashboard, events, grades, notifications, parents, principals, schools, settings, students, subjects, teachers, users.

UI components are available in `components/ui/` and specific dashboard components in `components/dashboard/`.

Mobile endpoints are handled separately, with routes in `src/routes/mobileEndpointRoutes/` (backend), and corresponding implementations.

## Updated Comparison: Current State

After re-checking the Edutrack-Dashboard structure, many modules have been implemented. The following is the updated status:

### Fully Implemented Modules
- Grades
- Materials (partial - missing cart routes)
- Material Orders
- Notifications
- Parents
- Parent Subscriptions
- Principals
- Report Cards
- Rooms
- Schools
- School Payments
- Students
- Subjects
- Teachers
- Timetables
- Users
- Webhooks

### Partially Implemented Modules
- Fee Breakdown: Only `app/api/schools/[schoolId]/fee-structures/route.ts` implemented. Missing:
  - `app/api/fee-structures/[feeStructureId]/route.ts`: GET, PUT
  - `app/api/fee-structures/[feeStructureId]/items/route.ts`: POST
  - `app/api/fee-breakdown-items/[itemId]/route.ts`: PUT, DELETE
  - `app/api/fee-breakdown-items/[itemId]/students/[studentId]/override/route.ts`: PUT
  - `app/api/students/[studentId]/fee-breakdown/route.ts`: GET

### Still Missing Modules
The following backend modules still lack corresponding API routes in the dashboard:

#### Academic Calendar
- `app/api/academic-calendar/terms/route.ts`: GET, POST
  - POST body: { name: string, startDate: string, endDate: string, schoolId: string, academicYearId: string }
- `app/api/academic-calendar/terms/[id]/route.ts`: GET, PUT, DELETE
  - PUT body: { name?: string, startDate?: string, endDate?: string, isActive?: boolean }
- `app/api/academic-calendar/holidays/route.ts`: GET, POST
  - POST body: { name: string, description?: string, startDate: string, endDate: string, holidayType: enum, isRecurring?: boolean, schoolId: string }
- `app/api/academic-calendar/holidays/[id]/route.ts`: PUT, DELETE
  - PUT body: { name?: string, description?: string, startDate?: string, endDate?: string, holidayType?: enum, isRecurring?: boolean }
- `app/api/academic-calendar/calendar-items/route.ts`: POST
  - POST body: { title: string, description?: string, startDate: string, endDate: string, itemType: enum, isAllDay?: boolean, academicCalendarId: string, termId?: string }
- `app/api/academic-calendar/calendar/[academicCalendarId]/items/route.ts`: GET
- `app/api/academic-calendar/calendar/route.ts`: GET

### Additional Missing Routes for Partially Implemented Modules

#### Materials (Missing Cart Routes)
- `app/api/parents/[parentId]/schools/[schoolId]/cart/route.ts`: GET, POST, DELETE
- `app/api/cart-items/[cartItemId]/route.ts`: PUT, DELETE

### Notes
- All major modules have been implemented with API routes and pages.
- Only Academic Calendar module is missing API routes.
- Mobile endpoints are not implemented in the dashboard.
- Multi-tenant routes are present and implemented.

## Folders and Files
- No major folders are missing; the dashboard has a standard Next.js structure (app/, components/, hooks/, lib/, public/, styles/).
- Functional components (UI or feature-specific) for the missing modules are absent.

## Recommendations
- Implement API routes, pages, and components for the missing modules to ensure full feature parity.
- Consider integrating mobile endpoint features into the main dashboard if applicable.
- Review multi-tenant routes to ensure they align with backend controllers.