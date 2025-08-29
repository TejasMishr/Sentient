import logging
from typing import Dict, Any
import datetime
from workers.celery_app import celery_app
from workers.utils.api_client import notify_user
from workers.planner.db import PlannerMongoManager
import httpx
import json
from json_extractor import JsonExtractor
from main.llm import run_agent as run_main_agent
from mcp_hub.orchestrator.prompts import (
    ORCHESTRATOR_SYSTEM_PROMPT, STEP_PLANNING_PROMPT,
    COMPLETION_EVALUATION_PROMPT, FOLLOW_UP_DECISION_PROMPT
)
from main.config import INTEGRATIONS_CONFIG

logger = logging.getLogger(__name__)

# Helper to run async code in Celery's sync context
def run_async(coro):
    import asyncio
    loop = asyncio.new_event_loop()
    asyncio.set_event_loop(loop)
    try:
        return loop.run_until_complete(coro)
    finally:
        from mcp_hub.memory.db import close_db_pool_for_loop
        loop.run_until_complete(close_db_pool_for_loop(loop))
        loop.close()
        asyncio.set_event_loop(None)

@celery_app.task(name="start_long_form_task")
def start_long_form_task(task_id: str, user_id: str):
    """Initialize and start a long-form task."""
    logger.info(f"Initializing long-form task {task_id} for user {user_id}")
    run_async(async_start_long_form_task(task_id, user_id))

async def async_start_long_form_task(task_id: str, user_id: str):
    db_manager = PlannerMongoManager()
    try:
        await db_manager.update_task_field(task_id, user_id, {
            "orchestrator_state.current_state": "PLANNING",
            "status": "processing" # Visually indicate that something is happening
        })
        logger.info(f"Long-form task {task_id} moved to PLANNING state.")

        # Immediately trigger the first orchestrator cycle to generate the initial plan
        execute_orchestrator_cycle.delay(task_id)
        logger.info(f"Dispatched orchestrator cycle for task {task_id}.")

    except Exception as e:
        logger.error(f"Error starting long-form task {task_id}: {e}", exc_info=True)
        await db_manager.update_task_field(task_id, user_id, {
            "orchestrator_state.current_state": "FAILED",
            "status": "error",
            "error": f"Failed to start orchestrator: {str(e)}"
        })
    finally:
        await db_manager.close()

@celery_app.task(name="execute_orchestrator_cycle")
def execute_orchestrator_cycle(task_id: str):
    """Main orchestrator execution cycle."""
    logger.info(f"Executing orchestrator cycle for task {task_id}")
    run_async(async_execute_orchestrator_cycle(task_id))

async def async_execute_orchestrator_cycle(task_id: str):
    db_manager = PlannerMongoManager()
    try:
        task = await db_manager.get_task(task_id)
        if not task:
            logger.error(f"Orchestrator cycle: Task {task_id} not found.")
            return

        user_id = task.get("user_id")
        orchestrator_state = task.get("orchestrator_state", {})
        current_state = orchestrator_state.get("current_state")

        # If the task is in a terminal or waiting state, do not run the cycle.
        # The cycle will be re-triggered by user action, a timeout handler, or a sub-task completion.
        if current_state in ["COMPLETED", "FAILED", "SUSPENDED", "PAUSED", "WAITING"]:
            logger.info(f"Orchestrator cycle for task {task_id} skipped. State is '{current_state}'.")
            return

        # NEW: Block if waiting for subtask (prevents race during subtask exec)
        if orchestrator_state.get("waiting_for_subtask"):
            logger.info(f"Orchestrator cycle for task {task_id} skipped. Waiting for sub-task {orchestrator_state['waiting_for_subtask']} to complete.")
            return

        # 1. Construct context for the agent
        orchestrator_state = task.get("orchestrator_state", {})
        context_for_prompt = {
            "task_id": task_id,
            "main_goal": orchestrator_state.get("main_goal"),
            "current_state": current_state,
            "dynamic_plan": json.dumps(task.get("dynamic_plan", []), default=str),
            "context_store": orchestrator_state.get("context_store", {}),
            "execution_log": (task.get("execution_log") or [])[-5:],
            "clarification_history": json.dumps(task.get("clarification_requests", []), default=str)
        }

        # 2. Determine the right prompt based on the current state
        user_prompt = ""
        if current_state == "WAITING":
            waiting_config = orchestrator_state.get("waiting_config", {})

            started_at = waiting_config.get("started_at", datetime.datetime.now(datetime.timezone.utc))
            # Ensure the datetime from DB is timezone-aware before subtraction
            if started_at and started_at.tzinfo is None:
                started_at = started_at.replace(tzinfo=datetime.timezone.utc)

            time_elapsed_delta = datetime.datetime.now(datetime.timezone.utc) - started_at

            user_prompt = FOLLOW_UP_DECISION_PROMPT.format( # noqa: E501
                waiting_for=waiting_config.get("waiting_for"),
                time_elapsed=str(time_elapsed_delta),
                previous_attempts=waiting_config.get("current_retries", 0),
                context=json.dumps({k: v for k, v in context_for_prompt.items() if k != 'task_id'}, default=str)
            )
        else: # PLANNING or ACTIVE
            user_prompt = STEP_PLANNING_PROMPT.format(**context_for_prompt)

        # 3. Run the orchestrator agent to get the next tool call
        orchestrator_config = INTEGRATIONS_CONFIG.get("orchestrator", {})
        mcp_config = orchestrator_config.get("mcp_server_config", {})

        if not mcp_config or not mcp_config.get("url"):
            raise ValueError("Orchestrator MCP server URL is not configured in INTEGRATIONS_CONFIG.")

        mcp_servers_to_use = {
            mcp_config["name"]: {
                "url": mcp_config["url"],
                "headers": {"X-User-ID": user_id, "X-Task-ID": task_id}
            }
        }
        function_list = [{"mcpServers": mcp_servers_to_use}]

        system_prompt = ORCHESTRATOR_SYSTEM_PROMPT.format(
            **context_for_prompt
        )
        # NEW: Reconstruct full messages with history
        messages = [{'role': 'system', 'content': system_prompt}]  # Start with system as history[0]
        orchestrator_history = task.get("orchestrator_history", [])
        if orchestrator_history:
            for past_cycle in orchestrator_history:
                # Add a separator message for clarity
                messages.append({
                    "role": "system",
                    "content": f"--- PAST CYCLE ({past_cycle.get('cycle_timestamp', 'N/A')}): ---"
                })
                messages.extend(past_cycle.get("messages", []))  # Append past assistant/tool messages
            # Add another separator before current prompt
            messages.append({
                "role": "system",
                "content": "--- CURRENT CYCLE: Proceed with the next action based on the above history. ---"
            })
        messages.append({'role': 'user', 'content': user_prompt})  # End with current instruction
        
        final_agent_response = None
        for chunk in run_main_agent(system_message="", function_list=function_list, messages=messages):
            if isinstance(chunk, list) and chunk:
                final_agent_response = chunk

        if final_agent_response:
            logger.info(f"Orchestrator agent for task {task_id} produced final history: \n{json.dumps(final_agent_response, indent=2, default=str)}")
            # NEW: Append the full agent response (history slice) to orchestrator_history
            orchestrator_history = task.get("orchestrator_history", [])
            if not isinstance(orchestrator_history, list):
                orchestrator_history = []
            # Append only the new assistant messages from this cycle
            assistant_messages = [msg for msg in final_agent_response if msg.get("role") in ["assistant", "function"]]
            orchestrator_history.append({
                "cycle_timestamp": datetime.datetime.now(datetime.timezone.utc).isoformat(),
                "messages": assistant_messages
            })
            # Limit to last 10 cycles to avoid token explosion
            if len(orchestrator_history) > 10:
                orchestrator_history = orchestrator_history[-10:]
            await db_manager.update_task_field(task_id, user_id, {"orchestrator_history": orchestrator_history})
            logger.info(f"Appended {len(assistant_messages)} messages to orchestrator_history for task {task_id}.")
        else:
            logger.error(f"Orchestrator agent for task {task_id} did not produce a response.")
            raise Exception("Orchestrator agent failed to produce a response.")

        # Process the agent's turn sequentially
        if final_agent_response:
            for i, msg in enumerate(final_agent_response):
                if msg.get("role") == "assistant" and msg.get("function_call"):
                    tool_call = msg["function_call"]
                    tool_name = tool_call.get("name")
                    logger.info(f"Orchestrator agent for task {task_id} called tool: {tool_name}")

                    # Find the corresponding result which should be the next message in the history
                    tool_result = None
                    if i + 1 < len(final_agent_response):
                        next_msg = final_agent_response[i+1]
                        if next_msg.get("role") == "function" and next_msg.get("name") == tool_name:
                            tool_content = next_msg.get("content", "{}")
                            tool_result = JsonExtractor.extract_valid_json(tool_content)

                    if not tool_result:
                        logger.error(f"Could not find a valid result for tool call '{tool_name}' for task {task_id}. History might be malformed.")
                        raise Exception(f"Orchestrator tool call '{tool_name}' did not yield a valid result.")

                    if tool_result.get("status") != "success":
                        raise Exception(f"Orchestrator tool '{tool_name}' failed: {tool_result.get('error')}")

                    logger.info(f"Orchestrator tool '{tool_name}' for task {task_id} executed successfully.")

    except Exception as e:
        logger.error(f"Error in orchestrator cycle for task {task_id}: {e}", exc_info=True)
        await db_manager.update_task_field(task_id, user_id, {"orchestrator_state.current_state": "FAILED", "status": "error", "error": f"Orchestrator cycle failed: {str(e)}"})
    finally:
        await db_manager.close()

async def async_handle_waiting_timeout(task_id: str, waiting_type: str):
    db_manager = PlannerMongoManager()
    try:
        task = await db_manager.get_task(task_id)
        if not task:
            logger.warning(f"Timeout handler: Task {task_id} not found.")
            return

        orchestrator_state = task.get("orchestrator_state", {})
        current_state = orchestrator_state.get("current_state")
        waiting_config = orchestrator_state.get("waiting_config", {})

        # Only proceed if the task is still in the expected waiting state and the timeout has actually passed
        if current_state == "WAITING" and waiting_config.get("waiting_for") == waiting_type:
            timeout_at = waiting_config.get("timeout_at")
            if timeout_at and datetime.datetime.now(datetime.timezone.utc) >= timeout_at:
                logger.info(f"Task {task_id} has timed out. Transitioning to ACTIVE and triggering orchestrator.")
                user_id = task.get("user_id")
                if not user_id:
                    logger.error(f"Cannot update task {task_id}, user_id is missing.")
                    return
                await db_manager.update_task_field(task_id, user_id, {"orchestrator_state.current_state": "ACTIVE"})
                execute_orchestrator_cycle.delay(task_id)
            else:
                logger.info(f"Timeout handler for task {task_id} ran, but timeout has not been reached. No action taken.")
        else:
            logger.info(f"Timeout handler for task {task_id} ran, but task is no longer in the expected WAITING state (current: {current_state}). No action taken.")
    finally:
        await db_manager.close()

@celery_app.task(name="handle_waiting_timeout")
def handle_waiting_timeout(task_id: str, waiting_type: str):
    """Handle timeout for waiting tasks."""
    logger.info(f"Handling timeout for task {task_id}, waiting for {waiting_type}")
    run_async(async_handle_waiting_timeout(task_id, waiting_type))

@celery_app.task(name="process_external_trigger")
def process_external_trigger(task_id: str, trigger_data: Dict):
    """Process external triggers (emails, calendar events, etc.)"""
    logger.info(f"Processing external trigger for task {task_id}")
    run_async(async_process_external_trigger(task_id, trigger_data))

async def async_process_external_trigger(task_id: str, trigger_data: Dict):
    db_manager = PlannerMongoManager()
    try:
        task = await db_manager.get_task(task_id)
        if not task:
            logger.error(f"Cannot process external trigger for task {task_id}: Task not found.")
            return
        user_id = task.get("user_id")
        if not user_id:
            logger.error(f"Cannot process external trigger for task {task_id}: user_id not found in task.")
            return
        # 1. Update context store with new information
        await db_manager.update_task_field(task_id, user_id, {f"orchestrator_state.context_store.trigger_{datetime.datetime.now(datetime.timezone.utc).isoformat()}": trigger_data})
        # 2. Resume task execution
        execute_orchestrator_cycle.delay(task_id)
    finally:
        await db_manager.close()