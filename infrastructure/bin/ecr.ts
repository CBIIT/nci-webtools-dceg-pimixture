#!/usr/bin/env node
import * as cdk from "aws-cdk-lib";
import { EcrStack } from "../lib/ecr-stack";

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

const app = new cdk.App();
const tier = required("TIER");
const appName = optional("APP_NAME", "pimixture");

new EcrStack(app, `${tier}-${appName}-ecr`, {
  stackName: `${tier}-${appName}-ecr`,
  env: {
    account: required("AWS_ACCOUNT_ID"),
    region: optional("AWS_REGION", "us-east-1"),
  },
  tier,
  appName,
  appNamespace: optional("APP_NAMESPACE", "analysistools"),
  ecrRepoName: optional("ECR_REPO_NAME", appName),
  ecrCountNumber: num("ECR_COUNT_NUMBER", 30),
});

app.synth();
