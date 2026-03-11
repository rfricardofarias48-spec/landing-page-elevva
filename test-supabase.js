import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabaseUrl = 'https://dbfttgtntntuiimbqzgu.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRiZnR0Z3RudG50dWlpbWJxemd1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzAzMTUwODksImV4cCI6MjA4NTg5MTA4OX0.H36Kv-PzK8Ab8FN5HzAWO5S_y8t-z8gExl5GsDBQchs';

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase credentials');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function test() {
  console.log('Fetching interviews...');
  const { data, error } = await supabase
    .from('interviews')
    .select(`
      *,
      jobs!inner (title, user_id),
      candidates (analysis_result, "WhatsApp com DDD"),
      interview_slots (slot_date, slot_time, format, location)
    `);
  
  console.log('Data:', JSON.stringify(data, null, 2));
  console.log('Error:', error);
}

test();
