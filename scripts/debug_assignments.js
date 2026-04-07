const mysql = require('mysql2/promise');

async function checkAssignments() {
  const connection = await mysql.createConnection({
    host: 'localhost',
    user: 'root',
    password: '',
    database: 'mubs_super_admin'
  });

  try {
    const userId = 7;
    const [rows] = await connection.execute(`
                SELECT 
                    spa.id,
                    sa.id as activity_id,
                    sp.step_name as title,
                    sa.description as description,
                    spa.status as db_status,
                    d.name as unit_name
                FROM staff_process_assignments spa
                JOIN standard_processes sp ON spa.standard_process_id = sp.id
                JOIN strategic_activities sa ON spa.activity_id = sa.id
                LEFT JOIN departments d ON sa.department_id = d.id
                WHERE spa.staff_id = ?
    `, [userId]);
    
    console.log(`Found ${rows.length} rows for user 7 using the API query joins.`);
    if (rows.length === 0) {
        console.log('Join failed. Checking individual tables...');
        const [spa] = await connection.execute('SELECT activity_id, standard_process_id FROM staff_process_assignments WHERE staff_id = ?', [userId]);
        console.log('Assignments in spa table:', spa);
        
        for (const row of spa) {
            const [p] = await connection.execute('SELECT id FROM standard_processes WHERE id = ?', [row.standard_process_id]);
            const [a] = await connection.execute('SELECT id FROM strategic_activities WHERE id = ?', [row.activity_id]);
            console.log(`Checking row {act: ${row.activity_id}, proc: ${row.standard_process_id}}: Process found: ${p.length > 0}, Activity found: ${a.length > 0}`);
        }
    } else {
        console.log('Sample row:', rows[0]);
    }
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await connection.end();
  }
}

checkAssignments();
