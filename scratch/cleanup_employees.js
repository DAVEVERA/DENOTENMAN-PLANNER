const fs = require('fs');
const env = fs.readFileSync('.env.local', 'utf8');
const urlMatch = env.match(/SUPABASE_URL=(.*)/);
const keyMatch = env.match(/SUPABASE_SERVICE_ROLE_KEY=(.*)/);
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(urlMatch[1], keyMatch[1]);

async function cleanup() {
  const { data: employees, error } = await supabase.from('planner20_employees').select('*');
  if (error) {
    console.error("Error fetching employees:", error);
    return;
  }

  // Group by email (ignore null/empty emails, but group them separately?)
  // Actually, all these employees have emails. 
  // Wait, some might have no email.
  const emailMap = new Map();
  for (const emp of employees) {
    if (!emp.email) continue; // skip empty emails? In the dump, all have emails.
    const key = emp.email.toLowerCase().trim();
    if (!emailMap.has(key)) emailMap.set(key, []);
    emailMap.get(key).push(emp);
  }

  const toDelete = [];
  const toUpdate = [];

  for (const [email, emps] of emailMap.entries()) {
    if (emps.length > 1) {
      // Sort by ID ascending
      emps.sort((a, b) => a.id - b.id);
      
      const keep = emps[0];
      console.log(`Keeping ${keep.name} (id: ${keep.id}) for ${email}`);
      
      // The rest should be deleted
      for (let i = 1; i < emps.length; i++) {
        toDelete.push(emps[i].id);
        console.log(`  Deleting duplicate ${emps[i].name} (id: ${emps[i].id})`);
      }
      
      // Make sure the kept one is a first name only
      const firstName = keep.name.split(' ')[0];
      if (keep.name !== firstName) {
        toUpdate.push({ id: keep.id, name: firstName });
      }
    } else {
      // Only 1 record. Just check if we need to shorten the name.
      const emp = emps[0];
      const firstName = emp.name.split(' ')[0];
      if (emp.name !== firstName) {
        console.log(`Updating ${emp.name} (id: ${emp.id}) -> ${firstName}`);
        toUpdate.push({ id: emp.id, name: firstName });
      }
    }
  }

  if (toDelete.length > 0) {
    const { error: delError } = await supabase.from('planner20_employees').delete().in('id', toDelete);
    if (delError) console.error("Error deleting:", delError);
    else console.log(`Deleted ${toDelete.length} duplicates.`);
  }

  for (const update of toUpdate) {
    const { error: updError } = await supabase.from('planner20_employees').update({ name: update.name }).eq('id', update.id);
    if (updError) console.error("Error updating:", updError);
    else console.log(`Updated ID ${update.id} to name ${update.name}`);
  }

  console.log("Cleanup complete!");
}

cleanup();
