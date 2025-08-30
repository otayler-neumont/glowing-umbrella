#!/usr/bin/env node

import { SQSClient, SendMessageCommand } from '@aws-sdk/client-sqs';

// Test the invite system by sending a message directly to SQS
async function testInvite() {
  const sqs = new SQSClient({ region: 'us-east-1' }); // Update region as needed
  
  const testMessage = {
    email: 'test@example.com', // Replace with your test email
    campaignId: '123e4567-e89b-12d3-a456-426614174000', // Replace with actual campaign ID
    token: 'test-token-123',
    accept: 'https://your-api-gateway-url.amazonaws.com/v1/invites/test-token-123/accept',
    subject: 'Test Campaign Invite',
    message: 'This is a test invite to verify the email system is working.'
  };

  try {
    // You'll need to get the actual queue URL from your deployed stack
    const queueUrl = process.env.INVITE_QUEUE_URL || 'https://sqs.us-east-1.amazonaws.com/YOUR_ACCOUNT/YOUR_QUEUE';
    
    console.log('Sending test message to SQS...');
    console.log('Queue URL:', queueUrl);
    console.log('Message:', JSON.stringify(testMessage, null, 2));
    
    const result = await sqs.send(new SendMessageCommand({
      QueueUrl: queueUrl,
      MessageBody: JSON.stringify(testMessage)
    }));
    
    console.log('Message sent successfully!');
    console.log('Message ID:', result.MessageId);
    console.log('Check your email and CloudWatch logs to verify the email was sent.');
    
  } catch (error) {
    console.error('Error sending message:', error);
  }
}

testInvite().catch(console.error);
