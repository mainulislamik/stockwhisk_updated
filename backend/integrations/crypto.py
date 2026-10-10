"""
Cryptographic utilities for the StockWhisk Integration Platform.

Implements AES-256-GCM authenticated encryption for sensitive integration credentials
(API keys, client secrets, webhook secrets, tokens). Keys are derived per-tenant using
HKDF with tenant-specific salt from settings.SECRET_KEY.
"""
import base64
import json
import os
from typing import Any, Dict, Optional

from cryptography.hazmat.primitives import hashes
from cryptography.hazmat.primitives.ciphers.aead import AESGCM
from cryptography.hazmat.primitives.kdf.hkdf import HKDF
from django.conf import settings


def _derive_tenant_key(shop_id: int) -> bytes:
    """Derive a 256-bit AES key unique to this tenant using HKDF."""
    salt = f"stockwhisk_tenant_salt_{shop_id}".encode("utf-8")
    master_key = getattr(settings, "SECRET_KEY", "stockwhisk-fallback-secret-key-32b").encode("utf-8")
    hkdf = HKDF(
        algorithm=hashes.SHA256(),
        length=32,
        salt=salt,
        info=b"stockwhisk_integrations_credential_v1",
    )
    return hkdf.derive(master_key)


def encrypt_secret(plaintext: Optional[str], shop_id: int) -> str:
    """
    Encrypt plaintext string using AES-256-GCM with tenant-derived key.
    Returns base64-encoded string: base64(12-byte nonce + ciphertext + 16-byte auth tag).
    """
    if not plaintext:
        return ""
    key = _derive_tenant_key(shop_id)
    aesgcm = AESGCM(key)
    nonce = os.urandom(12)
    ciphertext = aesgcm.encrypt(nonce, plaintext.encode("utf-8"), None)
    return base64.b64encode(nonce + ciphertext).decode("utf-8")


def decrypt_secret(encrypted_text: Optional[str], shop_id: int) -> str:
    """
    Decrypt base64-encoded AES-256-GCM ciphertext using tenant-derived key.
    Returns decrypted plaintext string. Raises ValueError if corrupted or tampered.
    """
    if not encrypted_text:
        return ""
    try:
        raw_bytes = base64.b64decode(encrypted_text.encode("utf-8"))
        if len(raw_bytes) < 28:  # 12 nonce + 16 tag minimum
            raise ValueError("Invalid encrypted payload size")
        nonce = raw_bytes[:12]
        ciphertext = raw_bytes[12:]
        key = _derive_tenant_key(shop_id)
        aesgcm = AESGCM(key)
        decrypted = aesgcm.decrypt(nonce, ciphertext, None)
        return decrypted.decode("utf-8")
    except Exception as exc:
        raise ValueError(f"Failed to decrypt credential for shop {shop_id}: {exc}") from exc


def encrypt_dict(data: Optional[Dict[str, Any]], shop_id: int) -> str:
    """Encrypt a dictionary of credentials as a JSON string."""
    if not data:
        return ""
    json_str = json.dumps(data)
    return encrypt_secret(json_str, shop_id)


def decrypt_dict(encrypted_text: Optional[str], shop_id: int) -> Dict[str, Any]:
    """Decrypt a dictionary of credentials."""
    if not encrypted_text:
        return {}
    decrypted_str = decrypt_secret(encrypted_text, shop_id)
    if not decrypted_str:
        return {}
    return json.loads(decrypted_str)


def mask_credential(val: Optional[str]) -> str:
    """Return masked string for safe API display, e.g. '••••••••1234' or ''."""
    if not val:
        return ""
    if len(val) <= 4:
        return "••••"
    return "••••••••" + val[-4:]
