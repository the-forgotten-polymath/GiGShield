import numpy as np
import networkx as nx
from typing import List, Dict

class GraphDetector:
    """
    A lightweight GraphSAGE-inspired GNN using NumPy.
    Aggregates neighbor features (account age, BCS score, payout ratio) 
    to classify if a node belongs to a coordinated fraud ring.
    """
    def __init__(self, input_dim=3, hidden_dim=8):
        # Initialize random weights for a 2-layer GNN
        self.W1 = np.random.randn(input_dim * 2, hidden_dim) * 0.1
        self.W2 = np.random.randn(hidden_dim * 2, 1) * 0.1
        self.b1 = unicode_b1 = np.zeros(hidden_dim)
        self.b2 = np.zeros(1)

    def relu(self, x):
        return np.maximum(0, x)

    def sigmoid(self, x):
        return 1 / (1 + np.exp(-x))

    def forward(self, nodes_features: np.ndarray, adj_matrix: np.ndarray):
        """
        nodes_features: (N, input_dim)
        adj_matrix: (N, N)
        """
        N = nodes_features.shape[0]
        
        # Layer 1: Aggregate neighbors
        # Mean aggregation: h_neigh = (Adj @ h) / degrees
        degrees = np.sum(adj_matrix, axis=1, keepdims=True)
        degrees[degrees == 0] = 1
        h_neigh1 = (adj_matrix @ nodes_features) / degrees
        
        # Concatenate self + neighbor
        h_combined1 = np.hstack([nodes_features, h_neigh1])
        h1 = self.relu(h_combined1 @ self.W1 + self.b1)
        
        # Layer 2: Aggregate h1
        h_neigh2 = (adj_matrix @ h1) / degrees
        h_combined2 = np.hstack([h1, h_neigh2])
        out = self.sigmoid(h_combined2 @ self.W2 + self.b2)
        
        return out.flatten()

    def detect_ring_in_cluster(self, node_data: List[Dict]):
        """
        node_data: List of dicts with {'id', 'age', 'bcs', 'ratio', 'neighbors': [ids]}
        """
        if not node_data:
            return 0.0
        
        N = len(node_data)
        id_map = {node['id']: i for i, node in enumerate(node_data)}
        
        # Build features matrix (age, bcs, ratio)
        # Normalize age (max 180), bcs (max 100)
        X = np.zeros((N, 3))
        adj = np.zeros((N, N))
        
        for i, node in enumerate(node_data):
            X[i, 0] = min(1.0, node.get('age', 0) / 180.0)
            X[i, 1] = node.get('bcs', 50) / 100.0
            X[i, 2] = min(1.0, node.get('ratio', 0) / 0.5)
            
            for neighbor_id in node.get('neighbors', []):
                if neighbor_id in id_map:
                    adj[i, id_map[neighbor_id]] = 1
                    adj[id_map[neighbor_id], i] = 1 # Undirected
        
        scores = self.forward(X, adj)
        
        # A cluster is a ring if the average internal "fraudiness" is high
        # and homogeneity is high (standard deviation of signals is low)
        avg_score = np.mean(scores)
        
        # Ring signals: high homogeneity in BCS and Age
        bcs_vals = X[:, 1]
        homogeneity = 1.0 - min(1.0, np.std(bcs_vals) * 5) # Lower std = higher homogeneity
        
        # Weighted ring probability
        ring_prob = (avg_score * 0.6) + (homogeneity * 0.4)
        
        return float(min(1.0, ring_prob))

# Singleton
graph_detector = GraphDetector()
