"""Test script to verify backend setup"""
import sys
import os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from dotenv import load_dotenv
load_dotenv()

from app.core.config import get_settings
s = get_settings()
print(f"MiMo Key: {'SET' if s.MIMO_API_KEY else 'NOT SET'}")
print(f"Base URL: {s.MIMO_BASE_URL}")
print(f"Model: {s.MIMO_MODEL}")
print(f"DB URL: {s.DATABASE_URL}")
print("Config OK!")

# Test imports
print("\nTesting imports...")
from app.services.tryon_engine import tryon_engine
print("  tryon_engine: OK")
from app.services.trend_analyzer import trend_analyzer
print("  trend_analyzer: OK")
from app.services.openclaw_service import mimo_service
print(f"  mimo_service: OK (available={mimo_service.available})")
from app.models.models import NailStyle, HandImage, TryonRecord, StyleMetrics
print("  models: OK")
print("\nAll checks passed!")
