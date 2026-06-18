/**
 * Test HRMS /bio search using the same pattern as the Express route.
 * Usage: node scripts/test-hrms-api.js [name]
 */
require('dotenv').config({ path: '.env.local' });
const axios = require('axios');

const HRMS_API_URL = (process.env.HRMS_API_URL || 'https://hrms.mubs.ac.ug').replace(/\/$/, '');
const HRMS_API_KEY = process.env.HRMS_API_KEY || '';
const HRMS_API_SECRET = process.env.HRMS_API_SECRET || '';
const REQUIRE_AUTH = process.env.REQUIRE_AUTH === 'true';
const TIMEOUT = Number(process.env.HRMS_TIMEOUT_MS) || 20000;
const name = (process.argv[2] || 'john').trim();

async function main() {
  console.log('HRMS test — search-staff');
  console.log('URL:', `${HRMS_API_URL}/bio`);
  console.log('REQUIRE_AUTH:', REQUIRE_AUTH);
  console.log('API key set:', Boolean(HRMS_API_KEY));
  console.log('API secret set:', Boolean(HRMS_API_SECRET));
  console.log('Search name:', name);
  console.log('');

  if (name.length < 3) {
    console.log('Result: [] (name too short)');
    return;
  }

  if (REQUIRE_AUTH && (!HRMS_API_KEY || !HRMS_API_SECRET)) {
    console.error('FAIL: REQUIRE_AUTH=true but HRMS_API_KEY or HRMS_API_SECRET is empty in .env.local');
    process.exit(1);
  }

  try {
    const response = await axios.get(`${HRMS_API_URL}/bio`, {
      params: { rq: 'search-staff', crit: 'name', name },
      headers: {
        'x-api-key': HRMS_API_KEY,
        'x-api-secret': HRMS_API_SECRET,
      },
      timeout: TIMEOUT,
      validateStatus: () => true,
    });

    console.log('HTTP status:', response.status);
    const legacyStaffArray = response.data?.staff || [];
    const staffResults = legacyStaffArray.map((s) => ({
      id: s.id,
      name: s.name,
      email: s.email,
      position: s.psn || 'Staff',
      department: s.dept || 'N/A',
      category: s.cat || 'Academic',
    }));

    if (response.status !== 200) {
      console.error('FAIL:', JSON.stringify(response.data));
      process.exit(1);
    }

    console.log('OK — matches found:', staffResults.length);
    if (staffResults[0]) {
      console.log('First result:', JSON.stringify(staffResults[0], null, 2));
    }
  } catch (error) {
    console.error('HRMS Communication Error:', error.message);
    process.exit(1);
  }
}

main();
