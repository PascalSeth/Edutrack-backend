import { sendParentWelcomeEmail } from './src/utils/emailService';

async function testEmail() {
  console.log('Testing email sending to pascalelikem@gmail.com...');

  // Test sending a welcome email
  const result = await sendParentWelcomeEmail(
    'pascalelikem@gmail.com',
    'Test',
    'User',
    'Test',
    'Student',
    'Test School',
    'TestPass123!'
  );

  console.log('Email send test result:', result);
  process.exit(result ? 0 : 1);
}

testEmail().catch(console.error);