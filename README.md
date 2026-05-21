# MUBS Monitoring & Evaluation System

The **MUBS Monitoring & Evaluation System** is a web application built to streamline institutional planning, activity tracking, staff submissions/reviews, and performance reporting. It provides **role-based access** across Admin, Department Head (HOD), Staff, and Strategic Plan Ambassador workflows.

## Features

- **Role-Based Access Control (RBAC):** Tailored dashboards and workflows for Admin, Department Head (HOD), Staff, and Strategic Plan Ambassador.
- **User & Department Management:** Admin abilities to create accounts, manage roles, and map users to specific departments or faculties.
- **Authentication & Account Recovery:** Secure user onboarding, password setup, and self-service password recovery.
- **Strategic Planning Setup:** Create and manage standards/process templates and strategic plan activities aligned to institutional pillars.
- **Department Task Management:** Create departmental activities, assign process steps to staff, and optionally break down steps into sub-tasks.
- **Progress Tracking:** Monitor status and progress across strategic and departmental activities.
- **Submissions & Evidence:** Staff submit task reports with optional file attachments (evidence); HOD reviews and returns/accepts submissions with feedback.
- **Staff Warnings System:** Department Heads can monitor individual staff performance and issue formal warnings for non-compliance or missed deadlines.
- **Performance & Reporting:** Department and staff performance summaries with export to PDF (jsPDF) and Excel (XLSX).
- **Ambassador Oversight:** Strategic Plan Ambassadors have access to high-level faculty-wide reports to monitor performance across entire faculties or offices.
- **Notifications & Deadlines:** Staff notifications and upcoming deadline views to support timely submissions.

## Tech Stack

- **Framework:** [Next.js 16](https://nextjs.org/) (App Router)
- **Library:** React 19, TypeScript
- **Styling:** Bootstrap 5, React Bootstrap, and Tailwind CSS
- **Backend API:** Next.js Route Handlers
- **Database:** MySQL (interfaced via `mysql2`)
- **Authentication & Security:** JWT (`jsonwebtoken`) and password hashing (`bcryptjs`)
- **Utilities:** `axios` for HTTP requests, `jspdf` & `xlsx` for robust data export capabilities

## Project Structure

- `/app`: Contains all Next.js App Router pages, layouts, and API routes.
  - `/admin`: Consolidated administrative views and configuration.
  - `/department-head`: Department Head (HOD) views (activities, processes, staff/sections, submissions/reviews, reports).
  - `/staff`: Staff views (tasks, submissions, notifications/deadlines).
  - `/ambassador`: Strategic Plan Ambassador (faculty/office oversight) views.
  - `/strategic`: Convenience redirect to Admin strategic setup.
  - `/api`: Extensible backend RESTful endpoints.
- `/components`: Reusable UI elements and layout components.
- `/lib`: Utility functions, database connection logic, and helpers.
- `/public`: Static assets like images and global stylesheets.

## Getting Started

### Prerequisites

- Node.js (v18 or higher recommended)
- MySQL Server (e.g., via WAMP/XAMPP for local development)

### Installation

1. **Clone the repository:**
   ```bash
   git clone <your-repo-url>
   cd sps3
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Database Setup:**
   Ensure your MySQL server is running and create a database (e.g., `sps`).
   Configure your database credentials in the `.env.local` file:
   ```env
   DB_HOST=localhost
   DB_PORT=3306
   DB_USER=root
   DB_PASSWORD=your_db_password
   DB_NAME=sps
   JWT_SECRET=your_jwt_secret_key
   NEXT_PUBLIC_GOOGLE_CLIENT_ID=your_google_oauth_client_id
   ```

4. **Run the Development Server:**
   ```bash
   npm run dev
   ```
   Open [http://localhost:3000](http://localhost:3000) with your browser to see the outcome.

## Database scripts (optional)

The `scripts/` folder contains one-off migration and maintenance utilities. They read DB settings from `.env.local`.

Examples:

```bash
node scripts/migrate_phase_1.js
node scripts/migrate-process-subtasks.js
node scripts/migrate-process-container-allow-null-staff.js
node scripts/migrate-staff-reports-process-subtasks.js
```

If you run a script and it fails, confirm `.env.local` is present and points to the correct MySQL database.


