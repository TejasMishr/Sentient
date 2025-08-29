import os
from typing import Dict, Any, Optional, List

from dotenv import load_dotenv
from fastmcp import FastMCP, Context
from json_extractor import JsonExtractor
from datetime import datetime
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

from . import auth, prompts
from main.dependencies import mongo_manager # This is the main server's mongo manager
from main.llm import run_agent, LLMProviderDownError
from workers.long_form_tasks import start_long_form_task
from workers.tasks import generate_plan_from_context
from workers.utils.text_utils import clean_llm_output

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
    Creates a new task to be managed by the long-form orchestrator.
    Use this for complex, multi-step goals or simple one-off requests.
    The orchestrator will create a dynamic plan and execute it to achieve the goal.
    For recurring or triggered tasks, use the `create_workflow` tool.
    """
    try:
        user_id = auth.get_user_id_from_context(ctx)

        task_data = {
            "name": prompt,
            "description": prompt,
            "task_type": "long_form",
            "auto_approve_subtasks": auto_approve_subtasks,
            "orchestrator_state": {
                "main_goal": prompt,
                "current_state": "CREATED",
            },
            "original_context": {
                "source": "mcp_create_task",
                "prompt": prompt
            }
        }
        task_id = await mongo_manager.add_task(user_id, task_data)
        if not task_id:
            raise Exception("Failed to create the task in the database.")

        start_long_form_task.delay(task_id, user_id)

        short_name = prompt[:50] + '...' if len(prompt) > 50 else prompt
        return {"status": "success", "result": f"Task '{short_name}' has been created and is being planned by the orchestrator."}
    except Exception as e:
        logger.error(f"Error in create_task: {e}", exc_info=True)
        return {"status": "failure", "error": str(e)}

@mcp.tool()
async def create_workflow(ctx: Context, prompt: str) -> Dict[str, Any]:
    """
    Creates a new recurring or triggered workflow from a natural language `prompt`.
    Use this for tasks that need to run on a schedule (e.g., 'every day at 9am') or based on a trigger (e.g., 'when a new email arrives').
    An internal AI analyzes the prompt to extract the schedule and goal, then creates the workflow and queues it for planning.
    For simple, one-off tasks, use the `create_task` tool instead.
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

        # 3. Construct task data and save to DB
        schedule = parsed_data.get("schedule")
        task_data = {
            "name": parsed_data.get("name", prompt),
            "description": parsed_data.get("description", prompt),
            "priority": parsed_data.get("priority", 1),
            "schedule": schedule,
            "task_type": schedule.get("type") if schedule else "single", # Should be recurring/triggered
            "original_context": {"source": "chat_prompt", "prompt": prompt}
        }

        task_id = await mongo_manager.add_task(user_id, task_data)

        if not task_id:
            raise Exception("Failed to save the parsed task to the database.")
        
        # 4. Dispatch the PLANNER worker, not the refiner.
        generate_plan_from_context.delay(task_id, user_id)

        short_name = task_data["name"][:50] + '...' if len(task_data["name"]) > 50 else task_data["name"]
        return {"status": "success", "result": f"Task '{short_name}' has been created and is being planned."}
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

        cursor = mongo_manager.task_collection.find(mongo_query).sort([("priority", 1), ("created_at", -1)]).limit(20)
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