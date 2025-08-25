import { Client } from 'pg';
import { SecretsManagerClient, GetSecretValueCommand } from '@aws-sdk/client-secrets-manager';

// Test script to debug invite functionality
async function testInvite() {
  try {
    console.log('Testing invite functionality...');
    
    // Test database connection
    const secretArn = process.env.DB_SECRET_ARN!;
    const host = process.env.DB_HOST!;
    const dbName = process.env.DB_NAME || 'appdb';
    
    console.log('Database config:', { host, dbName, secretArn: secretArn ? 'SET' : 'NOT SET' });
    
    const sm = new SecretsManagerClient({});
    const sec = await sm.send(new GetSecretValueCommand({ SecretId: secretArn }));
    const creds = JSON.parse(sec.SecretString || '{}');
    
    console.log('Credentials retrieved:', { username: creds.username ? 'SET' : 'NOT SET', password: creds.password ? 'SET' : 'NOT SET' });
    
    const client = new Client({ 
      host, 
      database: dbName, 
      user: creds.username, 
      password: creds.password, 
      ssl: { rejectUnauthorized: false } 
    });
    
    await client.connect();
    console.log('Database connected successfully');
    
    // Test basic queries
    const usersResult = await client.query('SELECT COUNT(*) FROM users');
    console.log('Users count:', usersResult.rows[0].count);
    
    const campaignsResult = await client.query('SELECT COUNT(*) FROM campaigns');
    console.log('Campaigns count:', campaignsResult.rows[0].count);
    
    const invitationsResult = await client.query('SELECT COUNT(*) FROM invitations');
    console.log('Invitations count:', invitationsResult.rows[0].count);
    
    // Test table structure
    const tableInfo = await client.query(`
      SELECT column_name, data_type, is_nullable 
      FROM information_schema.columns 
      WHERE table_name = 'invitations' 
      ORDER BY ordinal_position
    `);
    console.log('Invitations table structure:');
    tableInfo.rows.forEach(row => {
      console.log(`  ${row.column_name}: ${row.data_type} (nullable: ${row.is_nullable})`);
    });
    
    await client.end();
    console.log('Test completed successfully');
    
  } catch (error) {
    console.error('Test failed:', error);
    process.exit(1);
  }
}

testInvite();
