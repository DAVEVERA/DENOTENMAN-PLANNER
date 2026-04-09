
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const envFile = fs.readFileSync('.env.local', 'utf-8');
const env = {};
envFile.split('\n').forEach(line => {
  if (line.includes('=')) {
    const [key, value] = line.split('=');
    env[key.trim()] = value.trim();
  }
});

const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);

async function checkRpc() {
  console.log('Checking execute_sql...');
  const { data: d1, error: e1 } = await supabase.rpc('execute_sql', { sql: 'SELECT 1' });
  console.log('Result execute_sql:', d1, e1?.message);

  console.log('Checking exec_sql...');
  const { data: d2, error: e2 } = await supabase.rpc('exec_sql', { query: 'SELECT 1' });
  console.log('Result exec_sql:', d2, e2?.message);
}

checkRpc();
