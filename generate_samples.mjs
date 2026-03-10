import mysql from 'mysql2/promise';

async function generateSampleData() {
  const connection = await mysql.createConnection({
    host: 'localhost',
    user: 'root',
    password: '',
    database: 'mubs_super_admin',
    multipleStatements: true
  });

  try {
    const sql = `
      SET FOREIGN_KEY_CHECKS = 0;

      -- 1. Departments
      TRUNCATE TABLE departments;
      INSERT INTO departments (id, name, code, unit_type, is_active, description) VALUES
      (1, 'Faculty of Computing', 'FCIT', 'faculty', 1, 'Main computing faculty focusing on software engineering and IT.'),
      (2, 'Department of Computer Science', 'CS', 'department', 1, 'Core computer science department under FCIT.'),
      (3, 'Office of the Principal', 'OP', 'office', 1, 'Main administrative office managing strategic direction.');
      
      -- Update departments with Parent and HOD IDs
      UPDATE departments SET parent_id = 1 WHERE id = 2;

      -- 2. Users (Passwords: hash of 'password123' if they use bcrypt, but we'll put a dummy hash for now)
      TRUNCATE TABLE users;
      INSERT INTO users (id, employee_id, full_name, email, password_hash, role, department_id, status, employment_status, leave_status) VALUES
      (1, 'EMP001', 'Prof. John Smith', 'principal@mubs.ac.ug', '$2b$10$dummyHashpassword123', 'strategy_manager', 3, 'Active', 'active', 'On Duty'),
      (2, 'EMP002', 'Dr. Sarah Connor', 'sconnor@mubs.ac.ug', '$2b$10$dummyHashpassword123', 'hod', 1, 'Active', 'active', 'On Duty'),
      (3, 'EMP003', 'Alex Developer', 'alex@mubs.ac.ug', '$2b$10$dummyHashpassword123', 'staff', 2, 'Active', 'active', 'On Duty');

      -- Update HOD IDs in Departments
      UPDATE departments SET hod_id = 1 WHERE id = 3;
      UPDATE departments SET hod_id = 2 WHERE id = 1;

      -- 3. Strategic Activities
      TRUNCATE TABLE strategic_activities;
      INSERT INTO strategic_activities (id, activity_type, source, title, pillar, department_id, target_kpi, priority, status, progress, created_by) VALUES
      (1, 'main', 'strategic_plan', 'Upgrade e-Learning Infrastructure', 'Infrastructure', 1, '100% cloud migration', 'High', 'in_progress', 45, 1),
      (2, 'detailed', 'strategic_plan', 'Procure 500 new lab computers', 'Infrastructure', 2, '500 computers', 'High', 'in_progress', 60, 2),
      (3, 'main', 'academic_board', 'Launch new AI Curriculum', 'Teaching & Learning', 1, 'Curriculum approved by Senate', 'Medium', 'pending', 0, 1);
      
      -- Set Main Activity Link
      UPDATE strategic_activities SET main_activity_id = 1, parent_id = 1 WHERE id = 2;

      -- 4. Activity Assignments
      TRUNCATE TABLE activity_assignments;
      INSERT INTO activity_assignments (id, activity_id, assigned_to_user_id, assigned_by, start_date, end_date, weight_percentage, status) VALUES
      (1, 2, 3, 2, '2026-01-10', '2026-06-30', 100.00, 'in_progress'),
      (2, 3, 2, 1, '2026-04-01', '2026-12-31', 50.00, 'pending'),
      (3, 1, 2, 1, '2026-01-01', '2026-12-31', 80.00, 'accepted');

      -- 5. Staff Reports
      TRUNCATE TABLE staff_reports;
      INSERT INTO staff_reports (id, activity_assignment_id, submitted_by, report_period_start, report_period_end, progress_percentage, achievements, challenges, next_steps, status) VALUES
      (1, 1, 3, '2026-01-01', '2026-03-01', 60.00, 'Tender documents fully drafted and approved.', 'Delays in procurement board sign-off.', 'Publish tender next week.', 'evaluated'),
      (2, 3, 2, '2026-01-01', '2026-03-01', 45.00, 'Server architecture planned.', 'Budget constraints.', 'Request additional funding.', 'submitted'),
      (3, 2, 2, '2026-01-01', '2026-03-01', 0.00, '', '', '', 'draft');

      -- 6. Evaluations
      TRUNCATE TABLE evaluations;
      INSERT INTO evaluations (id, staff_report_id, evaluated_by, metrics_achieved, metrics_target, qualitative_feedback, strengths, rating) VALUES
      (1, 1, 2, 300, 500, 'Good progress on documentation, but procurement needs to speed up.', 'Thorough documentation.', 'good'),
      (2, 2, 1, 45, 100, 'Solid initial planning phase.', 'Clear architectural design.', 'satisfactory'),
      (3, 3, 1, 0, 100, 'Awaiting draft completion.', '', 'needs_improvement');

      -- 7. Committee Proposals
      TRUNCATE TABLE committee_proposals;
      INSERT INTO committee_proposals (id, committee_type, title, department_id, submitted_by, budget, pillar_id, status, implementation_status) VALUES
      (1, 'TMC', 'Proposal for New Research Grant', 1, 2, 150000.00, NULL, 'Pending', 'Pending'),
      (2, 'Academic Board', 'Curriculum Revision Computing', 2, 3, 5000.00, NULL, 'Approved', 'in_progress'),
      (3, 'Council', 'Campus Solar Power Extension', 3, 1, 500000.00, NULL, 'Edit Requested', 'Pending');

      -- 8. Activity Tracking
      TRUNCATE TABLE activity_tracking;
      INSERT INTO activity_tracking (id, activity_id, activity_type, progress, status, notes, updated_by) VALUES
      (1, 1, 'strategic', 20, 'in_progress', 'Initial kickoff meeting completed.', 1),
      (2, 1, 'strategic', 45, 'in_progress', 'Phase 1 documentation signed.', 2),
      (3, 2, 'committee', 100, 'Approved', 'Board voted unanimously to approve.', 1);

      -- 9. Notifications
      TRUNCATE TABLE notifications;
      INSERT INTO notifications (id, user_id, title, message, type, is_read) VALUES
      (1, 3, 'New Assignment', 'You have been assigned to Procure 500 new lab computers.', 'info', 0),
      (2, 2, 'Report Evaluated', 'Your report for Q1 has been evaluated by the Principal.', 'success', 1),
      (3, 1, 'Budget Alert', 'Campus Solar Power Extension requires edits from Council.', 'warning', 0);

      -- 10. System Logs
      TRUNCATE TABLE system_logs;
      INSERT INTO system_logs (id, user_id, action, entity_type, entity_id) VALUES
      (1, 1, 'User Login', 'Auth', 1),
      (2, 2, 'Created Proposal', 'CommitteeProposals', 1),
      (3, 3, 'Submitted Report', 'StaffReports', 1);

      SET FOREIGN_KEY_CHECKS = 1;
    `;
    
    await connection.query(sql);
    console.log("Successfully generated sample inputs for all 10 tables.");
  } catch (error) {
    console.error("Error inserting sample data:", error);
  } finally {
    await connection.end();
  }
}

generateSampleData();
