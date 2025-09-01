import logging
from typing import Dict
from main.config import INTEGRATIONS_CONFIG

logger = logging.getLogger(__name__)

def get_all_mcp_descriptions() -> Dict[str, str]:
    """
    Creates a dictionary of all available services and their high-level descriptions
    from the main server's integration config.
    """
    if not INTEGRATIONS_CONFIG:
        logging.warning("INTEGRATIONS_CONFIG is empty. No tools will be available to the planner.")
        return {}
    
    mcp_descriptions = {}
    for name, config in INTEGRATIONS_CONFIG.items():
        # The planner agent should not have access to the tasks MCP,
        # as it can lead to recursive loops. The tasks MCP is for the chat agent.
        if name == "tasks":
            continue
        display_name = config.get("display_name")
        description = config.get("description")
        if display_name and description:
            # Use the simple name (e.g., 'gmail') as the key for the planner
            mcp_descriptions[name] = description
            
    return mcp_descriptions