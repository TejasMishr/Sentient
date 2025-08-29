import uuid
import json
import datetime
from typing import Dict, Any, List, Optional
from fastmcp import Context
from fastmcp.exceptions import ToolError
from fastmcp.utilities.logging import get_logger

from . import state_manager, waiting_manager, auth
from workers.utils.api_client import notify_user
from workers.tasks import async_refine_and_plan_ai_task
from mcp_hub.orchestrator.prompts import COMPLETION_EVALUATION_PROMPT
from main.llm import run_agent as run_main_agent
from json_extractor import JsonExtractor

logger = get_logger(__name__)

# Note: @mcp.tool() decorator is applied in main.py

async def update_plan(ctx: Context, next_step_description: str, reasoning: str, main_goal_update: Optional[str] = None) -> Dict:
    """Adds a single new step to the dynamic plan to be executed next."""
    logger.info(f"Executing tool: update_plan with next_step_description='{next_step_description}', reasoning='{reasoning}', main_goal_update='{main_goal_update}'")
    user_id = auth.get_user_id_from_context(ctx)
    task_id = auth.get_task_id_from_context(ctx)

    new_step = {
        "step_id": str(uuid.uuid4()),
        "description": next_step_description,
        "status": "pending",
        "created_at": datetime.datetime.now(datetime.timezone.utc),
        "result": None,
        "sub_task_id": None
    }

    await state_manager.add_step_to_dynamic_plan(task_id, user_id, new_step, main_goal_update)
    await state_manager.add_execution_log(task_id, user_id, "plan_step_added", {"step_description": next_step_description}, reasoning)
    return {"status": "success", "message": "New step added to the plan."}

async def update_context(ctx: Context, key: str, value: Any, reasoning: str) -> Dict:
    """Store information like email thread IDs, document IDs, etc. in the task's context store. This is crucial information about the current task that will be required for subsequent steps."""
    logger.info(f"Executing tool: update_context with key='{key}', value='{json.dumps(value, default=str)}', reasoning='{reasoning}'")
    user_id = auth.get_user_id_from_context(ctx)
    task_id = auth.get_task_id_from_context(ctx)
    await state_manager.update_context_store(task_id, user_id, key, value)
    await state_manager.add_execution_log(task_id, user_id, "context_updated", {"key": key}, reasoning)
    return {"status": "success", "message": f"Context updated for key '{key}'."}

async def get_context(ctx: Context, key: str = None) -> Dict:
    """Retrieve information like email thread IDs, document IDs, etc. from task's context store. Always use this tool when you start a new cycle to get the latest context."""
    logger.info(f"Executing tool: get_context with key='{key}'")
    user_id = auth.get_user_id_from_context(ctx)
    task_id = auth.get_task_id_from_context(ctx)
    task = await state_manager.get_task_state(task_id, user_id)
    context_store = task.get("orchestrator_state", {}).get("context_store", {})
    if key:
        return {"status": "success", "result": context_store.get(key)}
    return {"status": "success", "result": context_store}

async def create_subtask(ctx: Context, step_id: str, subtask_description: str, context: Optional[Dict] = None, reasoning: str = "") -> Dict:
    """
    Creates and COMPLETELY EXECUTES a sub-task. This is a BLOCKING call.
    The orchestrator will wait until the sub-task is finished and will receive its final result.
    """
    subtask_description += "\n\nIMPORTANT: Return your final result as simple text or JSON. DO NOT contact or notify the user directly—your output goes back to the orchestrator."
    logger.info(f"Executing tool: create_subtask with step_id='{step_id}', subtask_description='{subtask_description}', context='{json.dumps(context, default=str)}', reasoning='{reasoning}'")
    user_id = auth.get_user_id_from_context(ctx)
    task_id = auth.get_task_id_from_context(ctx)
    db = state_manager.PlannerMongoManager()
    sub_task_id = None
    try:
        parent_task = await db.get_task(task_id, user_id)
        if not parent_task:
            raise ToolError(f"Parent task with ID {task_id} not found for user.")
        auto_approve = parent_task.get("auto_approve_subtasks", False)

        sub_task_data = {
            "name": subtask_description,
            "description": subtask_description,
            "task_type": "single",
            "original_context": {
                "source": "long_form_subtask",
                "parent_task_id": task_id,
                "parent_step_id": step_id,
                "context": context,
                "auto_approve": auto_approve
            }
        }
        sub_task_id = await db.add_task(user_id, sub_task_data)

        await db.tasks_collection.update_one(
            {"task_id": task_id, "user_id": user_id, "dynamic_plan.step_id": step_id},
            {"$set": {"dynamic_plan.$.sub_task_id": sub_task_id}}
        )

        await state_manager.add_execution_log(task_id, user_id, "subtask_created", {"sub_task_id": sub_task_id, "description": subtask_description}, reasoning)

        # === BEGIN SYNCHRONOUS EXECUTION ===
        logger.info(f"Orchestrator is now BLOCKING, awaiting completion of sub-task {sub_task_id}")
        await async_refine_and_plan_ai_task(sub_task_id, user_id)
        logger.info(f"Sub-task {sub_task_id} has completed its lifecycle.")

        # Fetch the completed sub-task to get its result
        completed_subtask = await db.get_task(sub_task_id, user_id)
        if not completed_subtask:
            raise ToolError(f"Could not retrieve completed sub-task {sub_task_id} from database.")

        final_run = completed_subtask.get("runs", [])[-1] if completed_subtask.get("runs") else {}
        final_result = final_run.get("result", {"summary": "Sub-task finished but produced no result."})

        return {"status": "success", "result": final_result}

    except Exception as e:
        logger.error(f"Error during synchronous sub-task execution for parent {task_id}: {e}", exc_info=True)
        if sub_task_id:
            await db.update_task_field(sub_task_id, user_id, {"status": "error", "error": f"Orchestrator-level error: {e}"})
        # Propagate the error back to the orchestrator agent
        raise ToolError(f"Sub-task execution failed: {e}")
    finally:
        await db.close()

async def wait(ctx: Context, wait_for_event: str, timeout_minutes: int, max_retries: int = 3, reasoning: str = "", context: Optional[Dict[str, Any]] = None) -> Dict:
    """
    Puts the task in a waiting state for an EXTERNAL event (e.g., a human email reply).
    DO NOT use this to wait for sub-tasks. `create_subtask` handles that automatically.
    """
    logger.info(f"Executing tool: wait with wait_for_event='{wait_for_event}', timeout_minutes='{timeout_minutes}', max_retries='{max_retries}', reasoning='{reasoning}', context='{json.dumps(context, default=str)}'")
    user_id = auth.get_user_id_from_context(ctx)
    task_id = auth.get_task_id_from_context(ctx)
    await waiting_manager.set_waiting_state(task_id, user_id, wait_for_event, timeout_minutes, max_retries, context=context)
    await state_manager.add_execution_log(task_id, user_id, "waiting_started", {"waiting_for": wait_for_event, "timeout_minutes": timeout_minutes, "context": context}, reasoning)
    return {
        "status": "success",
        "message": f"Task is now waiting for '{wait_for_event}'. DO NOT CONTINUE OR MAKE FURTHER CALLS NOW. THIS IS THE USER SPEAKING. YOU HAVE TO STOP NOW. DO NOT SEND ANY MORE RESPONSES IN THIS CYCLE."
    }

async def ask_user_clarification(ctx: Context, question: str, urgency: str = "normal", reasoning: str = "") -> Dict:
    """Suspend task and ask user for clarification"""
    logger.info(f"Executing tool: ask_user_clarification with question='{question}', urgency='{urgency}', reasoning='{reasoning}'")
    user_id = auth.get_user_id_from_context(ctx)
    task_id = auth.get_task_id_from_context(ctx)
    db = state_manager.PlannerMongoManager()
    try:
        request_id = str(uuid.uuid4())
        clarification_request = {
            "request_id": request_id,
            "question": question,
            "asked_at": datetime.datetime.now(datetime.timezone.utc),
            "response": None,
            "responded_at": None,
            "status": "pending"
        }
        await db.tasks_collection.update_one(
            {"task_id": task_id, "user_id": user_id},
            {
                "$push": {"clarification_requests": clarification_request},
                "$set": {
                    "orchestrator_state.current_state": "SUSPENDED",
                    "status": "clarification_pending"
                }
            }
        )
        await state_manager.add_execution_log(task_id, user_id, "clarification_requested", {"question": question}, reasoning)
        
        await notify_user(
            user_id,
            f"A long-form task needs your input: {question}",
            task_id,
            notification_type="taskNeedsClarification",
            payload={"request_id": request_id}
        )

        return {
            "status": "success",
            "message": "Clarification requested from user. Task is suspended. DO NOT CONTINUE OR MAKE FURTHER CALLS NOW. THIS IS THE USER SPEAKING. YOU HAVE TO STOP NOW. DO NOT SEND ANY MORE RESPONSES IN THIS CYCLE."
        }
    finally:
        await db.close()

async def mark_step_complete(ctx: Context, step_id: str, result: Dict, reasoning: str) -> Dict:
    """Mark a step as completed and store results"""
    logger.info(f"Executing tool: mark_step_complete with step_id='{step_id}', result='{json.dumps(result, default=str)}', reasoning='{reasoning}'")
    user_id = auth.get_user_id_from_context(ctx)
    task_id = auth.get_task_id_from_context(ctx)
    await state_manager.mark_step_as_complete(task_id, user_id, step_id, result)
    await state_manager.add_execution_log(task_id, user_id, "step_completed", {"step_id": step_id}, reasoning)
    return {"status": "success", "message": f"Step {step_id} marked as complete."}

async def evaluate_completion(ctx: Context, reasoning: str) -> Dict:
    """Evaluate if the main goal has been achieved"""
    logger.info(f"Executing tool: evaluate_completion with reasoning='{reasoning}'")
    user_id = auth.get_user_id_from_context(ctx)
    task_id = auth.get_task_id_from_context(ctx)
    task = await state_manager.get_task_state(task_id, user_id)
    
    dynamic_plan = task.get("dynamic_plan", [])
    recent_results_data = {}
    if dynamic_plan:
        recent_results_data = dynamic_plan[-1].get("result", {})

    prompt = COMPLETION_EVALUATION_PROMPT.format(
        main_goal=task.get("orchestrator_state", {}).get("main_goal"),
        context_store=json.dumps(task.get("orchestrator_state", {}).get("context_store", {}), default=str),
        recent_results=json.dumps(recent_results_data, default=str)
    )
    messages = [{'role': 'user', 'content': prompt}]
    final_content_str = ""
    for chunk in run_main_agent(system_message="You are a completion evaluation AI. Respond with JSON.", function_list=[], messages=messages):
        if isinstance(chunk, list) and chunk and chunk[-1].get("role") == "assistant":
            final_content_str = chunk[-1].get("content", "")
            
    decision = JsonExtractor.extract_valid_json(final_content_str)
    if not decision or not isinstance(decision, dict):
        raise ToolError(f"Completion evaluation agent returned invalid or empty JSON. Response: {final_content_str}")

    is_complete = decision.get("is_complete", False)

    if is_complete:
        await state_manager.update_orchestrator_state(task_id, user_id, {"current_state": "COMPLETED"})
        await state_manager.add_execution_log(task_id, user_id, "task_completed", {}, reasoning)
        return {"status": "success", "result": {"is_complete": True}}
    else:
        await state_manager.add_execution_log(task_id, user_id, "completion_evaluation", {"is_complete": False}, reasoning)
        return {"status": "success", "result": {"is_complete": False}}