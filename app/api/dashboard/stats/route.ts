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

    // Get completed activities
    const completedActivities = await query({
      query: 'SELECT COUNT(*) as count FROM strategic_activities WHERE status = "Completed"'
    });

    // Get pending committee proposals
    const pendingProposals = await query({
      query: 'SELECT COUNT(*) as count FROM committee_proposals WHERE status = "Pending"'
    });

    // Get on-track activities
    const onTrackActivities = await query({
      query: 'SELECT COUNT(*) as count FROM strategic_activities WHERE status = "On Track"'
    });

    // Get in-progress activities
    const inProgressActivities = await query({
      query: 'SELECT COUNT(*) as count FROM strategic_activities WHERE status = "In Progress"'
    });

    // Get delayed activities
    const delayedActivities = await query({
      query: 'SELECT COUNT(*) as count FROM strategic_activities WHERE status = "Delayed"'
    });

    // Get department performance
    const departmentPerformance = await query({
      query: `
        SELECT u.name, AVG(sa.progress) as progress
        FROM departments u
        LEFT JOIN strategic_activities sa ON u.id = sa.department_id
        GROUP BY u.id
        LIMIT 6
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
        progress: Math.round(department.progress || 0)
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