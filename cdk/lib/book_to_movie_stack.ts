import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as rds from 'aws-cdk-lib/aws-rds';
import * as secretsmanager from 'aws-cdk-lib/aws-secretsmanager';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as logs from 'aws-cdk-lib/aws-logs';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as apigw from 'aws-cdk-lib/aws-apigateway';
import { RemovalPolicy } from 'aws-cdk-lib';

export class BookToMovieStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // VPC
    const vpc = new ec2.Vpc(this, 'BookToMovieVPC', {
      maxAzs: 2
    });

    // Secret to hold DB credentials
    const dbSecret = new secretsmanager.Secret(this, 'DBSecret', {
      generateSecretString: {
        secretStringTemplate: JSON.stringify({
          username: 'postgres'
        }),
        generateStringKey: 'password',
        excludePunctuation: true,
        includeSpace: false
      }
    });

    // Aurora Serverless v2 cluster
    const cluster = new rds.ServerlessCluster(this, 'BookToMovieCluster', {
      engine: rds.DatabaseClusterEngine.AURORA_POSTGRESQL,
      vpc,
      defaultDatabaseName: 'book_to_movie',
      credentials: rds.Credentials.fromSecret(dbSecret),
      scaling: {
        autoPause: cdk.Duration.minutes(10), // pause if no connections
        minCapacity: rds.AuroraCapacityUnit.ACU_2,
        maxCapacity: rds.AuroraCapacityUnit.ACU_4
      },
      removalPolicy: RemovalPolicy.DESTROY // not for production
    });

    // Lambda for Express
    const lambdaFn = new lambda.Function(this, 'BookToMovieLambda', {
      runtime: lambda.Runtime.NODEJS_18_X,
      code: lambda.Code.fromAsset('../'), // Path to the Node project root
      handler: 'src/lambda.handler',
      timeout: cdk.Duration.seconds(30),
      logRetention: logs.RetentionDays.ONE_WEEK,
      memorySize: 1024,
      vpc,
      environment: {
        // pass the DB connection info
        DB_USER: 'postgres',
        DB_HOST: cluster.clusterEndpoint.hostname,
        DB_NAME: 'book_to_movie',
        DB_PASSWORD: dbSecret.secretValueFromJson('password').unsafeUnwrap(), // or use better approach
        DB_PORT: '5432',
        JWT_SECRET: 'supersecretjwt' // or store in Secrets Manager
      }
    });

    // Permissions for lambda to access the cluster & secret
    cluster.connections.allowDefaultPortFrom(lambdaFn);
    dbSecret.grantRead(lambdaFn);

    // Create an API Gateway
    const api = new apigw.LambdaRestApi(this, 'BookToMovieApi', {
      handler: lambdaFn,
      proxy: true, // all routes handled by Express
      restApiName: 'BookToMovieService'
    });

    // Output the API endpoint
    new cdk.CfnOutput(this, 'ApiEndpoint', {
      value: api.url
    });
  }
}
