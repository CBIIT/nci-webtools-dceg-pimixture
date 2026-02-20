#!/bin/bash

# Wait for LocalStack to be ready
echo "Waiting for LocalStack to be ready..."
sleep 5

# Set AWS endpoint for LocalStack
export AWS_ACCESS_KEY_ID=test
export AWS_SECRET_ACCESS_KEY=test
export AWS_DEFAULT_REGION=us-east-1
ENDPOINT_URL="http://localhost:4566"

# Create SQS FIFO queue
echo "Creating SQS FIFO queue: pimixture.fifo..."
aws --endpoint-url=$ENDPOINT_URL sqs create-queue \
    --queue-name pimixture.fifo \
    --attributes FifoQueue=true \
    --region us-east-1

# Create S3 buckets
echo "Creating S3 bucket: pimixture2..."
aws --endpoint-url=$ENDPOINT_URL s3 mb s3://pimixture2 --region us-east-1

# Create folders in S3
echo "Creating S3 folders..."
aws --endpoint-url=$ENDPOINT_URL s3api put-object \
    --bucket pimixture2 \
    --key pimixture/input/ \
    --region us-east-1

aws --endpoint-url=$ENDPOINT_URL s3api put-object \
    --bucket pimixture2 \
    --key pimixture/output/ \
    --region us-east-1

echo "LocalStack initialization complete!"
echo ""
echo "SQS Queue URL:"
aws --endpoint-url=$ENDPOINT_URL sqs get-queue-url --queue-name pimixture.fifo --region us-east-1
echo ""
echo "S3 Buckets:"
aws --endpoint-url=$ENDPOINT_URL s3 ls
