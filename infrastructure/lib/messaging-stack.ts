import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { aws_sqs as sqs, aws_lambda as lambda, aws_lambda_event_sources as event_sources, aws_ec2 as ec2, aws_ssm as ssm, aws_lambda_nodejs as lambdaNode, aws_iam as iam } from 'aws-cdk-lib';
import * as path from 'path';

export interface MessagingStackProps extends cdk.StackProps {
	vpc: ec2.IVpc;
	lambdaSecurityGroup: ec2.ISecurityGroup;
	parameterPrefix?: string;
	fromEmail?: string; // Email address to send invites from
}

export class MessagingStack extends cdk.Stack {
	public readonly queue: sqs.Queue;
	public readonly dlq: sqs.Queue;

	constructor(scope: Construct, id: string, props: MessagingStackProps) {
		super(scope, id, props);

		const prefix = props.parameterPrefix ?? '/rpg/mq';

		this.dlq = new sqs.Queue(this, 'InviteDlq', {
			retentionPeriod: cdk.Duration.days(14),
		});

		this.queue = new sqs.Queue(this, 'InviteQueue', {
			visibilityTimeout: cdk.Duration.seconds(30),
			deadLetterQueue: {
				queue: this.dlq,
				maxReceiveCount: 3,
			},
		});

		const consumer = new lambdaNode.NodejsFunction(this, 'InviteConsumerFnNoVpc', {
			runtime: lambda.Runtime.NODEJS_20_X,
			handler: 'handler',
			memorySize: 256,
			timeout: cdk.Duration.seconds(30), // Increased from 15 to 30 seconds for SES email sending
			environment: {
				FROM_EMAIL: props.fromEmail || 'noreply@yourdomain.com',
			},
			entry: path.join(__dirname, '..', '..', 'lambda-src', 'sqs-consumer.ts'),
			bundling: { externalModules: ['aws-sdk'], minify: true, sourceMap: true },
		});

		// Grant SES permissions to send emails
		consumer.addToRolePolicy(new iam.PolicyStatement({
			actions: ['ses:SendEmail', 'ses:SendRawEmail'],
			resources: ['*'], // In production, restrict to specific email addresses
		}));

		consumer.addEventSource(new event_sources.SqsEventSource(this.queue, { batchSize: 5 }));

		new ssm.StringParameter(this, 'InviteQueueUrlParam', {
			parameterName: `${prefix}/inviteQueueUrl`,
			stringValue: this.queue.queueUrl,
			description: 'URL of the SQS invitation queue',
		});
		new ssm.StringParameter(this, 'InviteQueueArnParam', {
			parameterName: `${prefix}/inviteQueueArn`,
			stringValue: this.queue.queueArn,
			description: 'ARN of the SQS invitation queue',
		});
	}
}
