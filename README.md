# Kāryon — Project Management & Collaboration Platform

Kāryon is a frontend-only project management and collaboration web application designed to help teams organize projects, manage tasks, track progress, coordinate team members, and monitor project activities from a centralized dashboard.

The project is developed as part of the Web Fundamentals Project using HTML, CSS, and JavaScript.

---

## Project Description

Managing a project involves multiple activities such as creating tasks, assigning responsibilities, tracking deadlines, monitoring progress, coordinating team members, and maintaining project updates.

Kāryon provides a single web-based workspace where users can manage these activities through an interactive dashboard.

The application is completely frontend-based and uses JavaScript for application logic and browser Local Storage for persistent data storage.

---

## Problem Statement

Project information is often scattered across different tools such as spreadsheets, task lists, chat applications, and separate documentation.

This can make it difficult to:

- Track project progress
- Manage tasks and deadlines
- Assign responsibilities
- Monitor team activity
- Organize project information
- Keep track of updates and notifications

Kāryon aims to provide a centralized interface for managing these activities.

---

## Goals

The main goals of Kāryon are:

1. Provide a centralized project management interface.
2. Allow users to create and manage projects.
3. Allow users to create, view, update, and delete tasks.
4. Assign tasks to team members.
5. Track task status and priorities.
6. Organize tasks into sprints.
7. Provide project activity and notification information.
8. Store application data using browser Local Storage.
9. Provide a responsive interface for different screen sizes.
10. Demonstrate HTML, CSS, and JavaScript concepts covered in Web Fundamentals.

---

## Key Features

### 1. Landing Page

The landing page introduces the Kāryon platform and explains its main features.

It includes:

- Project management overview
- Task management
- Team collaboration
- Sprint management
- Workflow information
- Login and registration options

---

### 2. User Authentication

Users can:

- Create an account
- Log in
- Log out
- Maintain a browser session

User information and session information are stored using Local Storage.

---

### 3. Project Management

Users can manage project information including:

- Project name
- Description
- Start date
- Deadline
- Project owner
- Team members
- Project visibility

---

### 4. Task Management

Tasks contain information such as:

- Task title
- Description
- Category
- Assignee
- Priority
- Deadline
- Status

Tasks can be managed throughout their lifecycle.

Example workflow:

`To Do → In Progress → Code Review → Testing → Completed`

---

### 5. CRUD Operations

Kāryon demonstrates CRUD operations.

| Operation | Description |
|-----------|-------------|
| Create | Add new projects, tasks and other records |
| Read | Display stored project and task information |
| Update | Modify existing records |
| Delete | Remove records |

---

### 6. Sprint Management

Projects can be organized into development sprints.

Each sprint can contain:

- Sprint name
- Start date
- End date
- Associated tasks

---

### 7. Team Management

Team members can be associated with projects and tasks.

Different roles can be represented, such as:

- Project Manager
- Developer
- QA

---

### 8. Comments and Collaboration

Users can maintain comments associated with tasks to support project communication and collaboration.

---

### 9. Notifications

The application maintains notifications related to project activities such as:

- Task assignments
- Comments
- Status changes
- Mentions
- Deadlines

---

### 10. Activity Tracking

The dashboard provides an activity log showing recent project actions.

This helps users understand what has recently changed in the project.

---

### 11. Dashboard

The dashboard provides an overview of project information including:

- Overall project progress
- Task status
- Upcoming deadlines
- Team information
- Recent activity
- Sprint information
- Project statistics

---

## Technology Stack

The project follows the required Web Fundamentals technology stack.

### Frontend

- HTML5
- CSS3
- JavaScript (ES6+)

### Data Storage

- Browser Local Storage

### Development Tools

- Visual Studio Code
- Git
- GitHub

---

## Data Storage

Kāryon is a frontend-only application and does not use a backend server or external database.

The application uses browser `localStorage` to store application data.

Examples of stored data include:

- Users
- Current session
- Organizations
- Projects
- Tasks
- Sprints
- Comments
- Notifications
- Files
- Activity records

Data is stored as JavaScript objects/JSON in the browser.

---

## Project Structure

```text
karyon/
│
├── index.html
├── dashboard.html
│
├── css/
│   ├── style.css
│   └── dashboard.css
│
├── js/
│   ├── app.js
│   ├── auth.js
│   ├── landing.js
│   └── storage.js
│
├── public/
│   ├── Favicon.png
│   ├── Logo.png
│   ├── Logo2.png
│   ├── Logo3.png
│   ├── Logo4.png
│   ├── Logo7.png
│   ├── logo5.png
│   └── logo6.png
│
├── .gitignore
├── LICENSE
└── README.md