import { NextResponse } from 'next/server';
import { query } from '@/lib/db';

export async function GET() {
  try {
    // Get total activities
    const totalActivities = await query({
      query: 'SELECT COUNT(*) as count FROM strategic_activities'
    });

    // Get overall progress
    const overallProgress = await query({
      query: 'SELECT AVG(progress) as avg_progress FROM strategic_activities'
    });

    // Get total users
    const totalUsers = await query({
      query: 'SELECT COUNT(*) as count FROM users'
    });

    // Get active users
    const activeUsers = await query({
      query: 'SELECT COUNT(*) as count FROM users WHERE status = "Active"'
    });

    // strategic_activities.status: enum('pending','in_progress','completed','overdue')
    const completedActivities = await query({
      query: "SELECT COUNT(*) as count FROM strategic_activities WHERE status = 'completed'"
    });

    // Get pending committee proposals (committee_proposals.status: 'Pending', etc.)
    const pendingProposals = await query({
      query: 'SELECT COUNT(*) as count FROM committee_proposals WHERE status = "Pending"'
    });

    // On-track = in_progress (activities being worked on)
    const onTrackActivities = await query({
      query: "SELECT COUNT(*) as count FROM strategic_activities WHERE status = 'in_progress'"
    });

    const inProgressActivities = await query({
      query: "SELECT COUNT(*) as count FROM strategic_activities WHERE status = 'in_progress'"
    });

    // Delayed = overdue (strategic_activities.status = 'overdue')
    const delayedActivities = await query({
      query: "SELECT COUNT(*) as count FROM strategic_activities WHERE status = 'overdue'"
    });

    // Office/Faculty performance: avg strategic_activities.progress per office/faculty (parent_id IS NULL), including all activities under their units
    const departmentPerformance = await query({
      query: `
        SELECT parent.id, parent.name, ROUND(AVG(sa.progress)) AS progress
        FROM departments parent
        LEFT JOIN departments child ON child.parent_id = parent.id
        LEFT JOIN strategic_activities sa ON (sa.department_id = child.id OR sa.department_id = parent.id)
        WHERE parent.parent_id IS NULL
        GROUP BY parent.id, parent.name
        ORDER BY progress DESC, parent.name ASC
      `
    });

    // Get recent activities
    const recentActivities = await query({
      query: `
        SELECT 
          'person_add' as icon,
          '#eff6ff' as bgColor,
          '#005696' as iconColor,
          CONCAT('User ', full_name, ' was updated') as description,
          DATE_FORMAT(updated_at, '%W, %H:%i') as timestamp
        FROM users
        ORDER BY updated_at DESC
        LIMIT 4
      `
    });

    // Get HR alerts (Contracts expiring within 30 days or users on leave)
    const hrAlerts = await query({
      query: `
        (SELECT 
          id, full_name, role, contract_end_date as date, 
          'Contract' as type, 
          CONCAT('Expires in ', DATEDIFF(contract_end_date, CURDATE()), ' days') as message,
          '#b45309' as color
        FROM users 
        WHERE contract_end_date IS NOT NULL 
          AND contract_end_date <= DATE_ADD(CURDATE(), INTERVAL 30 DAY))
        UNION
        (SELECT 
          id, full_name, role, CURDATE() as date, 
          'Leave' as type, 
          leave_status as message,
          '#15803d' as color
        FROM users 
        WHERE leave_status != 'On Duty')
        ORDER BY date ASC
        LIMIT 6
      `
    });

    return NextResponse.json({
      stats: {
        totalActivities: (totalActivities as any[])[0]?.count || 0,
        overallProgress: Math.round((overallProgress as any[])[0]?.avg_progress || 0),
        totalUsers: (totalUsers as any[])[0]?.count || 0,
        activeUsers: (activeUsers as any[])[0]?.count || 0,
        completedActivities: (completedActivities as any[])[0]?.count || 0,
        pendingProposals: (pendingProposals as any[])[0]?.count || 0,
        onTrackActivities: (onTrackActivities as any[])[0]?.count || 0,
        inProgressActivities: (inProgressActivities as any[])[0]?.count || 0,
        delayedActivities: (delayedActivities as any[])[0]?.count || 0,
        hrAlertCount: (hrAlerts as any[]).length
      },
      departmentPerformance: (departmentPerformance as any[]).map(department => ({
        name: department.name,
        progress: Math.min(100, Math.max(0, Number(department.progress) || 0))
      })),
      recentActivities: recentActivities,
      hrAlerts: hrAlerts
    });
  } catch (error) {
    console.error('Dashboard stats error:', error);
    return NextResponse.json(
      { message: 'Internal server error' },
      { status: 500 }
    );
  }
}