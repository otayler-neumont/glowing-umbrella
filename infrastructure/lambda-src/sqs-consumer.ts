import { SESClient, SendEmailCommand } from '@aws-sdk/client-ses';
import { SQSEvent, SQSRecord } from 'aws-lambda';

const ses = new SESClient({});

export const handler = async (event: SQSEvent) => {
  const emails = [];
  
  for (const record of event.Records) {
    try {
      const body = JSON.parse(record.body || '{}');
      const subject = body.subject || 'Campaign Invite';
      const email = body.email;
      
      if (!email) {
        console.warn('Skipping message without email:', record.messageId);
        continue;
      }
      
      // Create a proper email message with the acceptance link
      const emailMessage = `
${body.message || 'You have been invited to join a campaign!'}

To accept this invitation, click the following link:
${body.accept}

This invitation will expire in 7 days.

If you have any questions, please contact the campaign Game Master.
      `.trim();
      
      emails.push(
        ses.send(new SendEmailCommand({
          Source: process.env.FROM_EMAIL || 'noreply@yourdomain.com',
          Destination: { ToAddresses: [email] },
          Message: {
            Subject: { Data: subject },
            Body: { Text: { Data: emailMessage } }
          }
        }))
      );
      
      console.log(`Sending invite email to ${email}`);
    } catch (error) {
      console.error(`Error processing message ${record.messageId}:`, error);
      // Don't throw - let SQS handle retries via DLQ
    }
  }
  
  try {
    await Promise.all(emails);
    console.log(`Successfully sent ${emails.length} emails`);
    return { statusCode: 200, body: 'Success' };
  } catch (error) {
    console.error('Error sending emails:', error);
    throw error; // This will trigger SQS retry
  }
};
