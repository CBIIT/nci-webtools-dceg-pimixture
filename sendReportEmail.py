#!/usr/bin/env python

import argparse
from util import *


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('-d', '--debug', action = 'store_true', help = 'Enables debugging')
    args = parser.parse_args()
    if (args.debug):
        log = getConsoleLogger(stdFormatter)
    else:
        log = getFileLogger(processorLogFileName)

    try:
        subject = 'PIMixture Web Traffic Report'

        content = '<p>Dear Admin,</p>'
        content += '<p>Please find PIMixture Web Traffic Report <a href="{}" target="_blank">here.</a></p>'.format(REPORT_URL)
        content += '<br><p>Respectfully,</p>'
        content += '<p>PIMixture Web Tool</p>'

        log.info('Sending PIMixture Traffic Report email to admin(s)...')
        send_mail(SENDER, ADMIN, subject, content, log)
        log.info('Traffic Report email sent.')
    except Exception as e:
        log.info('Send PIMixture Traffic Report email FAILED')
        log.error(e)
