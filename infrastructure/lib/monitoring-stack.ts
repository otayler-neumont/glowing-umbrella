import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { aws_cloudwatch as cw, aws_cloudwatch_actions as actions, aws_sns as sns, aws_ssm as ssm, aws_budgets as budgets } from 'aws-cdk-lib';

export interface MonitoringStackProps extends cdk.StackProps {
	apiIdParamName?: string; // Not used with REST API metrics, kept for extension
	rdsIdentifierParamName?: string; // Optionally map to DBInstanceIdentifier
	alarmEmail?: string; // Optional email for alarms
	monthlyBudgetUSD?: number; // Budget amount
}

export class MonitoringStack extends cdk.Stack {
	constructor(scope: Construct, id: string, props?: MonitoringStackProps) {
		super(scope, id, props);

		const alarmTopic = new sns.Topic(this, 'AlarmTopic');
		if (props?.alarmEmail) {
			alarmTopic.addSubscription(new (require('aws-cdk-lib/aws-sns-subscriptions').EmailSubscription)(props.alarmEmail));
		}

		// API Gateway 5xx alarm (all APIs)
		const api5xx = new cw.Metric({
			namespace: 'AWS/ApiGateway',
			metricName: '5XXError',
			statistic: 'Sum',
			period: cdk.Duration.minutes(1),
		});
		const api5xxAlarm = new cw.Alarm(this, 'Api5xxAlarm', {
			metric: api5xx,
			threshold: 1,
			evaluationPeriods: 5,
			treatMissingData: cw.TreatMissingData.NOT_BREACHING,
		});
		api5xxAlarm.addAlarmAction(new actions.SnsAction(alarmTopic));

		// Lambda error rate alarm (global)
		const lambdaErrors = new cw.Metric({ namespace: 'AWS/Lambda', metricName: 'Errors', statistic: 'Sum', period: cdk.Duration.minutes(1) });
		const lambdaErrorsAlarm = new cw.Alarm(this, 'LambdaErrorsAlarm', {
			metric: lambdaErrors,
			threshold: 1,
			evaluationPeriods: 5,
			treatMissingData: cw.TreatMissingData.NOT_BREACHING,
		});
		lambdaErrorsAlarm.addAlarmAction(new actions.SnsAction(alarmTopic));

		// RDS CPU alarm (all instances)
		const rdsCpu = new cw.Metric({ namespace: 'AWS/RDS', metricName: 'CPUUtilization', statistic: 'Average', period: cdk.Duration.minutes(5) });
		const rdsCpuAlarm = new cw.Alarm(this, 'RdsCpuAlarm', {
			metric: rdsCpu,
			threshold: 80,
			evaluationPeriods: 2,
			treatMissingData: cw.TreatMissingData.NOT_BREACHING,
		});
		rdsCpuAlarm.addAlarmAction(new actions.SnsAction(alarmTopic));

		// Simple dashboard
		const dashboard = new cw.Dashboard(this, 'OpsDashboard', { dashboardName: 'rpg-ops' });
		dashboard.addWidgets(
			new cw.GraphWidget({ title: 'API 5XX', left: [api5xx] }),
			new cw.GraphWidget({ title: 'Lambda Errors', left: [lambdaErrors] }),
			new cw.GraphWidget({ title: 'RDS CPU', left: [rdsCpu] }),
		);

		// AWS Budgets - monthly cost alert if amount provided
		if (props?.monthlyBudgetUSD && props.monthlyBudgetUSD > 0) {
			new budgets.CfnBudget(this, 'MonthlyBudget', {
				budget: {
					budgetType: 'COST',
					timeUnit: 'MONTHLY',
					budgetLimit: { amount: props.monthlyBudgetUSD, unit: 'USD' },
				},
				notificationsWithSubscribers: props.alarmEmail ? [
					{
						notification: { comparisonOperator: 'GREATER_THAN', threshold: 100, thresholdType: 'PERCENTAGE', notificationType: 'FORECASTED' },
						subscribers: [{ address: props.alarmEmail, subscriptionType: 'EMAIL' }],
					},
				] : undefined,
			});
		}
	}
}
