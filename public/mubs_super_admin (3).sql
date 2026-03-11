-- phpMyAdmin SQL Dump
-- version 5.2.1
-- https://www.phpmyadmin.net/
--
-- Host: 127.0.0.1:3306
-- Generation Time: Mar 10, 2026 at 02:59 PM
-- Server version: 9.1.0
-- PHP Version: 8.3.14

SET SQL_MODE = "NO_AUTO_VALUE_ON_ZERO";
START TRANSACTION;
SET time_zone = "+00:00";


/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!40101 SET NAMES utf8mb4 */;

--
-- Database: `mubs_super_admin`
--

-- --------------------------------------------------------

--
-- Table structure for table `activity_assignments`
--

DROP TABLE IF EXISTS `activity_assignments`;
CREATE TABLE IF NOT EXISTS `activity_assignments` (
  `id` int NOT NULL AUTO_INCREMENT,
  `activity_id` int NOT NULL,
  `assigned_to_user_id` int NOT NULL,
  `assigned_by` int NOT NULL,
  `assigned_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `start_date` date DEFAULT NULL,
  `end_date` date DEFAULT NULL,
  `weight_percentage` decimal(5,2) DEFAULT '100.00',
  `status` enum('pending','accepted','in_progress','submitted','completed','overdue') DEFAULT 'pending',
  `is_flagged` tinyint(1) DEFAULT '0',
  `flag_reason` text,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `activity_id` (`activity_id`),
  KEY `assigned_by` (`assigned_by`),
  KEY `idx_assigned_to` (`assigned_to_user_id`),
  KEY `idx_status` (`status`),
  KEY `idx_flagged` (`is_flagged`)
) ENGINE=MyISAM AUTO_INCREMENT=4 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

--
-- Dumping data for table `activity_assignments`
--

INSERT INTO `activity_assignments` (`id`, `activity_id`, `assigned_to_user_id`, `assigned_by`, `assigned_at`, `start_date`, `end_date`, `weight_percentage`, `status`, `is_flagged`, `flag_reason`, `created_at`) VALUES
(1, 2, 3, 2, '2026-03-09 13:35:59', '2026-01-10', '2026-06-30', 100.00, 'in_progress', 0, NULL, '2026-03-09 13:35:59'),
(2, 3, 2, 1, '2026-03-09 13:35:59', '2026-04-01', '2026-12-31', 50.00, 'pending', 0, NULL, '2026-03-09 13:35:59'),
(3, 1, 2, 1, '2026-03-09 13:35:59', '2026-01-01', '2026-12-31', 80.00, 'accepted', 0, NULL, '2026-03-09 13:35:59');

-- --------------------------------------------------------

--
-- Table structure for table `activity_tracking`
--

DROP TABLE IF EXISTS `activity_tracking`;
CREATE TABLE IF NOT EXISTS `activity_tracking` (
  `id` int NOT NULL AUTO_INCREMENT,
  `activity_id` int DEFAULT NULL,
  `activity_type` enum('strategic','committee') NOT NULL,
  `progress` int DEFAULT '0',
  `status` varchar(50) DEFAULT NULL,
  `notes` text,
  `updated_by` int DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `updated_by` (`updated_by`)
) ENGINE=MyISAM AUTO_INCREMENT=4 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

--
-- Dumping data for table `activity_tracking`
--

INSERT INTO `activity_tracking` (`id`, `activity_id`, `activity_type`, `progress`, `status`, `notes`, `updated_by`, `updated_at`) VALUES
(1, 1, 'strategic', 20, 'in_progress', 'Initial kickoff meeting completed.', 1, '2026-03-09 13:35:59'),
(2, 1, 'strategic', 45, 'in_progress', 'Phase 1 documentation signed.', 2, '2026-03-09 13:35:59'),
(3, 2, 'committee', 100, 'Approved', 'Board voted unanimously to approve.', 1, '2026-03-09 13:35:59');

-- --------------------------------------------------------

--
-- Table structure for table `committee_proposals`
--

DROP TABLE IF EXISTS `committee_proposals`;
CREATE TABLE IF NOT EXISTS `committee_proposals` (
  `id` int NOT NULL AUTO_INCREMENT,
  `committee_type` enum('Council','TMC','Academic Board','Other') DEFAULT 'Other',
  `title` varchar(200) NOT NULL,
  `minute_reference` varchar(100) DEFAULT NULL,
  `description` text,
  `submitted_by` int DEFAULT NULL,
  `department_id` int DEFAULT NULL,
  `budget` decimal(15,2) DEFAULT NULL,
  `pillar_id` int DEFAULT NULL,
  `status` enum('Pending','Approved','Rejected','Edit Requested') DEFAULT 'Pending',
  `implementation_status` varchar(50) DEFAULT 'Pending',
  `submitted_date` date DEFAULT NULL,
  `reviewed_date` date DEFAULT NULL,
  `reviewer_notes` text,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `submitted_by` (`submitted_by`),
  KEY `unit_id` (`department_id`)
) ENGINE=MyISAM AUTO_INCREMENT=4 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

--
-- Dumping data for table `committee_proposals`
--

INSERT INTO `committee_proposals` (`id`, `committee_type`, `title`, `minute_reference`, `description`, `submitted_by`, `department_id`, `budget`, `pillar_id`, `status`, `implementation_status`, `submitted_date`, `reviewed_date`, `reviewer_notes`, `created_at`) VALUES
(1, 'TMC', 'Proposal for New Research Grant', NULL, NULL, 2, 1, 150000.00, NULL, 'Pending', 'Pending', NULL, NULL, NULL, '2026-03-09 13:35:59'),
(2, 'Academic Board', 'Curriculum Revision Computing', NULL, NULL, 3, 2, 5000.00, NULL, 'Approved', 'in_progress', NULL, NULL, NULL, '2026-03-09 13:35:59'),
(3, 'Council', 'Campus Solar Power Extension', NULL, NULL, 1, 3, 500000.00, NULL, 'Edit Requested', 'Pending', NULL, NULL, NULL, '2026-03-09 13:35:59');

-- --------------------------------------------------------

--
-- Table structure for table `departments`
--

DROP TABLE IF EXISTS `departments`;
CREATE TABLE IF NOT EXISTS `departments` (
  `id` int NOT NULL AUTO_INCREMENT,
  `name` varchar(100) NOT NULL,
  `code` varchar(20) NOT NULL,
  `unit_type` enum('faculty','office','department','unit') DEFAULT 'department',
  `parent_id` int DEFAULT NULL,
  `hod_id` int DEFAULT NULL,
  `is_active` tinyint(1) DEFAULT '1',
  `description` text,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `code` (`code`),
  KEY `parent_id` (`parent_id`),
  KEY `hod_id` (`hod_id`)
) ENGINE=MyISAM AUTO_INCREMENT=23 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

--
-- Dumping data for table `departments`
--

INSERT INTO `departments` (`id`, `name`, `code`, `unit_type`, `parent_id`, `hod_id`, `is_active`, `description`, `created_at`) VALUES
(1, 'Faculty of Commerce', 'FCOM', 'faculty', NULL, NULL, 1, 'Faculty of Commerce and its departments.', '2026-03-10 14:33:54'),
(2, 'Faculty of Business Administration', 'FBADM', 'faculty', NULL, NULL, 1, 'Faculty of Business Administration.', '2026-03-10 14:33:54'),
(3, 'Faculty of Management', 'FMGT', 'faculty', NULL, NULL, 1, 'Faculty of Management.', '2026-03-10 14:33:54'),
(4, 'Office of Principal', 'OPRIN', 'office', NULL, NULL, 1, 'Office of the Principal and its units.', '2026-03-10 14:33:54'),
(5, 'Dean of Students', 'DOSTU', 'office', NULL, NULL, 1, 'Dean of Students office.', '2026-03-10 14:33:54'),
(6, 'Entrepreneurship & Incubation Centre', 'EIC', 'office', NULL, NULL, 1, 'Entrepreneurship & Incubation Centre.', '2026-03-10 14:33:54'),
(7, 'Department of Accounting', 'ACC', 'department', 1, NULL, 1, 'Department of Accounting under Faculty of Commerce.', '2026-03-10 14:33:54'),
(8, 'Department of Finance', 'FIN', 'department', 1, NULL, 1, 'Department of Finance under Faculty of Commerce.', '2026-03-10 14:33:54'),
(9, 'Department of Banking & Investment', 'BANK', 'department', 1, NULL, 1, 'Department of Banking & Investment under Faculty of Commerce.', '2026-03-10 14:33:54'),
(10, 'Department of Business Law', 'LAW', 'department', 1, NULL, 1, 'Department of Business Law under Faculty of Commerce.', '2026-03-10 14:33:54'),
(11, 'Department of Business Administration', 'BADM', 'department', 2, NULL, 1, 'Department of Business Administration.', '2026-03-10 14:33:54'),
(12, 'Department of Communications / Business Communication', 'COMM', 'department', 2, NULL, 1, 'Department of Communications / Business Communication.', '2026-03-10 14:33:54'),
(13, 'Department of Human Resource Management', 'HRM', 'department', 3, NULL, 1, 'Department of Human Resource Management.', '2026-03-10 14:33:54'),
(14, 'Department of Leadership & Governance', 'LEAD', 'department', 3, NULL, 1, 'Department of Leadership & Governance.', '2026-03-10 14:33:54'),
(15, 'Department of Business Psychology', 'BPSY', 'department', 3, NULL, 1, 'Department of Business Psychology.', '2026-03-10 14:33:54'),
(16, 'eLearning Centre', 'ELC', 'unit', 4, NULL, 1, 'eLearning Centre under Office of Principal.', '2026-03-10 14:33:54'),
(17, 'Disability Resource & Learning Centre', 'DRLC', 'unit', 4, NULL, 1, 'Disability Resource & Learning Centre.', '2026-03-10 14:33:54'),
(18, 'Management Information System Unit', 'MIS', 'unit', 4, NULL, 1, 'Management Information System Unit.', '2026-03-10 14:33:54'),
(19, 'ICT Centre', 'ICT', 'unit', 4, NULL, 1, 'ICT Centre.', '2026-03-10 14:33:54'),
(20, 'Hostel & Accommodation', 'HOST', 'unit', 5, NULL, 1, 'Hostel & Accommodation.', '2026-03-10 14:33:54'),
(21, 'Guidance and Counselling', 'GNC', 'unit', 5, NULL, 1, 'Guidance and Counselling.', '2026-03-10 14:33:54'),
(22, 'Entrepreneurship', 'ENT', 'unit', 6, NULL, 1, 'Entrepreneurship unit.', '2026-03-10 14:33:54');

-- --------------------------------------------------------

--
-- Table structure for table `evaluations`
--

DROP TABLE IF EXISTS `evaluations`;
CREATE TABLE IF NOT EXISTS `evaluations` (
  `id` int NOT NULL AUTO_INCREMENT,
  `staff_report_id` int NOT NULL,
  `evaluated_by` int NOT NULL,
  `evaluation_date` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `metrics_achieved` decimal(10,2) DEFAULT NULL,
  `metrics_target` decimal(10,2) DEFAULT NULL,
  `score` decimal(5,2) GENERATED ALWAYS AS ((case when (`metrics_target` > 0) then ((`metrics_achieved` / `metrics_target`) * 100) else NULL end)) STORED,
  `qualitative_feedback` text,
  `strengths` text,
  `areas_for_improvement` text,
  `rating` enum('excellent','good','satisfactory','needs_improvement','poor') DEFAULT NULL,
  `contributes_to_appraisal` tinyint(1) DEFAULT '1',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `staff_report_id` (`staff_report_id`),
  KEY `evaluated_by` (`evaluated_by`),
  KEY `idx_staff_report` (`staff_report_id`)
) ENGINE=MyISAM AUTO_INCREMENT=4 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

--
-- Dumping data for table `evaluations`
--

INSERT INTO `evaluations` (`id`, `staff_report_id`, `evaluated_by`, `evaluation_date`, `metrics_achieved`, `metrics_target`, `qualitative_feedback`, `strengths`, `areas_for_improvement`, `rating`, `contributes_to_appraisal`, `created_at`) VALUES
(1, 1, 2, '2026-03-09 13:35:59', 300.00, 500.00, 'Good progress on documentation, but procurement needs to speed up.', 'Thorough documentation.', NULL, 'good', 1, '2026-03-09 13:35:59'),
(2, 2, 1, '2026-03-09 13:35:59', 45.00, 100.00, 'Solid initial planning phase.', 'Clear architectural design.', NULL, 'satisfactory', 1, '2026-03-09 13:35:59'),
(3, 3, 1, '2026-03-09 13:35:59', 0.00, 100.00, 'Awaiting draft completion.', '', NULL, 'needs_improvement', 1, '2026-03-09 13:35:59');

-- --------------------------------------------------------

--
-- Table structure for table `notifications`
--

DROP TABLE IF EXISTS `notifications`;
CREATE TABLE IF NOT EXISTS `notifications` (
  `id` int NOT NULL AUTO_INCREMENT,
  `user_id` int DEFAULT NULL,
  `title` varchar(200) DEFAULT NULL,
  `message` text,
  `related_entity_type` varchar(50) DEFAULT NULL,
  `related_entity_id` int DEFAULT NULL,
  `type` enum('info','warning','success','danger') DEFAULT 'info',
  `is_read` tinyint(1) DEFAULT '0',
  `is_urgent` tinyint(1) DEFAULT '0',
  `action_url` varchar(500) DEFAULT NULL,
  `expires_at` timestamp NULL DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `user_id` (`user_id`)
) ENGINE=MyISAM AUTO_INCREMENT=4 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

--
-- Dumping data for table `notifications`
--

INSERT INTO `notifications` (`id`, `user_id`, `title`, `message`, `related_entity_type`, `related_entity_id`, `type`, `is_read`, `is_urgent`, `action_url`, `expires_at`, `created_at`) VALUES
(1, 3, 'New Assignment', 'You have been assigned to Procure 500 new lab computers.', NULL, NULL, 'info', 0, 0, NULL, NULL, '2026-03-09 13:35:59'),
(2, 2, 'Report Evaluated', 'Your report for Q1 has been evaluated by the Principal.', NULL, NULL, 'success', 1, 0, NULL, NULL, '2026-03-09 13:35:59'),
(3, 1, 'Budget Alert', 'Campus Solar Power Extension requires edits from Council.', NULL, NULL, 'warning', 0, 0, NULL, NULL, '2026-03-09 13:35:59');

-- --------------------------------------------------------

--
-- Table structure for table `staff_reports`
--

DROP TABLE IF EXISTS `staff_reports`;
CREATE TABLE IF NOT EXISTS `staff_reports` (
  `id` int NOT NULL AUTO_INCREMENT,
  `activity_assignment_id` int NOT NULL,
  `submitted_by` int NOT NULL,
  `report_date` date DEFAULT (curdate()),
  `report_period_start` date DEFAULT NULL,
  `report_period_end` date DEFAULT NULL,
  `progress_percentage` decimal(5,2) DEFAULT NULL,
  `achievements` text,
  `challenges` text,
  `next_steps` text,
  `attachments` text,
  `status` enum('draft','submitted','acknowledged','evaluated') DEFAULT 'draft',
  `submitted_at` timestamp NULL DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `activity_assignment_id` (`activity_assignment_id`),
  KEY `submitted_by` (`submitted_by`),
  KEY `idx_assignment` (`activity_assignment_id`)
) ENGINE=MyISAM AUTO_INCREMENT=4 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

--
-- Dumping data for table `staff_reports`
--

INSERT INTO `staff_reports` (`id`, `activity_assignment_id`, `submitted_by`, `report_date`, `report_period_start`, `report_period_end`, `progress_percentage`, `achievements`, `challenges`, `next_steps`, `attachments`, `status`, `submitted_at`, `created_at`, `updated_at`) VALUES
(1, 1, 3, '2026-03-09', '2026-01-01', '2026-03-01', 60.00, 'Tender documents fully drafted and approved.', 'Delays in procurement board sign-off.', 'Publish tender next week.', NULL, 'evaluated', NULL, '2026-03-09 13:35:59', '2026-03-09 13:35:59'),
(2, 3, 2, '2026-03-09', '2026-01-01', '2026-03-01', 45.00, 'Server architecture planned.', 'Budget constraints.', 'Request additional funding.', NULL, 'submitted', NULL, '2026-03-09 13:35:59', '2026-03-09 13:35:59'),
(3, 2, 2, '2026-03-09', '2026-01-01', '2026-03-01', 0.00, '', '', '', NULL, 'draft', NULL, '2026-03-09 13:35:59', '2026-03-09 13:35:59');

-- --------------------------------------------------------

--
-- Table structure for table `strategic_activities`
--

DROP TABLE IF EXISTS `strategic_activities`;
CREATE TABLE IF NOT EXISTS `strategic_activities` (
  `id` int NOT NULL AUTO_INCREMENT,
  `activity_type` enum('main','detailed') NOT NULL,
  `source` enum('strategic_plan','council_minutes','tmc_minutes','academic_board','other_duty') DEFAULT NULL,
  `main_activity_id` int DEFAULT NULL,
  `parent_id` int DEFAULT NULL,
  `title` varchar(200) NOT NULL,
  `description` text,
  `pillar` enum('Teaching & Learning','Research & Innovation','Governance','Infrastructure','Partnerships') DEFAULT NULL,
  `department_id` int DEFAULT NULL,
  `target_kpi` varchar(200) DEFAULT NULL,
  `completion_criteria` text,
  `priority` enum('High','Medium','Low') DEFAULT 'Medium',
  `start_date` date DEFAULT NULL,
  `end_date` date DEFAULT NULL,
  `status` enum('pending','in_progress','completed','overdue') DEFAULT 'pending',
  `progress` int DEFAULT '0',
  `created_by` int DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `meeting_reference` varchar(100) DEFAULT NULL,
  `committee_suggestion_unit_id` int DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `main_activity_id` (`main_activity_id`),
  KEY `parent_id` (`parent_id`),
  KEY `unit_id` (`department_id`),
  KEY `created_by` (`created_by`)
) ENGINE=MyISAM AUTO_INCREMENT=4 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

--
-- Dumping data for table `strategic_activities`
--

INSERT INTO `strategic_activities` (`id`, `activity_type`, `source`, `main_activity_id`, `parent_id`, `title`, `description`, `pillar`, `department_id`, `target_kpi`, `completion_criteria`, `priority`, `start_date`, `end_date`, `status`, `progress`, `created_by`, `created_at`, `updated_at`, `meeting_reference`, `committee_suggestion_unit_id`) VALUES
(1, 'main', 'strategic_plan', NULL, NULL, 'Upgrade e-Learning Infrastructure', NULL, 'Infrastructure', 1, '100% cloud migration', NULL, 'High', NULL, NULL, 'in_progress', 45, 1, '2026-03-09 13:35:59', '2026-03-09 13:35:59', NULL, NULL),
(2, 'detailed', 'strategic_plan', 1, 1, 'Procure 500 new lab computers', NULL, 'Infrastructure', 2, '500 computers', NULL, 'High', NULL, NULL, 'in_progress', 60, 2, '2026-03-09 13:35:59', '2026-03-09 13:35:59', NULL, NULL),
(3, 'main', 'academic_board', NULL, NULL, 'Launch new AI Curriculum', NULL, 'Teaching & Learning', 1, 'Curriculum approved by Senate', NULL, 'Medium', NULL, NULL, 'pending', 0, 1, '2026-03-09 13:35:59', '2026-03-09 13:35:59', NULL, NULL);

-- --------------------------------------------------------

--
-- Table structure for table `system_logs`
--

DROP TABLE IF EXISTS `system_logs`;
CREATE TABLE IF NOT EXISTS `system_logs` (
  `id` int NOT NULL AUTO_INCREMENT,
  `user_id` int DEFAULT NULL,
  `action` varchar(100) NOT NULL,
  `entity_type` varchar(50) DEFAULT NULL,
  `entity_id` int DEFAULT NULL,
  `old_values` json DEFAULT NULL,
  `new_values` json DEFAULT NULL,
  `ip_address` varchar(45) DEFAULT NULL,
  `user_agent` text,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_user` (`user_id`),
  KEY `idx_entity` (`entity_type`,`entity_id`)
) ENGINE=MyISAM AUTO_INCREMENT=4 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

--
-- Dumping data for table `system_logs`
--

INSERT INTO `system_logs` (`id`, `user_id`, `action`, `entity_type`, `entity_id`, `old_values`, `new_values`, `ip_address`, `user_agent`, `created_at`) VALUES
(1, 1, 'User Login', 'Auth', 1, NULL, NULL, NULL, NULL, '2026-03-09 13:35:59'),
(2, 2, 'Created Proposal', 'CommitteeProposals', 1, NULL, NULL, NULL, NULL, '2026-03-09 13:35:59'),
(3, 3, 'Submitted Report', 'StaffReports', 1, NULL, NULL, NULL, NULL, '2026-03-09 13:35:59');

-- --------------------------------------------------------

--
-- Table structure for table `users`
--

DROP TABLE IF EXISTS `users`;
CREATE TABLE IF NOT EXISTS `users` (
  `id` int NOT NULL AUTO_INCREMENT,
  `employee_id` varchar(50) DEFAULT NULL,
  `full_name` varchar(100) NOT NULL,
  `email` varchar(100) NOT NULL,
  `password_hash` varchar(255) NOT NULL,
  `role` varchar(100) NOT NULL DEFAULT 'staff',
  `department_id` int DEFAULT NULL,
  `position` varchar(200) DEFAULT NULL,
  `status` enum('Active','Suspended','Pending') DEFAULT 'Pending',
  `contract_end_date` date DEFAULT NULL,
  `employment_status` enum('active','on_leave','expired','terminated') DEFAULT 'active',
  `contract_start_date` date DEFAULT NULL,
  `leave_status` enum('On Duty','On Leave','Sick Leave','Annual Leave') DEFAULT 'On Duty',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `email` (`email`),
  UNIQUE KEY `employee_id` (`employee_id`),
  KEY `department_id` (`department_id`)
) ENGINE=InnoDB AUTO_INCREMENT=5 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

--
-- Dumping data for table `users`
--

INSERT INTO `users` (`id`, `employee_id`, `full_name`, `email`, `password_hash`, `role`, `department_id`, `position`, `status`, `contract_end_date`, `employment_status`, `contract_start_date`, `leave_status`, `created_at`, `updated_at`) VALUES
(1, 'EMP001', 'Prof. John Smith', 'principal@mubs.ac.ug', 'password123', 'strategy_manager', 3, 'Strategy Manager', 'Active', NULL, 'active', NULL, 'On Duty', '2026-03-09 13:35:59', '2026-03-10 04:58:27'),
(2, 'EMP002', 'Dr. Sarah Connor', 'sconnor@mubs.ac.ug', '$2y$12$s3IJo5KXREPCt5vHK63Pse1RQaw0xr3IM/u2eopcHJq/rvJjPotDa', 'hod', 1, 'Head of Department', 'Active', NULL, 'active', NULL, 'On Duty', '2026-03-09 13:35:59', '2026-03-10 09:53:50'),
(3, 'EMP003', 'Alex Developer', 'alex@mubs.ac.ug', '$2b$10$L4DrZMeAzbf3dHS.Hu8.r.eInNFHiiJZNmchDcgCeO.DzIrqmCNQ.', 'staff', 2, 'Senior Lecturer', 'Active', NULL, 'active', NULL, 'On Duty', '2026-03-09 13:35:59', '2026-03-10 04:58:27'),
(4, 'ADMIN002', 'Ongom Spanner Ivan', 'admin@mubs.ac.ug', '$2y$12$s3IJo5KXREPCt5vHK63Pse1RQaw0xr3IM/u2eopcHJq/rvJjPotDa', 'strategy_manager,committee_member,hod,staff,principal', 1, 'Administrative Assistant', 'Active', '2054-12-31', 'active', '2024-01-01', 'On Duty', '2026-03-10 04:59:45', '2026-03-10 07:19:38');

-- --------------------------------------------------------

--
-- Table structure for table `user_roles`
--

DROP TABLE IF EXISTS `user_roles`;
CREATE TABLE IF NOT EXISTS `user_roles` (
  `id` int NOT NULL AUTO_INCREMENT,
  `user_id` int NOT NULL,
  `role` enum('strategy_manager','committee_member','hod','staff','principal','system_admin') NOT NULL,
  `assigned_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `assigned_by` int DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `unique_user_role` (`user_id`,`role`),
  KEY `idx_user` (`user_id`),
  KEY `idx_role` (`role`),
  KEY `fk_user_roles_assigned_by` (`assigned_by`)
) ENGINE=InnoDB AUTO_INCREMENT=17 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

--
-- Dumping data for table `user_roles`
--

INSERT INTO `user_roles` (`id`, `user_id`, `role`, `assigned_at`, `assigned_by`) VALUES
(13, 4, 'strategy_manager', '2026-03-10 05:24:44', 1),
(14, 4, 'committee_member', '2026-03-10 05:24:44', 1),
(15, 4, 'hod', '2026-03-10 05:24:44', 1),
(16, 4, 'staff', '2026-03-10 05:24:44', 1);

--
-- Constraints for dumped tables
--

--
-- Constraints for table `user_roles`
--
ALTER TABLE `user_roles`
  ADD CONSTRAINT `fk_user_roles_assigned_by` FOREIGN KEY (`assigned_by`) REFERENCES `users` (`id`) ON DELETE SET NULL,
  ADD CONSTRAINT `fk_user_roles_user_id` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE;
COMMIT;

/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
