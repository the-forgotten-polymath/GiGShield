import numpy as np
import pandas as pd
from sklearn.ensemble import IsolationForest
import pickle
import os

MODEL_PATH = os.path.join(os.path.dirname(__file__), "anomaly_detector.pkl")

class AnomalyDetector:
    def __init__(self):
        self.clf = IsolationForest(
            n_estimators=100,
            contamination=0.05,  # Expect 5% anomalies in training baseline
            random_state=42
        )
        self.is_trained = False
        if os.path.exists(MODEL_PATH):
            self.load()

    def train_baseline(self, n_samples=2000):
        """Generates synthetic 'genuine' training data and trains the model."""
        data = []
        for _ in range(n_samples):
            # Simulate a genuine worker signal distribution
            row = [
                0,                          # mock_location (0=False)
                np.random.normal(15, 5),    # gps_accuracy (genuine storm range)
                np.random.normal(5, 3),     # gps_altitude_delta
                np.random.uniform(0.3, 0.9),# accelerometer_motion
                np.random.normal(1013, 10), # barometric
                np.random.uniform(0.1, 2.0),# cell_tower_dist
                np.random.choice([0, 1]),   # net_quality (bit of noise ok)
                1,                          # ip_geo_match (1=True)
                1,                          # pre_event_mov (1=True)
                np.random.uniform(15, 60),  # time_to_claim
                np.random.uniform(30, 180), # account_age
                np.random.uniform(0, 0.2)   # payout_ratio
            ]
            data.append(row)
        
        X = np.array(data)
        self.clf.fit(X)
        self.is_trained = True
        self.save()

    def predict(self, signals_list):
        """Returns 1 for normal, -1 for anomaly."""
        if not self.is_trained:
            # Fallback to train on first call if not loaded
            self.train_baseline()
            
        X = np.array([signals_list])
        return self.clf.predict(X)[0]

    def get_score(self, signals_list):
        """Returns score (positive = normal, negative = anomaly)."""
        if not self.is_trained:
            self.train_baseline()
        X = np.array([signals_list])
        return self.clf.decision_function(X)[0]

    def save(self):
        with open(MODEL_PATH, "wb") as f:
            pickle.dump(self.clf, f)
            
    def load(self):
        try:
            with open(MODEL_PATH, "rb") as f:
                self.clf = pickle.load(f)
                self.is_trained = True
        except:
            self.is_trained = False

# Singleton instance
detector = AnomalyDetector()
