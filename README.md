# EduTrack Backend - Comprehensive Educational Management Platform

EduTrack is a comprehensive educational management platform designed to connect schools, teachers, parents, and administrators through a unified digital ecosystem that goes beyond basic communication to create meaningful partnerships in student success.

## 🌟 Features

### Core Functionality
- **Multi-tenant Architecture**: Secure data isolation for multiple schools
- **Role-based Access Control**: SUPER_ADMIN, SCHOOL_ADMIN, PRINCIPAL, TEACHER, PARENT
- **Real-time Communication**: Messaging, notifications, and updates
- **File Management**: Secure file upload and storage with Supabase
- **Payment Processing**: Integrated payment system with transaction fees

### Academic Management
- **Assignment Management**: Create, distribute, and track assignments
- **Attendance Tracking**: Real-time attendance recording and analytics
- **Grade Management**: Comprehensive grading and result tracking
- **Subject Management**: Organize subjects and teacher assignments
- **Class Management**: Manage classes, students, and schedules

### Parent Engagement
- **Student Progress Tracking**: Real-time academic performance monitoring
- **Communication Tools**: Direct messaging with teachers and school staff
- **Event Management**: School events, RSVPs, and participation tracking
- **Payment Integration**: Easy fee payment and transaction history
- **Notification System**: Push notifications for important updates

### Analytics & Insights
- **School Analytics**: Comprehensive school performance metrics
- **Student Analytics**: Individual student progress and insights
- **Class Analytics**: Class-wide performance and attendance data
- **Parent Engagement Analytics**: Track parent involvement and communication

### Enhanced Features
- **Event Management**: Create and manage school events with RSVP functionality
- **Notification System**: Advanced notification management with preferences
- **File Upload**: Secure file handling for assignments, documents, and media
- **Multi-language Support**: Ready for internationalization
- **Audit Logging**: Comprehensive activity logging

## 🏗️ Technical Architecture

### Backend Stack
- **Runtime**: Node.js with Express.js
- **Database**: PostgreSQL with Prisma ORM
- **Authentication**: JWT with refresh tokens
- **File Storage**: Supabase Storage
- **Logging**: Winston for structured logging
- **Validation**: Zod for input validation
- **Security**: bcrypt for password hashing, role-based access control

### Database Schema
- **Users & Roles**: Comprehensive user management with role-based access
- **Schools**: Multi-tenant school management with verification
- **Academic Structure**: Grades, classes, subjects, and lessons
- **Assignments & Exams**: Full academic workflow management
- **Communication**: Messages, notifications, and events
- **Financial**: Payment processing and fee management
- **Analytics**: Performance tracking and insights

## 🚀 Getting Started

### Prerequisites
- Node.js (v18 or higher)
- PostgreSQL database
- Supabase account for file storage
- Environment variables configured

### Installation

1. **Clone
