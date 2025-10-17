import pytest
from app import app
import json

@pytest.fixture
def client():
    with app.test_client() as client:
        yield client


# 1️⃣ Health Endpoint Test
def test_health_endpoint(client):
    response = client.get("/health")
    assert response.status_code == 200
    data = response.get_json()
    assert data["status"] == "healthy"
    assert data["service"] == "mlops-service"


# 2️⃣ Metrics Endpoint Test
def test_metrics_endpoint(client):
    response = client.get("/metrics")
    # Flask-Prometheus metrics return plain text
    assert response.status_code == 200
    assert "ai_requests_total" in response.get_data(as_text=True)


# 3️⃣ Tracking Endpoint Test
def test_tracking_endpoint(client):
    payload = {"business_id": "test123", "response_time_ms": 200}
    response = client.post("/track", data=json.dumps(payload), content_type="application/json")
    assert response.status_code in [200, 201, 204]


# 4️⃣ Error Handling Test
def test_error_handling_no_data(client):
    response = client.post("/track", data=json.dumps({}), content_type="application/json")
    assert response.status_code == 400
    assert "error" in response.get_json()


# 5️⃣ Data Validation Test
def test_data_validation_invalid_type(client):
    payload = {"business_id": 123, "response_time_ms": "fast"}  # invalid types
    response = client.post("/track", data=json.dumps(payload), content_type="application/json")
    assert response.status_code in [400, 422]

class TestMyCustomTest:
    """My custom test class"""

    def test_flask_app_exists(self, client):
        """Test that our Flask app responds to requests"""
        response = client.get('/health')
        assert response.status_code == 200

    def test_track_endpoint_requires_json(self, client):
        """Test that track endpoint requires JSON data"""
        # Send empty request
        response = client.post('/track')
        assert response.status_code == 500  # Flask returns 500 for JSON errors

        # Check error message
        data = json.loads(response.data)
        assert 'error' in data
class TestMyCustomTest:
    def test_track_endpoint_requires_json(self, client):
        response = client.post("/track")
        assert response.status_code in (415, 400)
