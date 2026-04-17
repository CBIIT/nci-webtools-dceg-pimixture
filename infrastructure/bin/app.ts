#!/usr/bin/env node
import * as cdk from "aws-cdk-lib";
import {
  pimixtureStack,
  pimixtureStackProps,
  MicroserviceConfig,
} from "../lib/app-stack";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function required(name: string): string {
  const val = process.env[name];
  if (!val) throw new Error(`Missing required environment variable: ${name}`);
  return val;
}

function optional(name: string, fallback: string): string {
  return process.env[name] || fallback;
}

function num(name: string, fallback: number): number {
  const raw = process.env[name];
  return raw ? Number(raw) : fallback;
}

function bool(name: string, fallback: boolean): boolean {
  const raw = process.env[name];
  if (!raw) return fallback;
  return raw.toLowerCase() === "true" || raw === "1";
}

function csvList(name: string, fallback: string[] = []): string[] {
  const raw = process.env[name];
  if (!raw) return fallback;
  return raw.split(",").map((s) => s.trim()).filter(Boolean);
}

// ---------------------------------------------------------------------------
// App
// ---------------------------------------------------------------------------
const app = new cdk.App();
const tier = required("TIER");
const appName = optional("APP_NAME", "pimixture");
const awsRegion = optional("AWS_REGION", "us-east-1");
const accountId = required("AWS_ACCOUNT_ID");

const microservice: MicroserviceConfig = {
  name: optional("WEB_CONTAINER_NAME", "frontend"),
  port: num("WEB_CONTAINER_PORT", 80),
  healthCheckPath: optional("HEALTH_CHECK_PATH", "/ping"),
  imageUrl: required("WEB_IMAGE_URL"),
  cpu: num("WEB_CPU", 1024),
  memory: num("WEB_MEMORY", 2048),
  path: csvList("WEB_PATH", ["/"]),
  desiredCount: num("WEB_DESIRED_COUNT", 1),
  nonProdSchedule: bool("WEB_NON_PROD_SCHEDULE", true),
  enableAutoscaleCpu: bool("WEB_ENABLE_AUTOSCALE_CPU", false),
  enableAutoscaleMem: bool("WEB_ENABLE_AUTOSCALE_MEM", false),
};



const stackProps: pimixtureStackProps = {
  stackName: `${tier}-${appName}-service`,
  env: { account: accountId, region: awsRegion },

  tier,
  appName,
  appNamespace: optional("APP_NAMESPACE", "analysistools"),
  appService: optional("APP_SERVICE", "web"),
  appDomain: required("APP_DOMAIN"),
  appPath: optional("APP_PATH", ""),
  awslogsPrefix: optional("AWSLOGS_PREFIX", "frontend"),

  vpcId: required("VPC_ID"),
  subnetIds: csvList("SUBNET_IDS"),
  securityGroupIds: csvList("SECURITY_GROUP_IDS"),
  clusterArn: required("CLUSTER_ARN"),
  listenerArn: required("LISTENER_ARN"),
  appRoleArn: required("APP_ROLE_ARN"),

  healthCheckPath: optional("HEALTH_CHECK_PATH", "/ping"),
  gracePeriod: num("GRACE_PERIOD", 60),

  microservice,

  scheduledMinCapacity: num("SCHEDULED_MIN_CAPACITY", 1),
  scheduledMaxCapacity: num("SCHEDULED_MAX_CAPACITY", 1),

  autoscaleCpuMinCapacity: num("AUTOSCALE_CPU_MIN_CAPACITY", 0),
  autoscaleCpuMaxCapacity: num("AUTOSCALE_CPU_MAX_CAPACITY", 0),
  cpuTarget: num("CPU_TARGET", 0),

  autoscaleMemMinCapacity: num("AUTOSCALE_MEM_MIN_CAPACITY", 0),
  autoscaleMemMaxCapacity: num("AUTOSCALE_MEM_MAX_CAPACITY", 0),
  memTarget: num("MEM_TARGET", 0),


  listenerRulePriority: num("LISTENER_RULE_PRIORITY", 100),

  efsId: required("EFS_ID"),
  posixUid: num("POSIX_UID", 1000),
  posixGid: num("POSIX_GID", 1000),

  appEnvFile: required("APP_ENV_FILE"),
};

new pimixtureStack(app, `${tier}-${appName}-service`, stackProps);

app.synth();
