import os
from typing import Dict, Any, Optional, List

from dotenv import load_dotenv
from fastmcp import FastMCP, Context
from json_extractor import JsonExtractor
from datetime import datetime
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError
from main.llm import run_agent as run_main_agent
from . import auth, prompts
from main.dependencies import mongo_manager # This is the main server's mongo manager
from main.llm import LLMProviderDownError
from workers.long_form_tasks import start_long_form_task
from workers.tasks import generate_plan_from_context
from workers.utils.text_utils import clean_llm_output
from .prompts import TASK_CREATION_PROMPT

from fastmcp.utilities.logging import configure_logging, get_logger

# --- Standardized Logging Setup ---
configure_logging(level="INFO")
logger = get_logger(__name__)

# Conditionally load .env for local development
ENVIRONMENT = os.getenv('ENVIRONMENT', 'dev-local')
if ENVIRONMENT == 'dev-local':
    dotenv_path = os.path.join(os.path.dirname(__file__), '..', '..', '.env')
    if os.path.exists(dotenv_path):
        load_dotenv(dotenv_path=dotenv_path)

mcp = FastMCP(
    name="TasksServer",
    instructions="Provides tools for creating and searching user tasks that can be planned and executed by AI agents.",
)

# --- Prompt Registration ---
@mcp.resource("prompt://tasks-agent-system")
def get_tasks_system_prompt() -> str:
    return prompts.tasks_agent_system_prompt

@mcp.tool()
async def create_task(ctx: Context, prompt: str, auto_approve_subtasks: bool = False) -> Dict[str, Any]:
    """
    Intelligently creates a task that needs to be executed IMMEDIATELY.
    It determines if the task is simple (one-shot) or complex (long-form) and creates the appropriate task type.
    Use this for any immediate action that is not scheduled for the future.
    """
    try:
        user_id = auth.get_user_id_from_context(ctx)

        # 1. Get user context for the LLM prompt
        user_profile = await mongo_manager.get_user_profile(user_id)
        personal_info = user_profile.get("userData", {}).get("personalInfo", {}) if user_profile else {}
        user_name = personal_info.get("name", "User")
        user_timezone_str = personal_info.get("timezone", "UTC")
        try:
            user_timezone = ZoneInfo(user_timezone_str)
        except ZoneInfoNotFoundError:
            user_timezone = ZoneInfo("UTC")
        current_time_str = datetime.now(user_timezone).strftime('%Y-%m-%d %H:%M:%S %Z')

        # 2. Call LLM to parse prompt into structured data
        system_prompt = TASK_CREATION_PROMPT.format(
            user_name=user_name,
            user_timezone=user_timezone_str,
            current_time=current_time_str
        )
        messages = [{'role': 'user', 'content': prompt}]

        response_str = ""
        for chunk in run_main_agent(system_message=system_prompt, function_list=[], messages=messages):
            if isinstance(chunk, list) and chunk and chunk[-1].get("role") == "assistant":
                response_str = chunk[-1].get("content", "")

        if not response_str:
            raise Exception("LLM failed to generate task details.")

        parsed_data = JsonExtractor.extract_valid_json(clean_llm_output(response_str))
        if not parsed_data or not isinstance(parsed_data, dict):
            raise Exception(f"LLM returned invalid JSON for task details: {response_str}")

        # 3. Triage based on parsed data
        task_type_from_llm = parsed_data.get("task_type")

        if task_type_from_llm == "long_form":
            task_type = "long_form"
        else:
            task_type = "single" # Default to single for immediate tasks from chat

        task_data = {
            "name": parsed_data.get("name", prompt),
            "description": parsed_data.get("description", prompt),
            "task_type": task_type,
            "auto_approve_subtasks": auto_approve_subtasks,
            "orchestrator_state": {
                "main_goal": parsed_data.get("description", prompt),
                "current_state": "CREATED",
            } if task_type == "long_form" else None,
            "original_context": {
                "source": "mcp_create_task",
                "prompt": prompt
            }
        }
        task_id = await mongo_manager.add_task(user_id, task_data)
        if not task_id:
            raise Exception("Failed to create the task in the database.")

        if task_type == "long_form":
            start_long_form_task.delay(task_id, user_id)
        else: # single
            generate_plan_from_context.delay(task_id, user_id)

        short_name = parsed_data.get("name", prompt)[:50] + '...' if len(prompt) > 50 else parsed_data.get("name", prompt)
        return {"status": "success", "result": f"Task '{short_name}' has been created and is being planned."}
    except Exception as e:
        logger.error(f"Error in create_task: {e}", exc_info=True)
        return {"status": "failure", "error": str(e)}

@mcp.tool()
async def create_workflow(ctx: Context, prompt: str) -> Dict[str, Any]:
    """
    Use this tool for any task that runs on a SCHEDULE (e.g., 'tomorrow at 9am', 'every Friday') or is based on a TRIGGER (e.g., 'when a new email arrives').
    An internal AI will parse the prompt to determine the exact schedule or trigger and create the appropriate task or workflow.
    """
    try:
        user_id = auth.get_user_id_from_context(ctx)

        # 1. Get user context for the LLM prompt
        user_profile = await mongo_manager.get_user_profile(user_id)
        personal_info = user_profile.get("userData", {}).get("personalInfo", {}) if user_profile else {}
        user_name = personal_info.get("name", "User")
        user_timezone_str = personal_info.get("timezone", "UTC")
        try:
            user_timezone = ZoneInfo(user_timezone_str)
        except ZoneInfoNotFoundError:
            user_timezone = ZoneInfo("UTC")
        current_time_str = datetime.now(user_timezone).strftime('%Y-%m-%d %H:%M:%S %Z')

        # 2. Call LLM to parse prompt into structured data
        system_prompt = prompts.TASK_CREATION_PROMPT.format(
            user_name=user_name,
            user_timezone=user_timezone_str,
            current_time=current_time_str
        )
        messages = [{'role': 'user', 'content': prompt}]

        response_str = ""
        for chunk in run_agent(system_message=system_prompt, function_list=[], messages=messages):
            if isinstance(chunk, list) and chunk and chunk[-1].get("role") == "assistant":
                response_str = chunk[-1].get("content", "")

        if not response_str:
            raise Exception("LLM failed to generate task details.")

        parsed_data = JsonExtractor.extract_valid_json(clean_llm_output(response_str))
        if not parsed_data or not isinstance(parsed_data, dict):
            raise Exception(f"LLM returned invalid JSON for task details: {response_str}")

        # 3. Triage the parsed data to create the correct task type
        schedule = parsed_data.get("schedule")
        is_immediate_one_shot = schedule and schedule.get("type") == "once" and schedule.get("run_at") is None

        if is_immediate_one_shot:
            # This is an immediate task, so it should be a long-form task.
            task_data = {
                "name": parsed_data.get("name", prompt),
                "description": parsed_data.get("description", prompt),
                "task_type": "long_form",
                "auto_approve_subtasks": False,
                "orchestrator_state": {
                    "main_goal": parsed_data.get("description", prompt),
                    "current_state": "CREATED",
                },
                "original_context": {
                    "source": "mcp_workflow_redirect",
                    "prompt": prompt
                }
            }
            task_id = await mongo_manager.add_task(user_id, task_data)
            if not task_id:
                raise Exception("Failed to create the long-form task in the database.")
            start_long_form_task.delay(task_id, user_id)
            message = f"Task '{task_data['name'][:50]}' has been created and is being planned by the orchestrator."
        else:
            # This is a scheduled, recurring, or triggered task.
            task_data = {
                "name": parsed_data.get("name", prompt),
                "description": parsed_data.get("description", prompt),
                "priority": parsed_data.get("priority", 1),
                "schedule": schedule,
                "task_type": schedule.get("type") if schedule else "single",
                "original_context": {"source": "chat_prompt", "prompt": prompt}
            }
            task_id = await mongo_manager.add_task(user_id, task_data)
            if not task_id:
                raise Exception("Failed to save the parsed task to the database.")
            generate_plan_from_context.delay(task_id, user_id)
            message = f"Task '{task_data['name'][:50]}' has been created and is being planned."

        return {"status": "success", "result": message}
    except LLMProviderDownError as e:
        logger.error(f"LLM provider down during task creation from prompt for user {user_id}: {e}", exc_info=True)
        return {"status": "failure", "error": "Sorry, our AI provider is currently down. Please try again later."}
    except Exception as e:
        logger.error(f"Error in create_workflow: {e}", exc_info=True)
        return {"status": "failure", "error": str(e)}

@mcp.tool()
async def search_tasks(
    ctx: Context, 
    query: Optional[str] = None,
    status_list: Optional[List[str]] = None,
    priority_list: Optional[List[int]] = None,
    start_date: Optional[str] = None,
    end_date: Optional[str] = None
) -> Dict[str, Any]:
    """
    Performs an advanced search for tasks using various filters like a text `query`, `status_list` (e.g., 'pending', 'active'), `priority_list` (0=High, 1=Medium, 2=Low), or a date range.
    """
    try:
        user_id = auth.get_user_id_from_context(ctx)

        # Build the MongoDB query dynamically
        mongo_query: Dict[str, Any] = {"user_id": user_id}
        
        if query:
            mongo_query["$text"] = {"$search": query}
        if status_list:
            mongo_query["status"] = {"$in": status_list}
        if priority_list:
            mongo_query["priority"] = {"$in": priority_list}
        
        date_filter = {}
        if start_date:
            date_filter["$gte"] = datetime.fromisoformat(start_date.replace("Z", "+00:00"))
        if end_date:
            date_filter["$lte"] = datetime.fromisoformat(end_date.replace("Z", "+00:00"))
        
        if date_filter:
            # We search against `next_execution_at` for scheduled tasks and `created_at` for others as a fallback
            mongo_query["$or"] = [
                {"next_execution_at": date_filter},
                {"created_at": date_filter, "next_execution_at": None}
            ]

        cursor = mongo_manager.tasks_collection.find(mongo_query).sort([("priority", 1), ("created_at", -1)]).limit(20)
        tasks = await cursor.to_list(length=20)

        return {"status": "success", "result": {"tasks": tasks}}
    except Exception as e:
        logger.error(f"Error in search_tasks: {e}", exc_info=True)
        return {"status": "failure", "error": str(e)}

if __name__ == "__main__":
    host = os.getenv("MCP_SERVER_HOST", "127.0.0.1")
    port = int(os.getenv("MCP_SERVER_PORT", 9018))
    
    print(f"Starting Tasks MCP Server on http://{host}:{port}")
    mcp.run(transport="sse", host=host, port=port)