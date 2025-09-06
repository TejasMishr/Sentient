import logging
from typing import Optional, Dict, Any
import datetime
import json
from pywebpush import webpush, WebPushException
import json

from main.dependencies import mongo_manager, websocket_manager
from main.notifications.whatsapp_client import send_whatsapp_message # Import the new client
from main.config import DB_ENCRYPTION_ENABLED
from workers.utils.crypto import decrypt_field
from main.config import VAPID_PRIVATE_KEY, VAPID_ADMIN_EMAIL

logger = logging.getLogger(__name__)

async def create_and_push_notification(user_id: str, message: str, task_id: Optional[str] = None, notification_type: str = "general", payload: Optional[Dict[str, Any]] = None):
    """
    Saves a notification to the database, pushes it via WebSocket, and sends it via WhatsApp if configured.
    Handles different notification types.
    NEW: Also sends a PWA Push Notification if subscriptions exist.
    """

    notification_data = {}

    # Default, general notification
    notification_data = {
        "type": "general",
        "message": message,
        "task_id": task_id,
        "read": False
    }

    try:
        # 1. Save to DB
        new_notification = await mongo_manager.add_notification(user_id, notification_data)
        if not new_notification:
            logger.error(f"Failed to save notification to DB for user {user_id}")
            return

        # Decrypt fields before pushing to websocket
        if DB_ENCRYPTION_ENABLED:
            SENSITIVE_NOTIFICATION_FIELDS = ["message", "suggestion_payload"]
            for field in SENSITIVE_NOTIFICATION_FIELDS:
                if field in new_notification and new_notification[field] is not None:
                    new_notification[field] = decrypt_field(new_notification[field])

        # Convert datetime to string for JSON serialization before pushing
        if isinstance(new_notification.get("timestamp"), datetime.datetime):
            new_notification["timestamp"] = new_notification["timestamp"].isoformat()
        
        # 2. Push via WebSocket to UI
        push_payload = {
            "type": "new_notification",
            "notification": new_notification
        }
        await websocket_manager.send_personal_json_message(
            push_payload, user_id, connection_type="notifications"
        )
        logger.info(f"Pushed new notification to user {user_id} via WebSocket.")

        # 3. Send via WhatsApp
        user_profile = await mongo_manager.get_user_profile(user_id)
        if user_profile:
            wa_prefs = user_profile.get("userData", {}).get("notificationPreferences", {}).get("whatsapp", {})
            if wa_prefs.get("enabled") and wa_prefs.get("chatId"):
                logger.info(f"Attempting to send WhatsApp notification to user {user_id}")
                await send_whatsapp_message(wa_prefs["chatId"], message)
            else:
                logger.info(f"WhatsApp notifications disabled or not configured for user {user_id}.")

        # 4. Send via PWA Push Notification
        if VAPID_PRIVATE_KEY and VAPID_ADMIN_EMAIL:
            if user_profile and "userData" in user_profile:
                subscriptions = user_profile["userData"].get("pwa_subscriptions", [])
                if subscriptions and isinstance(subscriptions, list):
                    logger.info(f"Found {len(subscriptions)} PWA push subscriptions for user {user_id}. Attempting to send.")

                    push_payload = json.dumps({
                        "title": "Sentient Notification",
                        "body": message,
                        "data": {
                            "url": f"/tasks?taskId={task_id}" if task_id else "/notifications"
                        }
                    })

                    for sub in subscriptions:
                        try:
                            webpush(
                                subscription_info=sub,
                                data=push_payload,
                                vapid_private_key=VAPID_PRIVATE_KEY,
                                vapid_claims={"sub": VAPID_ADMIN_EMAIL}
                            )
                        except WebPushException as ex:
                            logger.warning(f"Web push failed for user {user_id}: {ex}")
                            # If the subscription is expired (410) or gone (404), remove it from the DB.
                            if ex.response and ex.response.status_code in [404, 410]:
                                logger.info(f"Subscription for user {user_id} is expired. Removing from DB.")
                                await mongo_manager.delete_pwa_subscription(user_id, sub['endpoint'])
                            else:
                                # You might want to handle other errors differently, e.g., temporary server issues.
                                pass
                else:
                    logger.info(f"No PWA push subscriptions found for user {user_id}.")
        else:
            logger.warning("VAPID keys not configured on server. Skipping PWA push notifications.")

    except Exception as e:
        logger.error(f"Error creating/pushing notification for user {user_id}: {e}", exc_info=True)
