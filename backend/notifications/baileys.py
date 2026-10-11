import logging
import os
import requests
from django.conf import settings
from django.utils import timezone

logger = logging.getLogger("notifications.whatsapp.baileys")

WHATSAPP_GATEWAY_URL = getattr(
    settings,
    "WHATSAPP_GATEWAY_URL",
    os.getenv("WHATSAPP_GATEWAY_URL", "http://wa-engine:5001"),
)


def get_session_id(shop_id) -> str:
    return f"shop_{shop_id}"


def get_gateway_status(shop_id: int = 1) -> dict:
    url = f"{WHATSAPP_GATEWAY_URL}/status"
    try:
        resp = requests.get(url, timeout=5)
        if resp.status_code == 200:
            d = resp.json()
            return {
                "connected": d.get("status") == "CONNECTED",
                "status": d.get("status", "offline"),
                "phone": d.get("user", {}).get("id") if isinstance(d.get("user"), dict) else None,
                "name": d.get("user", {}).get("name") if isinstance(d.get("user"), dict) else None,
                "has_qr": bool(d.get("hasQr")),
            }
    except Exception as exc:
        logger.warning("Failed to query WhatsApp gateway status: %s", exc)
    return {"connected": False, "status": "offline", "phone": None, "name": None}


def get_gateway_qr(shop_id: int = 1) -> dict:
    url = f"{WHATSAPP_GATEWAY_URL}/qr"
    try:
        resp = requests.get(url, timeout=10)
        if resp.status_code == 200:
            d = resp.json()
            return {
                "connected": d.get("status") == "CONNECTED",
                "status": d.get("status"),
                "qr": d.get("qrDataUrl"),
                "raw_qr": d.get("rawQr"),
            }
    except Exception as exc:
        logger.error("Failed to query WhatsApp gateway QR: %s", exc)
        return {"error": str(exc), "connected": False, "qr": None}
    return {"connected": False, "qr": None}


def request_gateway_pairing_code(phone: str, shop_id: int = 1) -> dict:
    url = f"{WHATSAPP_GATEWAY_URL}/pairing-code"
    try:
        clean_phone = "".join(filter(str.isdigit, str(phone)))
        resp = requests.post(url, json={"phone": clean_phone}, timeout=15)
        if resp.status_code == 200:
            return resp.json()
        return {"success": False, "error": resp.json().get("error", "Failed to generate pairing code")}
    except Exception as exc:
        logger.error("Failed to request WhatsApp gateway pairing code: %s", exc)
        return {"success": False, "error": str(exc)}


def disconnect_gateway(shop_id: int = 1) -> dict:
    url = f"{WHATSAPP_GATEWAY_URL}/logout"
    try:
        resp = requests.post(url, timeout=5)
        return resp.json() if resp.status_code == 200 else {"success": False}
    except Exception as exc:
        logger.error("Failed to disconnect WhatsApp gateway: %s", exc)
        return {"success": False, "error": str(exc)}


def send_whatsapp_message(shop_id: int, to_phone: str, message: str) -> dict:
    return send_platform_whatsapp_message(to_phone, message)


def send_platform_whatsapp_message(to_phone: str, message: str) -> dict:
    """
    Sends an automated notification message from StockWhisk's official platform WhatsApp number.
    Uses official Baileys gateway service (port 5001).
    """
    url = f"{WHATSAPP_GATEWAY_URL}/send-message"
    try:
        resp = requests.post(
            url,
            json={"phone": to_phone, "text": message},
            timeout=15,
        )
        data = resp.json() if resp.content else {}
        if resp.status_code == 200 and data.get("success"):
            return {"success": True, "message_id": data.get("messageId")}

        # Fallback to /send route
        fallback_url = f"{WHATSAPP_GATEWAY_URL}/send"
        resp2 = requests.post(
            fallback_url,
            json={"phone": to_phone, "message": message},
            timeout=15,
        )
        data2 = resp2.json() if resp2.content else {}
        if resp2.status_code == 200 and data2.get("success"):
            return {"success": True, "message_id": data2.get("messageId")}

        return {
            "success": False,
            "error": data.get("error") or data2.get("error") or f"HTTP {resp.status_code}",
            "status_code": resp.status_code,
        }
    except Exception as exc:
        logger.error("Failed to send platform WhatsApp message to %s: %s", to_phone, exc)
        return {"success": False, "error": str(exc)}


def format_invoice_message(sale, shop, request=None) -> str:
    """Format a professional, bilingual invoice memo for WhatsApp delivery."""
    from sales.views import invoice_token
    token = invoice_token(sale.id)
    path = f"/invoice/{token}"
    
    if request:
        base_url = request.build_absolute_uri("/").rstrip("/")
    else:
        base_url = "http://localhost:8090"
    
    public_url = f"{base_url}{path}"
    
    # Items breakdown (up to first 5 items)
    items_lines = []
    for item in sale.items.select_related("product").all()[:5]:
        p_name = item.product.name if item.product else "Item"
        qty = int(item.quantity) if item.quantity == int(item.quantity) else float(item.quantity)
        items_lines.append(f"• {p_name} x {qty} = ৳{item.subtotal:.2f}")
    
    more_items = sale.items.count() - 5
    if more_items > 0:
        items_lines.append(f"  ... এবং আরো {more_items}টি পণ্য")

    items_text = "\n".join(items_lines) if items_lines else "• সাধারণ বিক্রয়"
    
    date_str = sale.sale_date.strftime("%d-%b-%Y %I:%M %p") if sale.sale_date else timezone.now().strftime("%d-%b-%Y")
    cust_name = sale.bill_name or "সম্মানিত ক্রেতা"
    
    due_line = ""
    if sale.due > 0:
        due_line = f"\n⚠️ *বকেয়া:* ৳{sale.due:.2f}"
    
    msg = (
        f"🧾 *চালান মেমো* — *{shop.name}*\n"
        f"--------------------------------\n"
        f"📋 *চালান নং:* #{sale.invoice_no}\n"
        f"📅 *তারিখ:* {date_str}\n"
        f"👤 *ক্রেতা:* {cust_name}\n"
        f"--------------------------------\n"
        f"{items_text}\n"
        f"--------------------------------\n"
        f"💰 *মোট বিল:* ৳{sale.total:.2f}\n"
        f"✅ *পরিশোধ:* ৳{sale.paid:.2f}"
        f"{due_line}\n\n"
        f"📄 *অনলাইন রসিদ দেখতে ভিজিট করুন:*\n"
        f"{public_url}\n\n"
        f"আমাদের সাথে কেনাকাটা করার জন্য আন্তরিক ধন্যবাদ! 🛍️"
    )
    return msg
