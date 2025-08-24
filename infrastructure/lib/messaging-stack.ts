import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { aws_sqs as sqs, aws_sns as sns, aws_lambda as lambda, aws_lambda_event_sources as event_sources, aws_ec2 as ec2, aws_ssm as ssm } from 'aws-cdk-lib';

export interface MessagingStackProps extends cdk.StackProps {
	vpc: ec2.IVpc;
	lambdaSecurityGroup: ec2.ISecurityGroup;
	parameterPrefix?: string;
}

export class MessagingStack extends cdk.Stack {
	public readonly queue: sqs.Queue;
	public readonly dlq: sqs.Queue;
	public readonly topic: sns.Topic;

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

		this.topic = new sns.Topic(this, 'InviteTopic', {
			displayName: 'RPG Invite Notifications',
		});

		const consumer = new lambda.Function(this, 'InviteConsumerFn', {
			runtime: lambda.Runtime.NODEJS_20_X,
			handler: 'index.handler',
			memorySize: 256,
			timeout: cdk.Duration.seconds(15),
			vpc: props.vpc,
			securityGroups: [props.lambdaSecurityGroup],
			environment: {
				TOPIC_ARN: this.topic.topicArn,
			},
			code: lambda.Code.fromInline(`
				exports.handler = async (event) => {
				  const { SNSClient, PublishCommand } = require('@aws-sdk/client-sns');
				  const sns = new SNSClient({});
				  const publishes = [];
				  for (const record of (event.Records || [])) {
				    const body = JSON.parse(record.body || '{}');
				    const subject = body.subject || 'Campaign Invite';
				    const message = body.message || JSON.stringify(body);
				    const email = body.email;
				    if (!email) continue;
				    publishes.push(sns.send(new PublishCommand({
				      TopicArn: process.env.TOPIC_ARN,
				      Subject: subject,
				      Message: message,
				      MessageAttributes: {
				        email: { DataType: 'String', StringValue: email }
				      }
				    })));
				  }
				  await Promise.all(publishes);
				  return { statusCode: 200 };
				};
			`),
		});

		consumer.addEventSource(new event_sources.SqsEventSource(this.queue, { batchSize: 5 }));
		this.topic.grantPublish(consumer);

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
		new ssm.StringParameter(this, 'InviteTopicArnParam', {
			parameterName: `${prefix}/inviteTopicArn`,
			stringValue: this.topic.topicArn,
			description: 'ARN of the SNS invite topic',
		});
	}
}
