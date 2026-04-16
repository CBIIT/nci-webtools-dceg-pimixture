#!/bin/bash
# =============================================================================
# PIMixture Container Entrypoint
# =============================================================================
# Generates /app/config.ini from environment variables injected by ECS (SSM),
# then dispatches to the web server or queue worker based on RUN_MODE.
#
# RUN_MODE=web    (default) — starts mod_wsgi Flask server
# RUN_MODE=worker           — starts pimixtureProcessor.py SQS worker
#
# SKIP_CONFIG_GEN=true      — skip config.ini generation (local dev only:
#                             mount your own config.ini via docker-compose)
# =============================================================================

set -euo pipefail

RUN_MODE="${RUN_MODE:-web}"
SKIP_CONFIG_GEN="${SKIP_CONFIG_GEN:-false}"

# ---------------------------------------------------------------------------
# Generate config.ini from SSM-injected env vars (skipped in local dev)
# ---------------------------------------------------------------------------
if [ "$SKIP_CONFIG_GEN" = "true" ]; then
    echo "SKIP_CONFIG_GEN=true: using pre-existing config.ini"
    if [ ! -f /app/config.ini ]; then
        echo "ERROR: SKIP_CONFIG_GEN=true but /app/config.ini does not exist" >&2
        exit 1
    fi
else
    # Validate all required env vars before writing anything
    : "${EMAIL_SMTP_HOST:?EMAIL_SMTP_HOST is required}"
    : "${EMAIL_ADMIN:?EMAIL_ADMIN is required}"
    : "${EMAIL_SENDER:?EMAIL_SENDER is required}"
    : "${EMAIL_REPORT_URL:?EMAIL_REPORT_URL is required}"
    : "${S3_INPUT_BUCKET:?S3_INPUT_BUCKET is required}"
    : "${S3_OUTPUT_BUCKET:?S3_OUTPUT_BUCKET is required}"
    : "${S3_INPUT_FOLDER:?S3_INPUT_FOLDER is required}"
    : "${S3_OUTPUT_FOLDER:?S3_OUTPUT_FOLDER is required}"
    : "${S3_URL_EXPIRE_TIME:?S3_URL_EXPIRE_TIME is required}"
    : "${SQS_QUEUE_NAME:?SQS_QUEUE_NAME is required}"
    : "${SQS_VISIBILITY_TIMEOUT:?SQS_VISIBILITY_TIMEOUT is required}"
    : "${SQS_QUEUE_LONG_PULL_TIME:?SQS_QUEUE_LONG_PULL_TIME is required}"
    : "${R_FITTING_TIMEOUT:?R_FITTING_TIMEOUT is required}"
    : "${LOG_LEVEL:?LOG_LEVEL is required}"

    cat > /app/config.ini << EOF
[mail]
host = ${EMAIL_SMTP_HOST}
admin = ${EMAIL_ADMIN}
sender = ${EMAIL_SENDER}
report_url = ${EMAIL_REPORT_URL}

[folders]
input_data_path = /app/tmp/input_data
output_data_path = /app/tmp/output_data

[log]
log_level = ${LOG_LEVEL}
log_folder =
log_file_name = pimixture-app.log
processor_log_file_name = pimixture-processor.log

[prefixes]
input_file_prefix = pimixtureInput_
output_file_prefix = pimixtureOutput_

[suffixes]
fitting_r_suffix = _fit
fitting_ss_suffix = _fit_results
prediction_suffix = _prediction

[output]
file_type = EXCEL

[s3]
input_bucket = ${S3_INPUT_BUCKET}
output_bucket = ${S3_OUTPUT_BUCKET}
input_folder = ${S3_INPUT_FOLDER}
output_folder = ${S3_OUTPUT_FOLDER}
url_expire_time = ${S3_URL_EXPIRE_TIME}

[sqs]
queue_name = ${SQS_QUEUE_NAME}
visibility_timeout = ${SQS_VISIBILITY_TIMEOUT}
queue_long_pull_time = ${SQS_QUEUE_LONG_PULL_TIME}

[R]
fitting_timeout = ${R_FITTING_TIMEOUT}
EOF

    echo "config.ini generated at /app/config.ini"
fi

# ---------------------------------------------------------------------------
# Dispatch
# ---------------------------------------------------------------------------
if [ "$RUN_MODE" = "worker" ]; then
    echo "Starting PIMixture SQS worker (stdout logging)..."
    # exec replaces the shell so signals (SIGTERM) reach the Python process.
    # Output goes to stdout/stderr so Fluent Bit can forward to Datadog.
    exec python3 -u /app/pimixtureProcessor.py
else
    echo "Starting PIMixture web server..."
    exec mod_wsgi-express start-server /app/pimixture.wsgi \
        --user apache \
        --group apache \
        --port 80 \
        --processes 4 \
        --threads 1 \
        --max-clients 3000 \
        --socket-timeout 900 \
        --queue-timeout 900 \
        --shutdown-timeout 900 \
        --graceful-timeout 900 \
        --connect-timeout 900 \
        --request-timeout 900 \
        --keep-alive-timeout 60 \
        --compress-responses \
        --log-to-terminal \
        --access-log \
        --access-log-format "%h %{X-Forwarded-For}i %l %u %t \"%r\" %>s %b \"%{Referer}i\" \"%{User-Agent}i\"" combined \
        --document-root /app \
        --working-directory /app
fi
