#!/bin/bash

# RPG Platform Deployment Script
# This script deploys the infrastructure and runs database migrations

set -e

echo "🚀 Starting RPG Platform deployment..."

# Check if CDK is installed
if ! command -v cdk &> /dev/null; then
    echo "❌ CDK CLI not found. Please install it first:"
    echo "   npm install -g aws-cdk"
    exit 1
fi

# Check if we're in the right directory
if [ ! -f "cdk.json" ]; then
    echo "❌ Please run this script from the infrastructure directory"
    exit 1
fi

# Install dependencies
echo "📦 Installing dependencies..."
npm install

# Build the project
echo "🔨 Building project..."
npm run build

# Deploy all stacks
echo "🚀 Deploying infrastructure stacks..."
npx cdk deploy NetworkStack DatabaseStack AuthStack MessagingStack ApiStack MonitoringStack --require-approval never

echo "✅ Infrastructure deployed successfully!"

# Get the migration function name
echo "🔍 Getting migration function details..."
MIGRATE_FN=$(npx cdk list-exports | grep "DatabaseStack.MigrateFunctionName" | awk '{print $3}')

if [ -z "$MIGRATE_FN" ]; then
    echo "❌ Could not find migration function name"
    exit 1
fi

echo "📋 Migration function: $MIGRATE_FN"

# Instructions for running migration
echo ""
echo "🎯 Next steps:"
echo "1. Run the database migration by invoking the Lambda function:"
echo "   aws lambda invoke --function-name $MIGRATE_FN --payload '{}' response.json"
echo ""
echo "2. Subscribe to the SNS topic for test emails:"
echo "   - Go to SNS console"
echo "   - Find topic ARN in SSM parameter: /rpg/mq/inviteTopicArn"
echo "   - Subscribe your email address"
echo ""
echo "3. Test the API endpoints using the Postman collection:"
echo "   - Import: test/postman/rpg-api.postman_collection.json"
echo "   - Update variables with your Cognito tokens"
echo ""
echo "4. Start the web application:"
echo "   cd ../web && npm run dev"
echo ""
echo "🎉 Deployment complete! Check the outputs above for important information."
