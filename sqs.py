#!/usr/bin/env python
import boto3
import json
from pprint import pprint

QUEUE_NAME = 'pimixture'
QUEUE_MSG_RETENTION_SECONDS = '1209600'
QUEUE_LONG_PULL_TIME = '20'

class SQS:
    def __init__(self, queName=QUEUE_NAME, longPullTime=QUEUE_LONG_PULL_TIME, msgRetentionTime=QUEUE_MSG_RETENTION_SECONDS):
        self.sqs = boto3.resource('sqs')
        self.queue = self.sqs.create_queue(
            QueueName=queName,
            Attributes={
                'ReceiveMessageWaitTimeSeconds': longPullTime,
                'MessageRetentionPeriod': msgRetentionTime
            })

    def sendMsgToQueue(self, msg):
        response = self.queue.send_message(MessageBody=json.dumps(msg))
        print(response.get('MessageId'))

    def receiveMsgs(self):
        return self.queue.receive_messages()
