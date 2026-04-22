import * as fs from "fs";
import * as cdk from "aws-cdk-lib";
import * as ecs from "aws-cdk-lib/aws-ecs";
import * as ec2 from "aws-cdk-lib/aws-ec2";
import * as efs from "aws-cdk-lib/aws-efs";
import * as iam from "aws-cdk-lib/aws-iam";
import * as logs from "aws-cdk-lib/aws-logs";
import * as elbv2 from "aws-cdk-lib/aws-elasticloadbalancingv2";
import * as ssm from "aws-cdk-lib/aws-ssm";
import * as appscaling from "aws-cdk-lib/aws-applicationautoscaling";
import { Construct } from "constructs";

// ---------------------------------------------------------------------------
// Microservice shape
// ---------------------------------------------------------------------------
export interface MicroserviceConfig {
  name: string;
  port: number;
  healthCheckPath: string;
  imageUrl: string;
  cpu: number;
  memory: number;
  path: string[];
  desiredCount: number;
  nonProdSchedule: boolean;
  enableAutoscaleCpu: boolean;
  enableAutoscaleMem: boolean;
}

/**
 * Parse a .env file into key-value pairs.
 * Skips blank lines, comments (#), and lines without '='.
 */
function parseEnvFile(filePath: string): Record<string, string> {
  const content = fs.readFileSync(filePath, "utf-8");
  const result: Record<string, string> = {};
  for (const line of content.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eqIndex = trimmed.indexOf("=");
    if (eqIndex < 1) continue;
    const key = trimmed.slice(0, eqIndex).trim();
    const value = trimmed.slice(eqIndex + 1).trim();
    result[key] = value;
  }
  return result;
}

// ---------------------------------------------------------------------------
// Stack props
// ---------------------------------------------------------------------------
export interface pimixtureStackProps extends cdk.StackProps {
  tier: string;
  appName: string;
  appNamespace: string;
  appService: string;
  appDomain: string;
  appPath: string;
  awslogsPrefix: string;

  vpcId: string;
  subnetIds: string[];
  securityGroupIds: string[];
  clusterArn: string;
  listenerArn: string;
  appRoleArn: string;

  healthCheckPath: string;
  gracePeriod: number;

  /** Web microservice */
  microservice: MicroserviceConfig;

  /** Schedule scaling capacities */
  scheduledMinCapacity: number;
  scheduledMaxCapacity: number;

  /** CPU auto-scaling bounds */
  autoscaleCpuMinCapacity: number;
  autoscaleCpuMaxCapacity: number;
  cpuTarget: number;

  /** Memory auto-scaling bounds */
  autoscaleMemMinCapacity: number;
  autoscaleMemMaxCapacity: number;
  memTarget: number;

  /** EFS */
  efsId: string;
  posixUid: number;
  posixGid: number;

  /** Priority for the ALB listener rule */
  listenerRulePriority: number;

  /** Path to the application .env file whose key-value pairs become SSM parameters */
  appEnvFile: string;
}

// ---------------------------------------------------------------------------
// Stack
// ---------------------------------------------------------------------------
export class pimixtureStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props: pimixtureStackProps) {
    super(scope, id, props);

    const {
      tier,
      appName,
      appNamespace,
      appService,
      appDomain,
      appPath,
      awslogsPrefix,
      vpcId,
      subnetIds,
      securityGroupIds,
      clusterArn,
      listenerArn,
      appRoleArn,
      healthCheckPath,
      gracePeriod,
    } = props;

    // ------------------------------------------------------------------
    // Stack-level tags
    // ------------------------------------------------------------------
    const level = tier === "prod" ? "prod" : "nonprod";
    cdk.Tags.of(this).add("EnvironmentTier", tier);
    cdk.Tags.of(this).add("ResourceName", `${tier}-${appName}`);
    cdk.Tags.of(this).add("ManagedBy", "cdk");
    cdk.Tags.of(this).add("CreatedBy", "cdk");
    cdk.Tags.of(this).add("Project", "dceg-analysistools");
    cdk.Tags.of(this).add("Backup", level);
    cdk.Tags.of(this).add("PatchGroup", level);
    cdk.Tags.of(this).add("ApplicationName", appName);

    // ------------------------------------------------------------------
    // Import shared resources
    // ------------------------------------------------------------------
    const vpc = ec2.Vpc.fromLookup(this, "Vpc", { vpcId });

    const subnets = subnetIds.map((sid, i) =>
      ec2.Subnet.fromSubnetId(this, `Subnet${i}`, sid)
    );

    const securityGroups = securityGroupIds.map((sgId, i) =>
      ec2.SecurityGroup.fromSecurityGroupId(this, `SG${i}`, sgId)
    );

    const clusterName = cdk.Arn.split(
      clusterArn,
      cdk.ArnFormat.SLASH_RESOURCE_NAME
    ).resourceName!;
    const cluster = ecs.Cluster.fromClusterAttributes(this, "Cluster", {
      clusterName,
      clusterArn,
      vpc,
      securityGroups,
    });
    const executionRole = iam.Role.fromRoleArn(
      this,
      "ExecutionRole",
      appRoleArn
    );
    const taskRole = iam.Role.fromRoleArn(this, "TaskRole", appRoleArn);

    const listener =
      elbv2.ApplicationListener.fromApplicationListenerAttributes(
        this,
        "Listener",
        {
          listenerArn,
          securityGroup: securityGroups[0],
        }
      );

    // ==================================================================
    // 1. ECS Web Service
    // ==================================================================
    const ms = props.microservice;

    const logGroup = new logs.LogGroup(this, "WebLogGroup", {
      logGroupName: `/${appNamespace}/${tier}/${appName}/web`,
      retention: logs.RetentionDays.SIX_MONTHS,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    const taskDef = new ecs.FargateTaskDefinition(this, "WebTaskDef", {
      family: `${tier}-${appName}-${appService}`,
      cpu: ms.cpu,
      memoryLimitMiB: ms.memory,
      executionRole,
      taskRole,
    });

    taskDef.addContainer("WebContainer", {
      containerName: ms.name,
      image: ecs.ContainerImage.fromRegistry(ms.imageUrl),
      essential: true,
      portMappings: [
        {
          containerPort: ms.port,
          hostPort: ms.port,
          protocol: ecs.Protocol.TCP,
        },
      ],
      logging: ecs.LogDrivers.awsLogs({
        logGroup,
        streamPrefix: awslogsPrefix,
      }),
    });

    const tg = new elbv2.ApplicationTargetGroup(this, "WebTG", {
      targetGroupName: `${tier}-${appName}-${appService}`,
      port: 80,
      protocol: elbv2.ApplicationProtocol.HTTP,
      targetType: elbv2.TargetType.IP,
      vpc,
      healthCheck: {
        enabled: true,
        path: healthCheckPath,
        port: "80",
      },
    });

    const conditions: elbv2.ListenerCondition[] = [
      elbv2.ListenerCondition.hostHeaders([appDomain]),
    ];
    if (appPath) {
      conditions.push(elbv2.ListenerCondition.pathPatterns([`${appPath}/*`]));
    } else {
      conditions.push(elbv2.ListenerCondition.pathPatterns(["/*"]));
    }

    listener.addTargetGroups("WebListenerRule", {
      targetGroups: [tg],
      conditions,
      priority: props.listenerRulePriority,
    });

    const service = new ecs.FargateService(this, "WebService", {
      serviceName: `${tier}-${appName}-${appService}`,
      cluster,
      taskDefinition: taskDef,
      desiredCount: ms.desiredCount,
      securityGroups,
      vpcSubnets: { subnets },
      assignPublicIp: false,
      enableECSManagedTags: true,
      enableExecuteCommand: true,
      circuitBreaker: { rollback: true },
      healthCheckGracePeriod: cdk.Duration.seconds(gracePeriod),
      propagateTags: ecs.PropagatedTagSource.TASK_DEFINITION,
    });

    service.attachToApplicationTargetGroup(tg);

    // Use family name only (no revision) so CFN resolves to the latest active revision,
    // preventing revert of task definitions registered by CI/CD deploy workflows.
    // Remove DesiredCount so CFN preserves the current running value.
    const cfnService = service.node.defaultChild as ecs.CfnService;
    cfnService.addPropertyOverride(
      "TaskDefinition",
      `${tier}-${appName}-${appService}`
    );
    cfnService.addPropertyDeletionOverride("DesiredCount");

    // --- Auto-scaling (single ScalableTarget shared by all policies) ---
    const needsScaling =
      ms.nonProdSchedule ||
      (ms.enableAutoscaleCpu && props.cpuTarget > 0) ||
      (ms.enableAutoscaleMem && props.memTarget > 0);

    if (needsScaling) {
      const maxCaps = [
        ms.nonProdSchedule ? props.scheduledMaxCapacity : 0,
        ms.enableAutoscaleCpu && props.cpuTarget > 0
          ? props.autoscaleCpuMaxCapacity
          : 0,
        ms.enableAutoscaleMem && props.memTarget > 0
          ? props.autoscaleMemMaxCapacity
          : 0,
      ];
      const minCaps = [
        ms.nonProdSchedule ? props.scheduledMinCapacity : undefined,
        ms.enableAutoscaleCpu && props.cpuTarget > 0
          ? props.autoscaleCpuMinCapacity
          : undefined,
        ms.enableAutoscaleMem && props.memTarget > 0
          ? props.autoscaleMemMinCapacity
          : undefined,
      ].filter((v): v is number => v !== undefined);

      const scalable = service.autoScaleTaskCount({
        minCapacity: Math.min(...minCaps),
        maxCapacity: Math.max(...maxCaps),
      });

      if (ms.nonProdSchedule) {
        scalable.scaleOnSchedule("WebScaleOut", {
          schedule: appscaling.Schedule.cron({
            hour: "7",
            minute: "0",
            weekDay: "MON-FRI",
          }),
          minCapacity: props.scheduledMinCapacity,
          maxCapacity: props.scheduledMaxCapacity,
          timeZone: cdk.TimeZone.AMERICA_NEW_YORK,
        });
        scalable.scaleOnSchedule("WebScaleIn", {
          schedule: appscaling.Schedule.cron({
            hour: "19",
            minute: "0",
            weekDay: "MON-FRI",
          }),
          minCapacity: 0,
          maxCapacity: 0,
          timeZone: cdk.TimeZone.AMERICA_NEW_YORK,
        });
      }

      if (ms.enableAutoscaleCpu && props.cpuTarget > 0) {
        scalable.scaleOnCpuUtilization("WebCpuScale", {
          targetUtilizationPercent: props.cpuTarget,
          scaleInCooldown: cdk.Duration.seconds(60),
          scaleOutCooldown: cdk.Duration.seconds(60),
        });
      }

      if (ms.enableAutoscaleMem && props.memTarget > 0) {
        scalable.scaleOnMemoryUtilization("WebMemScale", {
          targetUtilizationPercent: props.memTarget,
          scaleInCooldown: cdk.Duration.seconds(60),
          scaleOutCooldown: cdk.Duration.seconds(60),
        });
      }
    }

    new cdk.CfnOutput(this, "WebServiceName", { value: service.serviceName });
    new cdk.CfnOutput(this, "WebTaskDefArn", {
      value: taskDef.taskDefinitionArn,
    });

    // ==================================================================
    // 2. EFS Access Point + SSM params for EFS IDs
    // ==================================================================
    const cfnAccessPoint = new efs.CfnAccessPoint(this, "EfsAccessPoint", {
      fileSystemId: props.efsId,
      posixUser: {
        uid: props.posixUid.toString(),
        gid: props.posixGid.toString(),
      },
      rootDirectory: {
        path: `/${appName}`,
        creationInfo: {
          ownerUid: props.posixUid.toString(),
          ownerGid: props.posixGid.toString(),
          permissions: "0755",
        },
      },
      accessPointTags: [
        { key: "Name", value: `${tier}-${appName}-efs-access-point` },
        { key: "ApplicationName", value: appName },
        { key: "Project", value: "dceg-analysistools" },
        { key: "CreatedBy", value: "cdk" },
        { key: "EnvironmentTier", value: tier.toUpperCase() },
        { key: "ResourceFunction", value: "efs" },
        { key: "ResourceName", value: `${tier}-${appName}-${appService}` },
      ],
    });

    new ssm.StringParameter(this, "SsmEfsAccessPointId", {
      parameterName: `/${appNamespace}/${tier}/${appName}/efs_access_point_id`,
      stringValue: cfnAccessPoint.attrAccessPointId,
      description: `EFS Access Point ID for ${appName} in ${tier}`,
    });

    new ssm.StringParameter(this, "SsmEfsFilesystemId", {
      parameterName: `/${appNamespace}/${tier}/${appName}/efs_filesystem_id`,
      stringValue: props.efsId,
      description: `EFS File System ID for ${appName} in ${tier}`,
    });

    new cdk.CfnOutput(this, "EfsAccessPointId", {
      value: cfnAccessPoint.attrAccessPointId,
    });

    // ==================================================================
    // 3. SSM Parameters (from app.env file)
    // ==================================================================
    const appEnvVars = parseEnvFile(props.appEnvFile);
    for (const [key, value] of Object.entries(appEnvVars)) {
      const paramName = key.toLowerCase();
      new ssm.StringParameter(this, `SsmParam-${paramName}`, {
        parameterName: `/${appNamespace}/${tier}/${appName}/${paramName}`,
        stringValue: value,
      });
    }
  }
}
