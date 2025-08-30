# Invite System Documentation

## Overview
The invite system allows Game Masters to invite players to their campaigns via email. When an invite is created, it goes through the following flow:

1. **API Endpoint**: `POST /v1/campaigns/{campaignId}/invites`
2. **Database**: Invitation is stored with a secure token hash
3. **SQS Queue**: Message is sent to SQS for asynchronous processing
4. **Lambda Consumer**: SQS consumer processes the message and sends email via SES
5. **Email Delivery**: User receives email with acceptance link

## Recent Changes
- **Fixed**: Replaced SNS with direct SES email sending
- **Added**: Proper email permissions for Lambda functions
- **Improved**: Better email content and full acceptance URLs
- **Removed**: Unnecessary SNS topic and subscriptions

## Configuration

### Environment Variables
- `FROM_EMAIL`: Email address to send invites from (must be verified in SES)
- `API_BASE_URL`: Base URL for the API Gateway (automatically set)

### SES Setup
Before the invite system will work, you need to:

1. **Verify your sender email** in AWS SES:
   ```bash
   aws ses verify-email-identity --email-address noreply@yourdomain.com
   ```

2. **Move out of SES sandbox** (if needed):
   - By default, SES is in sandbox mode and can only send to verified emails
   - Request production access if you need to send to unverified emails

3. **Update the `fromEmail`** in `infrastructure/bin/infrastructure.ts`:
   ```typescript
   new MessagingStack(app, 'MessagingStack', {
     // ... other props
     fromEmail: 'noreply@yourdomain.com', // Your verified SES email
   });
   ```

## Testing

### 1. Deploy the Infrastructure
```bash
cd infrastructure
npm run build
npm run deploy
```

### 2. Test the Invite System
Use the test script to verify the email system:
```bash
# Set your queue URL
export INVITE_QUEUE_URL="https://sqs.us-east-1.amazonaws.com/YOUR_ACCOUNT/YOUR_QUEUE"

# Run the test
npm run test:invite
```

### 3. Test via Web Interface
1. Create a campaign in the web app
2. Use the invite form to send an invite to your email
3. Check your email for the invitation
4. Click the acceptance link

## Troubleshooting

### Common Issues

1. **"Invite queued" but no email received**
   - Check CloudWatch logs for the SQS consumer Lambda
   - Verify SES email permissions
   - Check if sender email is verified in SES

2. **SES permission errors**
   - Ensure the Lambda function has `ses:SendEmail` and `ses:SendRawEmail` permissions
   - Check IAM role policies

3. **Invalid acceptance links**
   - Verify `API_BASE_URL` environment variable is set correctly
   - Check API Gateway URL in CloudFormation outputs

### Debugging Steps

1. **Check SQS Queue**:
   ```bash
   aws sqs get-queue-attributes --queue-url YOUR_QUEUE_URL --attribute-names All
   ```

2. **Check Lambda Logs**:
   ```bash
   aws logs describe-log-groups --log-group-name-prefix "/aws/lambda/rpg-invite-consumer"
   ```

3. **Test SES directly**:
   ```bash
   aws ses send-email \
     --from "noreply@yourdomain.com" \
     --destination "ToAddresses=test@example.com" \
     --message "Subject={Data=Test},Body={Text={Data=Test message}}"
   ```

## Production Considerations

1. **Email Templates**: Consider using SES templates for better-looking emails
2. **Domain Verification**: Verify your domain in SES for better deliverability
3. **Rate Limiting**: Monitor SES sending limits and implement rate limiting if needed
4. **Bounce/Complaint Handling**: Set up SNS notifications for bounces and complaints
5. **Email Validation**: Validate email addresses before sending invites

## Security Notes

- Invitation tokens are hashed before storage
- Tokens expire after 7 days
- Each token can only be used once
- Campaign access is validated before allowing invites
- Only Game Masters can invite players to their campaigns
