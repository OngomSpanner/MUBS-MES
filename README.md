# Strategic Planning System (SPS)

The Strategic Planning System (SPS) is a comprehensive web application built to streamline institutional planning, activity tracking, committee proposals, and performance reporting. Designed for educational or organizational institutions, it provides role-based access for streamlined governance, from the Principal level to individual staff members.

## Features

- **Role-Based Access Control (RBAC):** Tailored dashboards and functionalities for Super Admins, Managers, Unit Heads, Staff, Committee Members, and Viewers.
- **Strategic Planning:** Define and manage strategic activities aligned with institutional pillars (Teaching & Learning, Research & Innovation, Governance, Infrastructure, Partnerships).
- **Committee Management:** Submit, review, and track committee proposals including budget allocations and workflows.
- **Activity Tracking:** Monitor progress on various tasks and activities with status updates, timelines, and detailed notes.
- **Comprehensive Reporting:** Generate dynamic reports, trends analysis, and export data seamlessly using built-in PDF (jsPDF) and Excel (XLSX) generation tools.
- **Notifications System:** In-app notifications to keep users informed about important updates, proposal statuses, and system alerts.
- **Advanced Task Management:** Bulk delete functionality, recurring task intervals, and intuitive modal interfaces for efficient activity handling.

## Tech Stack

- **Framework:** [Next.js 16](https://nextjs.org/) (App Router)
- **Library:** React 19, TypeScript
- **Styling:** Bootstrap 5, React Bootstrap, and Tailwind CSS 4
- **Backend API:** Next.js Route Handlers
- **Database:** MySQL (interfaced via `mysql2`)
- **Authentication & Security:** JWT (`jsonwebtoken`) and password hashing (`bcryptjs`)
- **Utilities:** `axios` for HTTP requests, `jspdf` & `xlsx` for robust data export capabilities

## Project Structure

- `/app`: Contains all Next.js App Router pages, layouts, and API routes.
  - `/admin`: Consolidated administrative views and configuration.
  - `/principal`, `/unit-head`, `/staff`: Context-aware, role-specific dashboards.
  - `/strategic`, `/committee`, `/tracking`, `/reports`, `/users`: Dedicated modules for core functionalities.
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
   git clone https://github.com/OngomSpanner/MUBS-Strategy-Plan-System.git
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
   DB_USER=root
   DB_PASSWORD=
   DB_NAME=sps
   JWT_SECRET=your_jwt_secret_key
   ```
   Run the provided seed/migration scripts to initialize the database schema and default roles. For example:
   ```bash
   node migrate-user-roles.js
   node seed-multi-roles.js
   ```

4. **Run the Development Server:**
   ```bash
   npm run dev
   ```
   Open [http://localhost:3000](http://localhost:3000) with your browser to see the outcome.

## Scripts & Maintenance

The root directory contains several utility scripts for database migrations, schema inspection, and testing:
- **Migration & Schema Setup:** `migrate-committee.js`, `migrate-hr.js`, `migrate-strategic.js`, `migrate-tracking.js`, `migrate-user-roles.js`
- **Data Seeding:** `seed-committee.js`, `seed-hr.js`, `seed-multi-roles.js`, `seed-reports-trends.js`
- **Database Tools:** `dump-schema.js`, `inspect-schema.js`, `check-db.mjs`

Run these scripts using Node.js as needed during ongoing development and deployment setup.

## License

This project is licensed under the MIT License.
