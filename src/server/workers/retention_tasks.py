import logging
import random
import random
from datetime import datetime, timedelta, timezone

from workers.celery_app import celery_app
from main.db import MongoManager
from main.notifications.utils import create_and_push_notification
from workers.utils.worker_helpers import run_async

logger = logging.getLogger(__name__)

# --- Campaign Definitions ---

FEATURE_SPOTLIGHTS = [
    {
        "feature_name": "Swarm Tasks",
        "check_query": {"task_type": "swarm"},
        "messages": [
            "Hi {name}, just a thought - if you ever have a list of items you need me to process, like researching several topics, I can handle them all at once with a Swarm Task to save you time.",
            "Hey {name}, I noticed you haven't used Swarm Tasks yet. It's a really efficient way to handle repetitive work on a list of items. Let me know if you have something in mind for it."
        ],
        "notification_type": "feature_spotlight_swarm"
    },
    {
        "feature_name": "Recurring Workflows",
        "check_query": {"schedule.type": "recurring"},
        "messages": [
            "Hi {name}, quick tip: if there's anything you do on a regular basis, like sending a weekly report, I can set that up as a recurring workflow to handle it for you automatically.",
            "Hey {name}, just wanted to mention that I can automate your recurring to-dos. If you have any daily or weekly tasks, we can create a workflow so you don't have to think about them."
        ],
        "notification_type": "feature_spotlight_recurring"
    }
]

UNUSED_INTEGRATION_NUDGES = {
    "gmail": "Hi {name}, I noticed you connected Gmail a while back. Just so you know, you can ask me things like 'summarize my unread emails from this morning' to help clear your inbox. Let me know if you'd like to try it.",
    "gcalendar": "Hey {name}, I see you've connected Google Calendar. Next time you need to schedule something, feel free to just tell me to 'find a time for a meeting with John next week' and I can handle the rest.",
    "notion": "Hi {name}, your Notion integration is all set. If you'd like, you can ask me to do things like 'create a new page in Notion with a to-do list for my new project'.",
    "slack": "Hey {name}, I'm ready to help out in Slack. You can ask me to 'send a message to the #general channel to update the team' whenever you need."
}

RE_ENGAGEMENT_MESSAGES = {
    7: {
        "messages": [
            "Hi {name}, just checking in. Is there anything I can help you with today? Happy to take something off your plate.",
            "Hey {name}, it's been a little while. Ready to tackle a new task? I'm here to help."
        ],
        "notification_type": "re_engagement_7_day"
    },
    14: {
        "messages": [
            "Hi {name}, just wanted to check in. I've learned some new ways to help since we last spoke. Is there anything I can assist you with?",
            "Hi {name}, it's been a couple of weeks. I'm ready to get back to work whenever you are!"
        ],
        "notification_type": "re_engagement_14_day"
    },
    30: {
        "messages": [
            "Hi {name}, it's been about a month. We've rolled out some new features I think you might find useful. Hope to see you again soon.",
            "Hey {name}, checking in one last time. I'm still here to help you save time and be more productive. Hope everything is going well!"
        ],
        "notification_type": "re_engagement_30_day"
    }
}

# --- Async Logic for Campaigns ---

async def async_run_retention_campaigns():
    """
    Master async function to run all daily retention campaigns.
    """
    db_manager = MongoManager()
    try:
        three_months_ago = datetime.now(timezone.utc) - timedelta(days=90)
        # Find all active, onboarded users who have been active in the last 3 months
        users_cursor = db_manager.user_profiles_collection.find(
            {
                "userData.onboardingComplete": True,
                "userData.last_active_timestamp": {"$gte": three_months_ago}
            },
            {"user_id": 1, "userData": 1}
        )
        
        async for user_profile in users_cursor:
            user_id = user_profile.get("user_id")
            user_data = user_profile.get("userData", {})
            if not user_id:
                continue
            
            name = user_data.get("personalInfo", {}).get("name", "there")

            # --- NEW: 0. Unused Integration Nudge (runs before other nudges) ---
            integrations = user_data.get("integrations", {})
            for name, details in integrations.items():
                if details.get("connected") and name in UNUSED_INTEGRATION_NUDGES:
                    connected_at = details.get("connected_at")
                    # Check if connected more than 7 days ago
                    if connected_at and (datetime.now(timezone.utc) - connected_at > timedelta(days=7)):
                        # Check if this tool has ever been used in a task
                        task_usage_count = await db_manager.tasks_collection.count_documents({
                            "user_id": user_id,
                            "$or": [
                                {"plan.tool": name},
                                {"runs.plan.tool": name}
                            ]
                        })
                        
                        notification_type = f"nudge_unused_{name}"
                        if task_usage_count == 0 and not await db_manager.has_notification_type(user_id, notification_type):
                            logger.info(f"User {user_id} has not used connected integration '{name}'. Sending nudge.")
                            await create_and_push_notification(
                                user_id=user_id,
                                message=UNUSED_INTEGRATION_NUDGES[name].format(name=name),
                                notification_type=notification_type
                            )
                            break # Send only one integration nudge per day

            # --- 1. First Integration Nudge ---
            integrations = user_data.get("integrations", {})
            if not any(v.get("connected") for v in integrations.values()):
                created_at = user_profile.get("_id").generation_time
                if datetime.now(timezone.utc) - created_at > timedelta(days=1):
                    notification_type = "nudge_first_integration"
                    if not await db_manager.has_notification_type(user_id, notification_type):
                        logger.info(f"User {user_id} has no integrations. Sending nudge.")
                        await create_and_push_notification(
                            user_id=user_id,
                            message=f"Hi {name}. To get the most out of our work together, I'd recommend connecting an app like Google Calendar or Gmail. I can start managing your schedule and emails for you right away.",
                            notification_type=notification_type
                        )

            # --- 2. Feature Spotlight ---
            for feature in FEATURE_SPOTLIGHTS:
                feature_usage_count = await db_manager.tasks_collection.count_documents(
                    {"user_id": user_id, **feature["check_query"]}
                )
                if feature_usage_count == 0:
                    if not await db_manager.has_notification_type(user_id, feature["notification_type"]):
                        logger.info(f"User {user_id} has not used '{feature['feature_name']}'. Sending spotlight.")
                        await create_and_push_notification(
                            user_id=user_id,
                            message=random.choice(feature["messages"]).format(name=name),
                            notification_type=feature["notification_type"]
                        )
                        break # Only send one spotlight per day

            # --- 3. Re-engagement Nudge ---
            last_active = user_data.get("last_active_timestamp")
            if last_active:
                days_inactive = (datetime.now(timezone.utc) - last_active).days
                if days_inactive in RE_ENGAGEMENT_MESSAGES:
                    campaign = RE_ENGAGEMENT_MESSAGES[days_inactive]
                    if not await db_manager.has_notification_type(user_id, campaign["notification_type"]):
                        logger.info(f"User {user_id} has been inactive for {days_inactive} days. Sending re-engagement nudge.")
                        await create_and_push_notification(
                            user_id=user_id,
                            message=random.choice(campaign["messages"]).format(name=name),
                            notification_type=campaign["notification_type"]
                        )

    except Exception as e:
        logger.error(f"Error in daily retention campaign: {e}", exc_info=True)
    finally:
        await db_manager.close()

async def async_run_weekly_digest():
    """
    Sends a weekly summary of activity to all active users.
    """
    db_manager = MongoManager()
    try:
        one_week_ago = datetime.now(timezone.utc) - timedelta(days=7)
        users_cursor = db_manager.user_profiles_collection.find(
            {"userData.onboardingComplete": True, "userData.last_active_timestamp": {"$gte": one_week_ago}},
            {"user_id": 1, "userData.personalInfo.name": 1}
        )

        async for user in users_cursor:
            user_id = user['user_id']
            name = user.get("userData", {}).get("personalInfo", {}).get("name", "there")
            
            # Get stats for the week
            recent_tasks = await db_manager.get_recent_completed_tasks_for_period(user_id, one_week_ago, datetime.now(timezone.utc), limit=1)
            task_count = await db_manager.get_completed_task_count_for_period(user_id, one_week_ago, datetime.now(timezone.utc))

            if task_count > 0:
                recent_task_name = recent_tasks[0].get('name', 'your latest project') if recent_tasks else 'your tasks'
                message = f"Hi {name}, just wanted to share a quick summary for the week. I completed {task_count} tasks for you, including work on '{recent_task_name}'. Hope you have a great week ahead."
                logger.info(f"Sending weekly digest to user {user_id}. Tasks completed: {task_count}")
                await create_and_push_notification(
                    user_id=user_id,
                    message=message,
                    notification_type="weekly_digest"
                )

    except Exception as e:
        logger.error(f"Error in weekly digest campaign: {e}", exc_info=True)
    finally:
        await db_manager.close()

async def async_run_memory_lane_campaign():
    """
    Finds a useful, non-trivial memory for a user and sends a reminder.
    """
    from mcp_hub.memory import db as memory_db # Import memory DB utils

    db_manager = MongoManager()
    pg_pool = await memory_db.get_db_pool()

    try:
        seven_days_ago = datetime.now(timezone.utc) - timedelta(days=7)
        # Find users active in the last week
        users_cursor = db_manager.user_profiles_collection.find(
            {"userData.onboardingComplete": True, "userData.last_active_timestamp": {"$gte": seven_days_ago}},
            {"user_id": 1, "userData.personalInfo.name": 1}
        )

        async for user in users_cursor:
            user_id = user['user_id']
            name = user.get("userData", {}).get("personalInfo", {}).get("name", "there")
            
            # Find a good, non-trivial memory that we haven't reminded them about recently
            async with pg_pool.acquire() as conn:
                memory_record = await conn.fetchrow(
                    """
                    SELECT id, content FROM facts
                    WHERE user_id = $1
                      AND created_at BETWEEN NOW() - INTERVAL '60 days' AND NOW() - INTERVAL '7 days'
                      AND (last_reminded_at IS NULL OR last_reminded_at < NOW() - INTERVAL '90 days')
                      AND LENGTH(content) > 25
                    ORDER BY RANDOM()
                    LIMIT 1;
                    """,
                    user_id
                )

            if memory_record:
                fact_id = memory_record['id']
                fact_content = memory_record['content']
                logger.info(f"Found a memory for user {user_id} (Fact ID: {fact_id}). Sending reminder.")

                message = f"Hi {name}, something you told me came to mind: \"{fact_content}\". Just wanted to let you know I've remembered that for you. Let me know if anything changes."
                await create_and_push_notification(user_id, message, notification_type=f"memory_lane_{fact_id}")

                # Update the timestamp to prevent re-sending this memory soon
                async with pg_pool.acquire() as conn:
                    await conn.execute("UPDATE facts SET last_reminded_at = NOW() WHERE id = $1", fact_id)

    except Exception as e:
        logger.error(f"Error in memory lane campaign: {e}", exc_info=True)
    finally:
        await db_manager.close()

# --- Celery Task Definitions ---

@celery_app.task(name="run_daily_retention_campaigns")
def run_daily_retention_campaigns():
    """
    Celery task to run daily retention campaigns like feature spotlights,
    integration nudges, and re-engagement messages.
    """
    logger.info("Starting daily retention campaigns...")
    run_async(async_run_retention_campaigns())

@celery_app.task(name="run_weekly_digest_campaign")
def run_weekly_digest_campaign():
    """
    Celery task to send a weekly digest to active users.
    """
    logger.info("Starting weekly digest campaign...")
    run_async(async_run_weekly_digest())

@celery_app.task(name="run_memory_lane_campaign")
def run_memory_lane_campaign():
    """
    Celery task to send personalized memory reminders.
    """
    logger.info("Starting memory lane campaign...")
    run_async(async_run_memory_lane_campaign())

@celery_app.task(name="run_feature_spotlight_campaign")
def run_feature_spotlight_campaign():
    """
    DEPRECATED: This task is now part of the consolidated daily campaign.
    This function is kept for backward compatibility but does nothing.
    The Celery Beat schedule should be updated to use `run_daily_retention_campaigns`.
    """
    logger.warning("DEPRECATED task 'run_feature_spotlight_campaign' was called. Please update Celery Beat schedule.")
    pass