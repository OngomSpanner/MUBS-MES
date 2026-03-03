import { query } from './lib/db';

async function checkSchema() {
    try {
        const columns = await query({
            query: "SHOW COLUMNS FROM strategic_activities"
        });
        console.log(JSON.stringify(columns, null, 2));
    } catch (e) {
        console.error(e);
    }
}

checkSchema();
