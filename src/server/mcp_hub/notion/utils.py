from typing import Dict, List, Any

def _simplify_rich_text(rich_text_array: List[Dict]) -> str:
    """Converts a Notion rich text array to a simple string."""
    return "".join(item.get("plain_text", "") for item in rich_text_array)

def _simplify_block(block: Dict) -> Dict:
    """Converts a Notion block object to a simplified dictionary."""
    block_type = block.get("type")
    text_content = ""
    extra_data = {}
    if block_type and block.get(block_type):
        content = block[block_type]
        rich_text = content.get("rich_text")
        if rich_text:
            text_content = _simplify_rich_text(rich_text)
        if block_type == "to_do":
            extra_data["checked"] = content.get("checked", False)
        if block_type == "code":
            extra_data["language"] = content.get("language", "")

    return {
        "id": block.get("id"),
        "type": block_type,
        "content": text_content,
        "has_children": block.get("has_children", False),
        "extra": extra_data
    }

def simplify_block_children(response: Dict) -> List[Dict]:
    """Simplifies a list of blocks from a Notion API response into a list of simplified block dictionaries."""
    return [_simplify_block(block) for block in response.get("results", [])]

def format_simplified_blocks_to_text(simplified_blocks: List[Dict]) -> str:
    """Formats a list of simplified block dictionaries into a markdown-like string."""
    lines = []
    for block in simplified_blocks:
        block_type = block.get("type")
        text = block.get("content", "")

        line = text
        if block_type == "heading_1": line = f"# {text}"
        elif block_type == "heading_2": line = f"## {text}"
        elif block_type == "heading_3": line = f"### {text}"
        elif block_type == "bulleted_list_item": line = f"- {text}"
        elif block_type == "numbered_list_item": line = f"1. {text}" # Simplified numbering
        elif block_type == "to_do":
            checked = "[x]" if block.get("extra", {}).get("checked") else "[ ]"
            line = f"{checked} {text}"
        elif block_type == "quote": line = f"> {text}"
        elif block_type == "code":
            lang = block.get("extra", {}).get("language", "")
            line = f"```{lang}\n{text}\n```"

        if line:
            lines.append(line)
    return "\n".join(lines)


def simplify_search_results(response: Dict) -> List[Dict]:
    """Simplifies a list of pages or databases from a Notion search API response."""
    simplified_items = []
    for item in response.get("results", []):
        item_type = item.get("object")
        item_id = item.get("id")
        title_list = []

        if item_type == "page":
            # Title for a page is inside properties
            title_list = item.get("properties", {}).get("title", {}).get("title", [])
        elif item_type == "database":
            # Title for a database is at the top level
            title_list = item.get("title", [])

        title = _simplify_rich_text(title_list) if title_list else f"Untitled {item_type}"

        simplified_item = {
            "type": item_type,
            "id": item_id,
            "title": title,
        }
        if item.get("url"):
            simplified_item["url"] = item.get("url")

        simplified_items.append(simplified_item)
    return simplified_items


def _simplify_property(prop: Dict) -> Any:
    """Simplifies a single Notion database page property."""
    prop_type = prop.get("type")
    if not prop_type or not prop.get(prop_type):
        return None
    
    content = prop[prop_type]
    
    if prop_type == "title":
        return _simplify_rich_text(content)
    if prop_type == "rich_text":
        return _simplify_rich_text(content)
    if prop_type == "number":
        return content
    if prop_type == "select":
        return content.get("name") if content else None
    if prop_type == "multi_select":
        return [item.get("name") for item in content]
    if prop_type == "date":
        return content.get("start")
    if prop_type == "checkbox":
        return content
    if prop_type == "url":
        return content
    if prop_type == "email":
        return content
    # Add other types as needed
    return f"[{prop_type.upper()}]"


def simplify_database_pages(response: Dict) -> List[Dict]:
    """Simplifies a list of pages from a Notion database query response."""
    simplified_pages = []
    for page in response.get("results", []):
        properties = page.get("properties", {})
        simplified_props = {
            name: _simplify_property(prop_data)
            for name, prop_data in properties.items()
        }
        simplified_pages.append({
            "page_id": page.get("id"),
            "properties": simplified_props,
        })
    return simplified_pages
def _simplify_user(user: Dict) -> Dict:
    """Simplifies a Notion user object."""
    return {
        "id": user.get("id"),
        "name": user.get("name"),
        "type": user.get("type"),
        "email": user.get("person", {}).get("email") if user.get("type") == "person" else None
    }

def _simplify_comment(comment: Dict) -> Dict:
    """Simplifies a Notion comment object."""
    return {
        "id": comment.get("id"),
        "text": _simplify_rich_text(comment.get("rich_text", [])),
        "created_by": _simplify_user(comment.get("created_by", {})),
        "created_time": comment.get("created_time")
    }
