# server/mcp_hub/quickchart/main.py

import os
from typing import Dict, Any, Optional


from dotenv import load_dotenv
from fastmcp import FastMCP, Context
from fastmcp.prompts.prompt import Message
from fastmcp.utilities.logging import configure_logging, get_logger

from . import auth, prompts, utils

# --- Standardized Logging Setup ---
configure_logging(level="INFO")
logger = get_logger(__name__)

# Load .env file for 'dev-local' environment.
ENVIRONMENT = os.getenv('ENVIRONMENT', 'dev-local')
if ENVIRONMENT == 'dev-local':
    dotenv_path = os.path.join(os.path.dirname(__file__), '..', '..', '.env')
    if os.path.exists(dotenv_path):
        load_dotenv(dotenv_path=dotenv_path)
mcp = FastMCP(
    name="QuickChartServer",
    instructions="Provides tools to generate chart images from data using the QuickChart.io service, which is based on the Chart.js library.",
)

# --- Prompt Registration ---
@mcp.resource("prompt://quickchart-agent-system")
def get_quickchart_system_prompt() -> str:
    return prompts.quickchart_agent_system_prompt


# --- Tool Definitions ---

@mcp.tool
async def generate_chart(ctx: Context, chart_config: Dict[str, Any]) -> Dict[str, Any]:
    """
    Generates a public URL for a chart image.
    Requires a `chart_config` dictionary that follows the Chart.js configuration format.
    """
    logger.info(f"Executing tool: generate_chart")
    try:
        auth.get_user_id_from_context(ctx)
        chart_url = utils.generate_chart_url(chart_config)
        return {"status": "success", "result": {"chart_url": chart_url}}
    except Exception as e:
        logger.error(f"Tool generate_chart failed: {e}", exc_info=True)
        return {"status": "failure", "error": str(e)}

# Removed download chart tool for now, will add it back when we have proper file management for indivisual users.

# --- Server Execution ---
if __name__ == "__main__":
    host = os.getenv("MCP_SERVER_HOST", "127.0.0.1")
    port = int(os.getenv("MCP_SERVER_PORT", 9008))
    
    print(f"Starting QuickChart MCP Server on http://{host}:{port}")
    mcp.run(transport="sse", host=host, port=port)