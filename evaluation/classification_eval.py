#!/usr/bin/env python3
"""Evaluate the backend rules and LLM classifiers against labeled_sites.csv."""

import argparse
import csv
import json
import statistics
import sys
import time
from pathlib import Path

import matplotlib.pyplot as plt
import requests
from sklearn.metrics import accuracy_score, classification_report, confusion_matrix, ConfusionMatrixDisplay

LABELS = ["STUDY", "WORK", "ENTERTAINMENT", "SOCIAL", "OTHER"]
HERE = Path(__file__).resolve().parent


def load_rows(path):
    with path.open(newline="", encoding="utf-8-sig") as handle:
        rows = list(csv.DictReader(handle))
    required = {"domain", "title", "true_category"}
    if not rows or not required.issubset(rows[0]):
        raise ValueError(f"{path} must have columns: domain,title,true_category")
    for row in rows:
        row["true_category"] = row["true_category"].strip().upper()
        if row["true_category"] not in LABELS:
            raise ValueError(f"Unknown true_category: {row['true_category']}")
    return rows


def classify(base_url, row, classifier):
    started = time.perf_counter()
    response = requests.get(
        f"{base_url.rstrip('/')}/api/classify",
        params={"domain": row["domain"], "title": row["title"], "classifier": classifier, "useCache": "false"},
        timeout=60,
    )
    latency_ms = (time.perf_counter() - started) * 1000
    response.raise_for_status()
    payload = response.json()
    category = str(payload.get("category", "OTHER")).upper()
    if category not in LABELS:
        category = "OTHER"
    return category, latency_ms, int(payload.get("apiCalls", 0))


def load_predictions(path, rows):
    if not path:
        return None
    saved = load_rows(path)
    if len(saved) != len(rows):
        raise ValueError("Prediction CSV must have the same number of rows as the labeled input")
    predictions = {"rules": [], "llm": [[], [], []], "latencies": {"rules": [], "llm": [[], [], []]}, "api_calls": {"rules": 0, "llm": [0, 0, 0]}}
    for source, row in zip(saved, rows):
        if source["domain"] != row["domain"] or source["title"] != row["title"]:
            raise ValueError("Prediction CSV rows must match input domain/title order")
        rules = source.get("rules_prediction", "").strip().upper()
        if rules not in LABELS:
            raise ValueError("Saved predictions require rules_prediction")
        predictions["rules"].append(rules)
        for run in range(1, 4):
            field = f"llm_prediction_{run}"
            value = source.get(field, "").strip().upper()
            if value not in LABELS:
                raise ValueError(f"Saved predictions require {field}")
            predictions["llm"][run - 1].append(value)
        if source.get("rules_latency_ms"):
            predictions["latencies"]["rules"].append(float(source["rules_latency_ms"]))
        if source.get("rules_api_calls"):
            predictions["api_calls"]["rules"] += int(source["rules_api_calls"])
        for run in range(1, 4):
            latency_field = f"llm_latency_ms_{run}"
            if source.get(latency_field):
                predictions["latencies"]["llm"][run - 1].append(float(source[latency_field]))
            call_field = f"llm_api_calls_{run}"
            if source.get(call_field):
                predictions["api_calls"]["llm"][run - 1] += int(source[call_field])
    return predictions


def evaluate(y_true, y_pred):
    return {
        "accuracy": accuracy_score(y_true, y_pred),
        "per_class": classification_report(y_true, y_pred, labels=LABELS, output_dict=True, zero_division=0),
        "classification_report": classification_report(y_true, y_pred, labels=LABELS, zero_division=0),
        "confusion_matrix": confusion_matrix(y_true, y_pred, labels=LABELS).tolist(),
    }


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--input", type=Path, default=HERE / "labeled_sites.csv")
    parser.add_argument("--predictions", type=Path, help="CSV with matching domain/title, true_category, rules_prediction, and llm_prediction_1..3 columns")
    parser.add_argument("--base-url", default="http://localhost:8080")
    parser.add_argument("--output-dir", type=Path, default=HERE)
    args = parser.parse_args()

    rows = load_rows(args.input)
    y_true = [row["true_category"] for row in rows]
    predictions = load_predictions(args.predictions, rows)
    if predictions is None:
        predictions = {"rules": [], "llm": [[], [], []], "latencies": {"rules": [], "llm": [[], [], []]}, "api_calls": {"rules": 0, "llm": [0, 0, 0]}}
        for row in rows:
            category, latency, calls = classify(args.base_url, row, "rules")
            predictions["rules"].append(category)
            predictions["latencies"]["rules"].append(latency)
            predictions["api_calls"]["rules"] += calls
        for run in range(3):
            for row in rows:
                category, latency, calls = classify(args.base_url, row, "llm")
                predictions["llm"][run].append(category)
                predictions["latencies"]["llm"][run].append(latency)
                predictions["api_calls"]["llm"][run] += calls

    consensus = []
    row_agreements = []
    for row_index in range(len(rows)):
        outcomes = [run[row_index] for run in predictions["llm"]]
        counts = {label: outcomes.count(label) for label in LABELS}
        consensus.append(max(LABELS, key=lambda label: counts[label]))
        row_agreements.append(max(counts.values()) / len(outcomes))

    reports = {
        "rules": evaluate(y_true, predictions["rules"]),
        "llm_runs": [evaluate(y_true, run) for run in predictions["llm"]],
        "llm_majority_vote": evaluate(y_true, consensus),
        "llm_run_accuracy": [accuracy_score(y_true, run) for run in predictions["llm"]],
        "llm_consistency": {
            "all_three_runs_agree": sum(value == 1 for value in row_agreements) / len(row_agreements),
            "mean_majority_agreement": statistics.mean(row_agreements),
        },
        "average_latency_ms": {
            "rules": statistics.mean(predictions["latencies"]["rules"]) if predictions["latencies"]["rules"] else None,
            "llm": statistics.mean([value for run in predictions["latencies"]["llm"] for value in run])
            if any(predictions["latencies"]["llm"]) else None,
        },
        "api_calls": {
            "rules": predictions["api_calls"]["rules"],
            "llm_per_run": predictions["api_calls"]["llm"],
            "llm_total": sum(predictions["api_calls"]["llm"]),
        },
        "samples": len(rows),
    }
    print(json.dumps(reports, indent=2))

    args.output_dir.mkdir(parents=True, exist_ok=True)
    figure, axes = plt.subplots(1, 2, figsize=(13, 5))
    for axis, label, predicted in zip(axes, ("Rules", "LLM majority vote"), (predictions["rules"], consensus)):
        ConfusionMatrixDisplay(confusion_matrix(y_true, predicted, labels=LABELS), display_labels=LABELS).plot(
            ax=axis, xticks_rotation=35, colorbar=False, values_format="d")
        axis.set_title(label)
    figure.tight_layout()
    plot_path = args.output_dir / "classification_confusion_matrix.png"
    figure.savefig(plot_path, dpi=160)
    print(f"Confusion matrix plot: {plot_path}")


if __name__ == "__main__":
    try:
        main()
    except (ValueError, requests.RequestException) as error:
        print(f"Evaluation failed: {error}", file=sys.stderr)
        sys.exit(1)
