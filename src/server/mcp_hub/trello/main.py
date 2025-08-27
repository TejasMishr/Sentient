# src/server/mcp_hub/trello/main.py
import os
from typing import Dict, Any, Optional

from dotenv import load_dotenv
from fastmcp import FastMCP, Context
from fastmcp.utilities.logging import configure_logging, get_logger
from . import auth, utils, prompts

# --- Standardized Logging Setup ---
configure_logging(level="INFO")
logger = get_logger(__name__)

# Load environment
ENVIRONMENT = os.getenv('ENVIRONMENT', 'dev-local')
if ENVIRONMENT == 'dev-local':
    dotenv_path = os.path.join(os.path.dirname(__file__), '..', '..', '.env')
    if os.path.exists(dotenv_path):
        load_dotenv(dotenv_path=dotenv_path)

mcp = FastMCP(
    name="TrelloServer",
    instructions="Provides tools to interact with a user's Trello boards, including listing boards, lists, and creating cards.",
)

@mcp.resource("prompt://gslides-agent-system")
def get_gslides_system_prompt() -> str:
    return prompts.trello_agent_system_prompt

async def _execute_tool(ctx: Context, func, **kwargs) -> Dict[str, Any]:
    """Helper to handle auth and execution for all tools."""
    try:
        user_id = auth.get_user_id_from_context(ctx)
        creds = await auth.get_trello_creds(user_id)
        result = await func(creds=creds, **kwargs)
        return {"status": "success", "result": result}
    except Exception as e:
        logger.error(f"Tool execution failed for '{func.__name__}': {e}", exc_info=True)
        return {"status": "failure", "error": str(e)}

@mcp.tool()
async def list_boards(ctx: Context) -> Dict:
    """
    Retrieves a list of all Trello boards the user has access to, returning their names and IDs.
    """
    logger.info("Executing tool: list_boards")
    return await _execute_tool(ctx, utils.list_boards_util)

@mcp.tool()
async def get_lists_on_board(ctx: Context, board_id: str) -> Dict:
    """
    Retrieves all the lists (e.g., 'To Do', 'In Progress') on a specific Trello board, given the `board_id`.
    """
    logger.info(f"Executing tool: get_lists_on_board with board_id='{board_id}'")
    return await _execute_tool(ctx, utils.get_lists_on_board_util, board_id=board_id)

@mcp.tool()
async def get_cards_in_list(ctx: Context, list_id: str) -> Dict:
    """
    Retrieves all the cards within a specific list, given the `list_id`.
    """
    logger.info(f"Executing tool: get_cards_in_list with list_id='{list_id}'")
    return await _execute_tool(ctx, utils.get_cards_in_list_util, list_id=list_id)

@mcp.tool()
async def create_card(ctx: Context, list_id: str, name: str, desc: Optional[str] = None) -> Dict:
    """
    Creates a new card in a specific list. Requires the `list_id`, a `name` for the card, and an optional description (`desc`).
    """
    logger.info(f"Executing tool: create_card in list_id='{list_id}' with name='{name}'")
    return await _execute_tool(ctx, utils.create_card_util, list_id=list_id, name=name, desc=desc)


@mcp.tool()
async def move_card(ctx: Context, card_id: str, target_list_id: str) -> Dict:
    """
    Moves a card to another list. Requires the `card_id` of the card and the `target_list_id` of the destination list.
    """
    logger.info(f"Executing tool: move_card card_id='{card_id}' -> target_list_id='{target_list_id}'")
    return await _execute_tool(ctx, utils.move_card_util, card_id=card_id, target_list_id=target_list_id)

@mcp.tool()
async def update_card_name(ctx: Context, card_id: str, name: str) -> Dict:
    """
    Updates the name (title) of a card. Requires `card_id` and the new `name`.
    """
    logger.info(f"Executing tool: update_card_name card_id='{card_id}' -> '{name}'")
    return await _execute_tool(ctx, utils.update_card_name_util, card_id=card_id, name=name)

@mcp.tool()
async def update_card_desc(ctx: Context, card_id: str, desc: str) -> Dict:
    """
    Updates the description of a card. Requires `card_id` and the new `desc`.
    """
    logger.info(f"Executing tool: update_card_desc card_id='{card_id}'")
    return await _execute_tool(ctx, utils.update_card_desc_util, card_id=card_id, desc=desc)

@mcp.tool()
async def delete_card(ctx: Context, card_id: str) -> Dict:
    """
    Deletes a card permanently. Requires the `card_id`.
    """
    logger.info(f"Executing tool: delete_card card_id='{card_id}'")
    return await _execute_tool(ctx, utils.delete_card_util, card_id=card_id)

if __name__ == "__main__":
    host = os.getenv("MCP_SERVER_HOST", "127.0.0.1")
    port = int(os.getenv("MCP_SERVER_PORT", 9025))
    print(f"Starting Trello MCP Server on http://{host}:{port}")
    mcp.run(transport="sse", host=host, port=port)