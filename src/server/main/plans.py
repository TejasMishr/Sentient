PLAN_LIMITS = {
    "free": {
        "text_messages_daily": 25,
        "voice_chat_daily_seconds": 0,  # Pro feature
        "tasks_monthly": 10,  # Includes long-form and scheduled one-shot tasks
        "workflows_active": 2,  # Combined limit for recurring and triggered
        "swarm_tasks_daily": 0, # Pro feature
        "swarm_sub_agents_max": 0,
        "file_uploads_daily": 3,
        "memories_total": 100,
    },
    "pro": {
        "text_messages_daily": 100,
        "voice_chat_daily_seconds": 10 * 60,
        "tasks_monthly": 100,
        "workflows_active": 25,
        "swarm_tasks_daily": 5,
        "swarm_sub_agents_max": 50,
        "file_uploads_daily": 20,
        "memories_total": float('inf'),  # New
    },
    "selfhost": { # Self-host plan has unlimited access
        "text_messages_daily": float('inf'),
        "voice_chat_daily_seconds": float('inf'),
        "tasks_monthly": float('inf'),
        "workflows_active": float('inf'),
        "swarm_tasks_daily": float('inf'),
        "swarm_sub_agents_max": float('inf'),
        "file_uploads_daily": float('inf'),
        "memories_total": float('inf'),
    }
}

# Features that are exclusively for Pro users
PRO_ONLY_FEATURES = [
    "proactivity",
    # TODO: Implement Calendar Mirroring feature and enforce this Pro-only limit.
    "calendar_mirroring",
    # TODO: Implement Inbox Mirroring feature and enforce this Pro-only limit.
    "inbox_mirroring"
]

PRO_ONLY_INTEGRATIONS = [
    "notion", "github", "slack", "discord", "trello", "whatsapp", "gpeople", "gslides"
]
