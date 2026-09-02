# HOSHEX Database Layer v1

## Purpose
Create persistent storage for users, businesses, diagnoses and behavior events.

## Tables

### users
- id
- name
- email
- phone
- created_at

### businesses
- id
- user_id
- business_name
- category
- platform
- goal
- created_at

### answers
- id
- business_id
- question_key
- answer_value
- created_at

### diagnoses
- id
- business_id
- main_problem
- priority_01
- today_action
- success_metric
- confidence
- created_at

### events
- id
- user_id
- event_name
- device
- browser
- os
- metadata
- created_at

## Flow

App V2 -> API -> Database -> AI Diagnosis -> Dashboard
