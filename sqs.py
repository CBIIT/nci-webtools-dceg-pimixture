#!/usr/bin/env python
import boto3
import json
from pprint import pprint
from threading import Timer

QUEUE_NAME = 'pimixture.fifo'
QUEUE_MSG_RETENTION_SECONDS = '1209600'
QUEUE_LONG_PULL_TIME = '20'
QUEUE_MESSAGE_GROUP_ID = 'fitting'

class Queue:
    def __init__(self, queName=QUEUE_NAME, longPullTime=QUEUE_LONG_PULL_TIME, msgRetentionTime=QUEUE_MSG_RETENTION_SECONDS):
        self.sqs = boto3.resource('sqs')
        self.queue = self.sqs.create_queue(
            QueueName=queName,
            Attributes={
                'FifoQueue': 'true',
                'ReceiveMessageWaitTimeSeconds': longPullTime,
                'MessageRetentionPeriod': msgRetentionTime
            })

    def sendMsgToQueue(self, msg, id):
        response = self.queue.send_message(MessageBody=json.dumps(msg),
                                           MessageGroupId=QUEUE_MESSAGE_GROUP_ID,
                                           MessageDeduplicationId=id)
        print(response.get('MessageId'))

    def receiveMsgs(self, visibilityTimeOut):
        return self.queue.receive_messages(VisibilityTimeout = visibilityTimeOut)

# Automatically extend visibility timeout every timeOutValue/2 seconds
class VisibilityExtender:
    def __init__(self, msg, timeOutValue):
        self._timeOutValue = timeOutValue if timeOutValue > 2 else 2
        self._currentTimeOut = self._timeOutValue
        self._interval = timeOutValue / 2 if timeOutValue > 2 else 1
        self._msg = msg
        self._timer = None
        self.is_running = False
        self.start()

    def _run(self):
        if self._msg:
            self.is_running = False
            self.start()
            self._currentTimeOut += self._interval
            self._msg.change_visibility(VisibilityTimeout = self._currentTimeOut)

    def start(self):
        if not self.is_running:
            self._timer = Timer(self._interval, self._run)
            self._timer.start()
            self.is_running = True

    def stop(self):
        self._timer.cancel()
        self.is_running = False
