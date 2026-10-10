import logging
import os
import requests
from django.conf import settings
from django.utils import timezone

logger = logging.getLogger("notifications.whatsapp.baileys")

WHATSAPP_GATEWAY_URL = getattr(
    settings,
    "WHATSAPP_GATEWAY_URL",
    os.getenv("WHATSAPP_GATEWAY_URL", "http://whatsapp:5001"),
)


def get_session_id(shop_id) -> str:
    return f"shop_{shop_id}"


def get_gateway_status(shop_id: int) -> dict:
    session_id = get_session_id(shop_id)
    url = f"{WHATSAPP_GATEWAY_URL}/sessions/{session_id}/status"
    try:
        resp = requests.get(url, timeout=5)
        if resp.status_code == 200:
            return resp.json()
    except Exception as exc:
        logger.warning("Failed to query WhatsApp gateway status for shop %s: %s", shop_id, exc)
    return {"connected": False, "status": "offline", "phone": None, "name": None}


def get_gateway_qr(shop_id: int) -> dict:
    session_id = get_session_id(shop_id)
    url = f"{WHATSAPP_GATEWAY_URL}/sessions/{session_id}/qr"
    try:
        resp = requests.get(url, timeout=10)
        if resp.status_code == 200:
            return resp.json()
    except Exception as exc:
        logger.error("Failed to query WhatsApp gateway QR for shop %s: %s", shop_id, exc)
        return {"error": str(exc), "connected": False, "qr": None}
    return {"connected": False, "qr": None}


def disconnect_gateway(shop_id: int) -> dict:
    session_id = get_session_id(shop_id)
    url = f"{WHATSAPP_GATEWAY_URL}/sessions/{session_id}/disconnect"
    try:
        resp = requests.post(url, timeout=5)
        return resp.json() if resp.status_code == 200 else {"success": False}
    except Exception as exc:
        logger.error("Failed to disconnect WhatsApp gateway for shop %s: %s", shop_id, exc)
        return {"success": False, "error": str(exc)}


def send_whatsapp_message(shop_id: int, to_phone: str, message: str) -> dict:
    session_id = get_session_id(shop_id)
    url = f"{WHATSAPP_GATEWAY_URL}/sessions/{session_id}/send-message"
    try:
        resp = requests.post(
            url,
            json={"to": to_phone, "message": message},
            timeout=15,
        )
        data = resp.json() if resp.content else {}
        if resp.status_code == 200 and data.get("success"):
            return {"success": True, "message_id": data.get("messageId")}
        return {
            "success": False,
            "error": data.get("error") or f"HTTP {resp.status_code}",
            "status_code": resp.status_code,
        }
    except Exception as exc:
        logger.error("Failed to send WhatsApp message for shop %s: %s", shop_id, exc)
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
