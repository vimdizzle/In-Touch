const { Client } = require('pg');

const connectionString = 'postgresql://postgres:Flashmira889@db.dnjtxrbfrglhekctyhax.supabase.co:5432/postgres';

const client = new Client({
  connectionString: connectionString,
});

async function setupDatabase() {
  try {
    await client.connect();
    console.log('✅ Connected to database');

    // Create the messages table
    await client.query(`
      CREATE TABLE IF NOT EXISTS messages (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        message TEXT NOT NULL,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );
    `);
    console.log('✅ Created messages table');

    // Enable Row Level Security
    await client.query(`
      ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
    `);
    console.log('✅ Enabled Row Level Security');

    // Create insert policy
    await client.query(`
      DROP POLICY IF EXISTS "Allow public inserts" ON messages;
      CREATE POLICY "Allow public inserts" ON messages
        FOR INSERT
        TO public
        WITH CHECK (true);
    `);
    console.log('✅ Created insert policy');

    // Create select policy
    await client.query(`
      DROP POLICY IF EXISTS "Allow public reads" ON messages;
      CREATE POLICY "Allow public reads" ON messages
        FOR SELECT
        TO public
        USING (true);
    `);
    console.log('✅ Created select policy');

    console.log('\n🎉 Database setup complete!');
  } catch (error) {
    console.error('❌ Error setting up database:', error.message);
    process.exit(1);
  } finally {
    await client.end();
  }
}

setupDatabase();

