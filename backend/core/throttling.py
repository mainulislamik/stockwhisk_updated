"""Short-window burst throttles layered on top of the sustained hourly limits.

DRF's default UserRateThrottle/AnonRateThrottle guard sustained volume (per
hour). These add a per-minute burst cap so a sudden flood (load test / scripted
hammering) is rejected with HTTP 429 immediately, before it can pile work onto
the single gunicorn worker and the database.
"""
from rest_framework.throttling import AnonRateThrottle, UserRateThrottle


class BurstAnonThrottle(AnonRateThrottle):
    scope = "burst_anon"


class BurstUserThrottle(UserRateThrottle):
    scope = "burst_user"
