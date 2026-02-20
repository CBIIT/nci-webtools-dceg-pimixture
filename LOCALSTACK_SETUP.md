# Running PIMixture with LocalStack (Local SQS/S3)

This guide explains how to run the PIMixture application locally with LocalStack emulating AWS SQS and S3 services.

## Prerequisites

- Docker and Docker Compose installed
- AWS CLI installed (for initialization script)

Install AWS CLI if needed:
```bash
pip install awscli
```

## Architecture

The local setup includes:
- **LocalStack**: Emulates AWS SQS and S3 services
- **PIMixture Web App**: Flask application serving the web interface
- **Processor**: Background worker that consumes jobs from SQS queue

## Quick Start

### 1. Start all services

```bash
docker-compose up -d
```

This will start:
- LocalStack on port 4566
- PIMixture web app on port 8220
- Processor service (background worker)

### 2. Initialize LocalStack (First time only)

After LocalStack is running, execute the initialization script:

```bash
./init-localstack.sh
```

This creates:
- SQS FIFO queue: `pimixture.fifo`
- S3 bucket: `pimixture2` with folders:
  - `pimixture/input/`
  - `pimixture/output/`

### 3. Access the application

Open your browser and navigate to:
```
http://localhost:8220
```

## Configuration

The application uses environment variables to connect to LocalStack:

```bash
AWS_ENDPOINT_URL=http://localstack:4566
AWS_ACCESS_KEY_ID=test
AWS_SECRET_ACCESS_KEY=test
AWS_DEFAULT_REGION=us-east-1
```

These are already configured in [docker-compose.yml](docker-compose.yml).

## Monitoring

### View logs

```bash
# All services
docker-compose logs -f

# Specific service
docker-compose logs -f pimixture
docker-compose logs -f processor
docker-compose logs -f localstack
```

### Check SQS queue

```bash
# Queue attributes
aws --endpoint-url=http://localhost:4566 sqs get-queue-attributes \
    --queue-url http://localhost:4566/000000000000/pimixture.fifo \
    --attribute-names All

# Number of messages
aws --endpoint-url=http://localhost:4566 sqs get-queue-attributes \
    --queue-url http://localhost:4566/000000000000/pimixture.fifo \
    --attribute-names ApproximateNumberOfMessages
```

### Check S3 buckets

```bash
# List buckets
aws --endpoint-url=http://localhost:4566 s3 ls

# List bucket contents
aws --endpoint-url=http://localhost:4566 s3 ls s3://pimixture2/pimixture/input/
aws --endpoint-url=http://localhost:4566 s3 ls s3://pimixture2/pimixture/output/
```

## Running Without Queue (Direct Processing)

If you want to run without SQS (synchronous processing), you can:

1. Stop the processor and localstack services:
   ```bash
   docker-compose stop processor localstack
   ```

2. Update the web app environment to remove AWS_ENDPOINT_URL or run with:
   ```bash
   docker-compose up pimixture
   ```

3. Ensure frontend sends `sendToQueue: false` in request parameters

## Troubleshooting

### LocalStack not starting
```bash
docker-compose logs localstack
```

Check if port 4566 is already in use:
```bash
lsof -i :4566
```

### Queue not found error
Run the initialization script again:
```bash
./init-localstack.sh
```

### Processor not processing jobs
Check processor logs:
```bash
docker-compose logs processor
```

Verify the queue has messages:
```bash
aws --endpoint-url=http://localhost:4566 sqs receive-message \
    --queue-url http://localhost:4566/000000000000/pimixture.fifo
```

### Services can't connect to LocalStack
Ensure all services are on the same Docker network:
```bash
docker-compose ps
docker network ls
```

## Stopping the Services

```bash
# Stop all services
docker-compose down

# Stop and remove volumes (clean slate)
docker-compose down -v
```

## Development vs Production

### Local Development (with LocalStack)
- Uses fake AWS credentials
- Data stored in LocalStack (ephemeral)
- No AWS costs
- Perfect for testing

### Production (with AWS)
- Remove or don't set `AWS_ENDPOINT_URL`
- Use real AWS credentials
- Configure proper IAM roles
- Update docker-compose.yml to use real AWS services

## Additional Resources

- [LocalStack Documentation](https://docs.localstack.cloud/)
- [AWS CLI with LocalStack](https://docs.localstack.cloud/user-guide/integrations/aws-cli/)
- [PIMixture README](readme.md)
