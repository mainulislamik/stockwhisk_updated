import os
import sys
import django
import json

# Setup django environment
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()

from accounts.models import User
from accounts.serializers import UserSerializer

u = User.objects.filter(email='ob.touhid@gmail.com').first()
if u:
    print(json.dumps(UserSerializer(u).data, indent=2))
else:
    print("User not found")
