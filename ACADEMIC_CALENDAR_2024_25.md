# Academic Calendar 2024/25

## Overview
This document outlines the academic calendar for the 2024/25 academic year, structured by terms with key activities, milestones, holidays, exams, and educational events.

## Academic Year Structure
- **Academic Year**: 2024/25
- **Start Date**: September 2, 2024
- **End Date**: July 31, 2025
- **Total Terms**: 3

## Academic Periods Structure

The academic year is divided into three main teaching periods. Schools can label these as "Terms", "Semesters", or custom names based on their preference. The system supports flexible naming.

### Period 1: First Teaching Period
- **Name**: Term 1 / Semester 1 (configurable)
- **Start Date**: September 2, 2024
- **End Date**: December 20, 2024
- **Duration**: 15 weeks
- **Key Activities**:
  - Orientation and welcome activities
  - Curriculum introduction
  - Mid-term assessments (November 4-8, 2024)

### Period 2: Second Teaching Period
- **Name**: Term 2 / Semester 2 (configurable)
- **Start Date**: January 6, 2025
- **End Date**: April 11, 2025
- **Duration**: 14 weeks
- **Key Activities**:
  - Continued curriculum delivery
  - Mid-term assessments (February 24-28, 2025)

### Period 3: Third Teaching Period
- **Name**: Term 3 / Semester 3 (configurable)
- **Start Date**: April 21, 2025
- **End Date**: July 25, 2025
- **Duration**: 14 weeks
- **Key Activities**:
  - Final curriculum modules
  - Revision and preparation for exams
  - Graduation activities

## Holidays and Breaks

### Christmas Break
- **Start Date**: December 21, 2024
- **End Date**: January 5, 2025
- **Type**: School-specific holiday
- **Duration**: 16 days

### Spring Break
- **Start Date**: February 17, 2025
- **End Date**: February 21, 2025
- **Type**: School-specific holiday
- **Duration**: 5 days

### Easter Break
- **Start Date**: April 14, 2025
- **End Date**: April 20, 2025
- **Type**: Religious holiday
- **Duration**: 7 days

### Public Holidays
- **New Year's Day**: January 1, 2025
- **Good Friday**: April 18, 2025
- **Easter Monday**: April 21, 2025
- **May Day**: May 5, 2025
- **Ascension Day**: May 29, 2025
- **Whit Monday**: June 9, 2025

## Exam Periods

### End of Term 1 Exams
- **Start Date**: December 16, 2024
- **End Date**: December 20, 2024
- **Type**: Final examinations
- **Subjects**: All core subjects

### End of Term 2 Exams
- **Start Date**: April 7, 2025
- **End Date**: April 11, 2025
- **Type**: Final examinations
- **Subjects**: All core subjects

### End of Term 3 Exams
- **Start Date**: July 21, 2025
- **End Date**: July 25, 2025
- **Type**: Final examinations
- **Subjects**: All subjects

## Educational Events and Activities

### Parent-Teacher Meetings
- **Term 1**: October 25, 2024
- **Term 2**: March 14, 2025
- **Term 3**: June 20, 2025

### Sports Days
- **Term 1**: November 15, 2024
- **Term 2**: May 10, 2025

### Cultural Events
- **Term 1**: December 6, 2024 (Christmas Celebration)
- **Term 2**: March 21, 2025 (Cultural Diversity Day)

### Open Days
- **Term 1**: September 28, 2024
- **Term 2**: February 7, 2025

### Science Fair
- **Date**: May 17, 2025
- **Term**: 3

### Graduation Ceremony
- **Date**: July 26, 2025
- **Term**: 3

## Important Milestones

### Report Card Deadlines
- **Term 1**: December 23, 2024
- **Term 2**: April 14, 2025
- **Term 3**: July 28, 2025

### Registration Deadlines
- **New Student Registration**: August 30, 2024
- **Course Registration**: August 25, 2024

### Assessment Deadlines
- **Continuous Assessment**: Ongoing throughout terms
- **Project Submissions**: End of each term

## Data Structure Implementation

The academic calendar is implemented using the following database models:

- **AcademicYear**: Defines the overall year
- **Term**: Subdivides the year into teaching periods (terms/semesters)
- **Holiday**: Defines breaks and non-teaching days
- **CalendarItem**: Specific events, exams, and milestones (now linked to terms)

### Key Relationships

- **CalendarItem** ↔ **Term**: Calendar items can be linked to specific terms/semesters for better organization
- **Term** belongs to **AcademicYear**
- **AcademicCalendar** contains **CalendarItem**s

## API Endpoints

Existing endpoints for managing the calendar:

- `GET /api/academic-calendar/terms` - Retrieve terms
- `POST /api/academic-calendar/terms` - Create term
- `GET /api/academic-calendar/holidays` - Retrieve holidays
- `POST /api/academic-calendar/holidays` - Create holiday
- `POST /api/academic-calendar/calendar-items` - Create calendar item (now supports termId)
- `GET /api/academic-calendar/calendar/:academicCalendarId/items` - Get calendar items (includes term info)
- `GET /api/academic-calendar/calendar` - Get full calendar view (includes calendar items)

## Population Strategy

To populate the calendar for 2024/25:

1. Create AcademicYear record
2. Create Term records for each term
3. Create Holiday records for breaks and public holidays
4. Create CalendarItem records for exams, events, and milestones
5. Use bulk operations where possible for efficiency

## Enhancements Needed

- Bulk create endpoints for calendar items
- Calendar export functionality (PDF/ICS)
- Recurring event support
- Calendar sharing and subscription features