import re
from typing import List, Dict, Any
from json_extractor import JsonExtractor

def clean_llm_output(text: str) -> str:
    """
    Removes reasoning tags (e.g., <think>...</think>) and trims whitespace from LLM output.
    """
    if not isinstance(text, str):
        return ""
    # Use re.DOTALL to make '.' match newlines, and '?' for non-greedy matching.
    cleaned_text = re.sub(r'<think>.*?</think>', '', text, flags=re.DOTALL)
    return cleaned_text.strip()

def parse_assistant_response(messages: List[Dict[str, Any]]) -> Dict[str, Any]:
    """
    Parses conversation history and stores reasoning, tool calls, and tool results
    in chronological order as `turn_steps`, along with the final user-facing content.
    """
    turn_steps = []
    final_content = ""

    for msg in messages:
        role = msg.get("role", "")
        content = msg.get("content", "")

        # ✅ Thoughts from assistant content that is NOT a tool call
        if role == "assistant" and content and "function_call" not in msg:
            # The agent's reasoning/thought process is the content of assistant messages before the final answer.
            # We can capture all non-final assistant messages as thoughts.
            # We will determine the "final_content" at the end.
            turn_steps.append({
                "type": "thought",
                "content": content.strip()
            })

        # ✅ Tool calls
        if role == "assistant" and "function_call" in msg and msg["function_call"]:
            tool_call = msg["function_call"]
            turn_steps.append({
                "type": "tool_call",
                "tool_name": tool_call.get("name"),
                "arguments": tool_call.get("arguments")
            })

        # ✅ Tool results
        if role == "function":
            turn_steps.append({
                "type": "tool_result",
                "tool_name": msg.get("name"),
                "result": msg.get("content", "").strip()
            })

    # ✅ Extract final user-facing message (last assistant message without function_call)
    for msg in reversed(messages):
        if msg.get("role") == "assistant" and "function_call" not in msg and msg.get("content"):
            text = msg.get("content", "").strip()
            if text:
                final_content = text
                # Since we found the final content, remove the last "thought" we added for it.
                if turn_steps and turn_steps[-1]["type"] == "thought" and turn_steps[-1]["content"] == text:
                    turn_steps.pop()
                break

    return {
        "final_content": final_content,
        "turn_steps": turn_steps
    }