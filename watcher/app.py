"""Pulse read-only AWS watcher.

A tiny Flask service that surfaces a handful of CloudWatch / RDS-describe metrics
for the AP money stack (EC2 box + RDS instance) so the Pulse dashboard can DISPLAY
infra health. It is strictly READ-ONLY: boto3 CloudWatch get_metric_statistics +
rds.describe_db_instances only. No writes, no SMTP, no DB, no prod box.

Graceful degradation is the core contract: if AWS creds/metrics are missing or any
call fails, the affected metric comes back value:null, status:"unknown", error:"…".
GET /status is ALWAYS HTTP 200 (never 500), GET /health never touches AWS.
"""

import os
from datetime import datetime, timezone, timedelta

import boto3
from botocore.exceptions import BotoCoreError, ClientError, NoCredentialsError
from flask import Flask, jsonify

app = Flask(__name__)

# ---- Configuration (read at request time via the helpers below) -------------
REGION       = os.environ.get("REGION", "eu-west-1")
EC2_ID       = os.environ.get("EC2_INSTANCE_ID", "i-0dadf7387aadf83c0")
RDS_ID       = os.environ.get("RDS_INSTANCE_ID", "ap-automation-db")
CONN_CEILING = int(os.environ.get("RDS_CONN_CEILING", "80"))
PERIOD       = 300  # 5-min buckets (matches basic-monitoring cadence)

# ---- Thresholds -------------------------------------------------------------
CPU_WARN, CPU_CRIT   = 70, 90   # EC2 + RDS CPU %
DISK_WARN, DISK_CRIT = 75, 90   # RDS disk used %


def _conn_thresholds():
    """Connection warn/crit derived from the ceiling so they track the env var."""
    return round(CONN_CEILING * 0.75), round(CONN_CEILING * 0.90)


# ---- CloudWatch read helper -------------------------------------------------
def _latest(client, namespace, metric, dimensions, stat="Average", unit=None):
    """Return (value, error). value = most-recent datapoint's `stat` over a
    10-minute window at 300s period, or None with an error string. Never raises."""
    end = datetime.now(timezone.utc)
    start = end - timedelta(minutes=10)
    kwargs = dict(
        Namespace=namespace,
        MetricName=metric,
        Dimensions=dimensions,
        StartTime=start,
        EndTime=end,
        Period=PERIOD,
        Statistics=[stat],
    )
    if unit:
        kwargs["Unit"] = unit
    try:
        resp = client.get_metric_statistics(**kwargs)
        points = resp.get("Datapoints", [])
        if not points:
            return None, "no datapoints in window"
        points.sort(key=lambda p: p["Timestamp"])
        return points[-1][stat], None
    except (BotoCoreError, ClientError, NoCredentialsError) as e:
        return None, str(e)
    except Exception as e:  # belt + suspenders — never raise out of a metric read
        return None, str(e)


# ---- Status classification --------------------------------------------------
def classify(value, warn, crit):
    if value is None:
        return "unknown"
    if value >= crit:
        return "critical"
    if value >= warn:
        return "warn"
    return "healthy"


# ---- Per-metric builders ----------------------------------------------------
def _ec2_cpu(cw):
    val, err = _latest(
        cw, "AWS/EC2", "CPUUtilization",
        [{"Name": "InstanceId", "Value": EC2_ID}],
        stat="Average", unit="Percent",
    )
    value = round(val, 1) if val is not None else None
    return {
        "label": "EC2 CPU",
        "value": value,
        "unit": "%",
        "status": classify(value, CPU_WARN, CPU_CRIT),
        "thresholds": {"warn": CPU_WARN, "critical": CPU_CRIT},
        "error": err,
        "instance_id": EC2_ID,
    }


def _rds_cpu(cw):
    val, err = _latest(
        cw, "AWS/RDS", "CPUUtilization",
        [{"Name": "DBInstanceIdentifier", "Value": RDS_ID}],
        stat="Average", unit="Percent",
    )
    value = round(val, 1) if val is not None else None
    return {
        "label": "RDS CPU",
        "value": value,
        "unit": "%",
        "status": classify(value, CPU_WARN, CPU_CRIT),
        "thresholds": {"warn": CPU_WARN, "critical": CPU_CRIT},
        "error": err,
        "instance_id": RDS_ID,
    }


def _rds_disk(cw, rds):
    free_bytes, cw_err = _latest(
        cw, "AWS/RDS", "FreeStorageSpace",
        [{"Name": "DBInstanceIdentifier", "Value": RDS_ID}],
        stat="Average", unit="Bytes",
    )

    allocated_gb = None
    describe_err = None
    try:
        resp = rds.describe_db_instances(DBInstanceIdentifier=RDS_ID)
        allocated_gb = resp["DBInstances"][0]["AllocatedStorage"]  # GB int
    except (BotoCoreError, ClientError, NoCredentialsError) as e:
        describe_err = str(e)
    except Exception as e:
        describe_err = str(e)

    value = free_gb = total_gb = used_gb = None
    status = "unknown"
    # carry whichever error explains the missing data
    error = cw_err or describe_err

    if free_bytes is not None and allocated_gb is not None:
        total_gb = allocated_gb
        free_gb = round(free_bytes / 1_000_000_000, 1)
        used_gb = round(total_gb - free_gb, 1)
        used_pct = round(used_gb / total_gb * 100, 1) if total_gb else None
        value = used_pct
        status = classify(value, DISK_WARN, DISK_CRIT)
        error = None

    return {
        "label": "RDS Disk",
        "value": value,
        "unit": "%",
        "status": status,
        "thresholds": {"warn": DISK_WARN, "critical": DISK_CRIT},
        "free_gb": free_gb,
        "total_gb": total_gb,
        "used_gb": used_gb,
        "error": error,
    }


def _rds_connections(cw):
    val, err = _latest(
        cw, "AWS/RDS", "DatabaseConnections",
        [{"Name": "DBInstanceIdentifier", "Value": RDS_ID}],
        stat="Average", unit="Count",
    )
    warn, crit = _conn_thresholds()
    value = round(val) if val is not None else None
    return {
        "label": "RDS Connections",
        "value": value,
        "unit": "count",
        "status": classify(value, warn, crit),
        "thresholds": {"warn": warn, "critical": crit},
        "ceiling": CONN_CEILING,
        "error": err,
    }


def _build_metrics(cw, rds):
    return {
        "ec2_cpu": _ec2_cpu(cw),
        "rds_cpu": _rds_cpu(cw),
        "rds_disk": _rds_disk(cw, rds),
        "rds_connections": _rds_connections(cw),
    }


def _all_unknown(err):
    """Four-key metrics object, every metric unknown, static fields populated.

    Used when even constructing the boto3 clients fails (bad region, etc.)."""
    warn, crit = _conn_thresholds()
    return {
        "ec2_cpu": {
            "label": "EC2 CPU",
            "value": None,
            "unit": "%",
            "status": "unknown",
            "thresholds": {"warn": CPU_WARN, "critical": CPU_CRIT},
            "error": err,
            "instance_id": EC2_ID,
        },
        "rds_cpu": {
            "label": "RDS CPU",
            "value": None,
            "unit": "%",
            "status": "unknown",
            "thresholds": {"warn": CPU_WARN, "critical": CPU_CRIT},
            "error": err,
            "instance_id": RDS_ID,
        },
        "rds_disk": {
            "label": "RDS Disk",
            "value": None,
            "unit": "%",
            "status": "unknown",
            "thresholds": {"warn": DISK_WARN, "critical": DISK_CRIT},
            "free_gb": None,
            "total_gb": None,
            "used_gb": None,
            "error": err,
        },
        "rds_connections": {
            "label": "RDS Connections",
            "value": None,
            "unit": "count",
            "status": "unknown",
            "thresholds": {"warn": warn, "critical": crit},
            "ceiling": CONN_CEILING,
            "error": err,
        },
    }


@app.get("/health")
def health():
    # Liveness only — does NOT call AWS, so it stays green even without creds.
    return jsonify({"status": "ok", "service": "pulse-watcher"}), 200


@app.get("/status")
def status():
    gen = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
    try:
        cw = boto3.client("cloudwatch", region_name=REGION)
        rds = boto3.client("rds", region_name=REGION)
        metrics = _build_metrics(cw, rds)
    except Exception as e:  # creds/region/client-construction — degrade, never 500
        metrics = _all_unknown(str(e))
    return jsonify({"generated_at": gen, "region": REGION, "metrics": metrics}), 200


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5055)
