import logging
import datetime
from typing import Dict, Any, List, Optional
from main.db import MongoManager

logger = logging.getLogger(__name__)

async def get_task_state(task_id: str, user_id: str) -> Dict:
    db = MongoManager()
    try:
        task = await db.get_task(task_id, user_id)
        if not task or task.get("user_id") != user_id:
            raise ValueError("Task not found or access denied.")
        return task
    finally:
        await db.close()

async def update_orchestrator_state(task_id: str, user_id: str, state_updates: Dict):
    db = MongoManager()
    try:
        task = await db.get_task(task_id, user_id)
        if not task:
            logger.error(f"Cannot update orchestrator state: Task {task_id} not found.")
            return

        orchestrator_state = task.get("orchestrator_state", {})
        if not isinstance(orchestrator_state, dict):
            orchestrator_state = {}

        orchestrator_state.update(state_updates)

        update_payload = {"orchestrator_state": orchestrator_state}

        # Also update main status if orchestrator state is changing
        if 'current_state' in state_updates:
            new_state = state_updates['current_state']
            status_map = {
                "COMPLETED": "completed",
                "FAILED": "error",
                "SUSPENDED": "clarification_pending",
                "PLANNING": "processing",
                "ACTIVE": "processing",
                "WAITING": "waiting"
            }
            if new_state in status_map:
                update_payload['status'] = status_map[new_state]

            # Send notifications for critical state changes
            notification_type = None
            message = None
            task_name = task.get("name", "your task")

            if new_state == "SUSPENDED":
                notification_type = "taskNeedsClarification"
                message = f"'{task_name}' needs your input to continue."
            elif new_state == "COMPLETED":
                notification_type = "taskCompleted"
                message = f"'{task_name}' has completed."
            elif new_state == "FAILED":
                notification_type = "taskFailed"
                message = f"'{task_name}' has failed."

            if notification_type and message:
                try:
                    from workers.utils.api_client import notify_user
                    await notify_user(user_id, message, task_id, notification_type)
                except Exception as e:
                    logger.error(f"Failed to send notification for task {task_id} state change to {new_state}: {e}")

        await db.update_task(task_id, user_id, update_payload)

        try:
            from workers.utils.api_client import push_task_list_update
            await push_task_list_update(user_id, task_id, "orchestrator_state_change")
        except ImportError:
            logger.error("Could not import push_task_list_update. Check python path for mcp_hub.")
        except Exception as e:
            logger.error(f"Failed to push task list update from orchestrator: {e}")
    finally:
        await db.close()

async def add_execution_log(task_id: str, user_id: str, action: str, details: Dict, reasoning: str):
    db = MongoManager()
    try:
        task = await db.get_task(task_id, user_id)
        if not task:
            logger.error(f"Cannot add execution log: Task {task_id} not found.")
            return

        execution_log = task.get("execution_log", [])
        if not isinstance(execution_log, list):
            execution_log = []

        log_entry = {
            "timestamp": datetime.datetime.now(datetime.timezone.utc),
            "action": action,
            "details": details,
            "agent_reasoning": reasoning
        }
        execution_log.append(log_entry)
        await db.update_task(task_id, user_id, {"execution_log": execution_log})
    finally:
        await db.close()
async def add_step_to_dynamic_plan(task_id: str, user_id: str, new_step: Dict, goal: Optional[str] = None):
    """Appends a new step to the task's dynamic_plan array."""
    db = MongoManager()
    try:
        task = await db.get_task(task_id, user_id)
        if not task:
            logger.error(f"Cannot add step to plan: Task {task_id} not found.")
            return

        dynamic_plan = task.get("dynamic_plan", [])
        if not isinstance(dynamic_plan, list):
            dynamic_plan = []
        dynamic_plan.append(new_step)

        update_payload = {
            "dynamic_plan": dynamic_plan
        }

        if goal:
            orchestrator_state = task.get("orchestrator_state", {})
            if not isinstance(orchestrator_state, dict):
                orchestrator_state = {}
            orchestrator_state["main_goal"] = goal
            update_payload["orchestrator_state"] = orchestrator_state

        await db.update_task(task_id, user_id, update_payload)
    finally:
        await db.close()

async def update_context_store(task_id: str, user_id: str, key: str, value: Any):
    db = MongoManager()
    try:
        task = await db.get_task(task_id, user_id)
        if not task:
            logger.error(f"Cannot update context store: Task {task_id} not found.")
            return

        orchestrator_state = task.get("orchestrator_state", {})
        if not isinstance(orchestrator_state, dict):
            orchestrator_state = {}

        context_store = orchestrator_state.get("context_store", {})
        if not isinstance(context_store, dict):
            context_store = {}

        context_store[key] = value
        orchestrator_state["context_store"] = context_store

        await db.update_task(task_id, user_id, {"orchestrator_state": orchestrator_state})
    finally:
        await db.close()

async def mark_step_as_complete(task_id: str, user_id: str, step_id: str, result: Dict):
    db = MongoManager()
    try:
        task = await db.get_task(task_id, user_id)
        if not task:
            logger.error(f"Cannot mark step as complete: Task {task_id} not found.")
            return

        dynamic_plan = task.get("dynamic_plan", [])
        if not isinstance(dynamic_plan, list):
            return

        step_found = False
        target_step = None
        for step in dynamic_plan:
            if step.get("step_id") == step_id:
                target_step = step
                step_found = True
                break

        if not step_found:
            logger.warning(f"Could not find step_id {step_id} in task {task_id}. Attempting to find first pending step as a fallback.")
            for step in dynamic_plan:
                if step.get("status") == "pending":
                    target_step = step
                    logger.warning(f"Fallback successful: Found pending step with ID {target_step.get('step_id')}.")
                    step_found = True
                    break

        if step_found and target_step:
            target_step["status"] = "completed"
            target_step["result"] = result
            target_step["completed_at"] = datetime.datetime.now(datetime.timezone.utc)
            await db.update_task(task_id, user_id, {"dynamic_plan": dynamic_plan})
        else:
            logger.warning(f"Could not find step_id {step_id} in task {task_id} to mark as complete, and no pending step found as fallback.")
    finally:
        await db.close()