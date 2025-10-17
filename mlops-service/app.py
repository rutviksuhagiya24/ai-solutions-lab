from flask import Flask, jsonify, request
from flask_cors import CORS
from prometheus_client import Counter, Histogram, generate_latest, CONTENT_TYPE_LATEST
from datetime import datetime

app = Flask(__name__)
CORS(app)

# Prometheus metrics
ai_requests_total = Counter("ai_requests_total", "Total AI requests", ["business_id"])
ai_response_time_seconds = Histogram("ai_response_time_seconds", "AI response time in seconds", ["business_id"])

@app.route("/health", methods=["GET"])
def health():
    return jsonify({
        "status": "healthy",
        "service": "mlops-service",
        "time": datetime.utcnow().isoformat()
    })

@app.route("/track", methods=["POST"])
def track():
    data = request.get_json()
    if not data:
        return jsonify({"error": "no metrics"}), 400

    business_id = data.get("business_id", "unknown")
    response_time_ms = data.get("response_time_ms", 1000)

    # ✅ Data validation checks
    if not isinstance(business_id, (str, int)):
        return jsonify({"error": "Invalid business_id type"}), 400

    try:
        response_time_ms = float(response_time_ms)
    except (TypeError, ValueError):
        return jsonify({"error": "Invalid response_time_ms type"}), 400

    ai_requests_total.labels(business_id=business_id).inc()
    ai_response_time_seconds.labels(business_id=business_id).observe(response_time_ms / 1000.0)

    return jsonify({"message": "metrics recorded"}), 200


@app.route("/metrics", methods=["GET"])
def metrics():
    return generate_latest(), 200, {"Content-Type": CONTENT_TYPE_LATEST}

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5001, debug=True)
