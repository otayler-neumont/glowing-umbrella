import { SNSClient, PublishCommand } from '@aws-sdk/client-sns';
import { SQSEvent, SQSRecord } from 'aws-lambda';

const sns = new SNSClient({});

export const handler = async (event: SQSEvent) => {
  const publishes = [];
  
  for (const record of event.Records) {
    try {
      const body = JSON.parse(record.body || '{}');
      const subject = body.subject || 'Campaign Invite';
      const message = body.message || JSON.stringify(body);
      const email = body.email;
      
      if (!email) {
        console.warn('Skipping message without email:', record.messageId);
        continue;
      }
      
      // Create a proper email message with the acceptance link
      const emailMessage = `
${message}

To accept this invitation, click the following link:
${body.accept}

This invitation will expire in 7 days.

If you have any questions, please contact the campaign Game Master.
      `.trim();
      
      publishes.push(
        sns.send(new PublishCommand({
          TopicArn: process.env.TOPIC_ARN!,
          Subject: subject,
          Message: emailMessage,
          MessageAttributes: {
            email: { DataType: 'String', StringValue: email }
          }
        }))
      );
      
      console.log(`Published invite for ${email} to SNS`);
    } catch (error) {
      console.error(`Error processing message ${record.messageId}:`, error);
      // Don't throw - let SQS handle retries via DLQ
    }
  }
  
  try {
    await Promise.all(publishes);
    console.log(`Successfully processed ${publishes.length} messages`);
    return { statusCode: 200, body: 'Success' };
  } catch (error) {
    console.error('Error publishing to SNS:', error);
    throw error; // This will trigger SQS retry
  }
};
