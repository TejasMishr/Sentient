import asyncio

# Helper to run async code in Celery's sync context
def run_async(coro):
    # Always create a new loop for each task to ensure isolation and prevent conflicts.
    loop = asyncio.new_event_loop()
    asyncio.set_event_loop(loop)
    try:
        return loop.run_until_complete(coro)
    finally:
        # Ensure the connection pool for this specific loop is closed.
        from mcp_hub.memory.db import close_db_pool_for_loop
        loop.run_until_complete(close_db_pool_for_loop(loop))
        loop.close()
        asyncio.set_event_loop(None)