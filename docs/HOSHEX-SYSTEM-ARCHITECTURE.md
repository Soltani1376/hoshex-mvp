# HOSHEX System Architecture

## Vision

HOSHEX is not a simple chatbot. It is a business diagnostic nervous system.

User -> Data -> Diagnosis -> Priority -> Today Action -> Feedback -> Learning

## System Model

```
                         HOSHEX CORE
                    AI Decision Engine
                              |
        -------------------------------------------
        |                                         |
   Business Intelligence                    Data Intelligence
        |                                         |
        -------------------------------------------
                              |
                         API Layer
                              |
        -------------------------------------------
        |                    |                    |
    Web App             Database             Admin Panel
        |                    |                    |
 Questionnaire       User History        Business Analytics
 Diagnosis UI         Events             Export / CRM

```

## Components

### Web App
Responsible for:
- User entry
- Business profile
- Diagnostic questions
- Showing diagnosis
- Showing Today Action

### AI Engine
Responsible for:
- Finding main business problem
- Selecting Priority 01
- Generating one actionable step
- Defining success metric

### Data Layer
Stores:
- Users
- Businesses
- Answers
- Diagnoses
- Actions
- Events
- Device information

### Analytics Layer
Tracks:
- Session start
- Profile submission
- Questions answered
- Diagnosis completion
- Action completion

### WordPress Admin Layer
Used as:
- CRM dashboard
- User management
- Reports
- Export tools

## Product Rule

HOSHEX always returns:

1. One main problem
2. One priority
3. One Today Action
4. One success metric

The system should avoid overwhelming users with many suggestions.

## Future Architecture

GitHub:
- Source code
- Documentation
- AI logic

Vercel:
- Application deployment
- API execution
- Production hosting

WordPress:
- Management dashboard
- Business CRM
