import httpx
from typing import Dict, Any, Optional

PLACES_API_ENDPOINT = "https://places.googleapis.com/v1/places:searchText"
DIRECTIONS_API_ENDPOINT = "https://routes.googleapis.com/directions/v2:computeRoutes"

async def search_places_util(api_key: str, query: str) -> Dict[str, Any]:
    headers = {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": api_key,
        "X-Goog-FieldMask": "places.displayName,places.formattedAddress,places.id",
    }
    data = {"textQuery": query, "maxResultCount": 5}

    async with httpx.AsyncClient() as client:
        response = await client.post(PLACES_API_ENDPOINT, headers=headers, json=data)
        response.raise_for_status()
        return response.json()

async def get_directions_util(api_key: str, origin: str, destination: str, mode: str) -> Dict[str, Any]:
    headers = {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": api_key,
        "X-Goog-FieldMask": "routes.duration,routes.distanceMeters,routes.legs.steps.navigationInstruction",
    }
    # Map user-friendly modes to API-specific modes
    # The API expects DRIVE, WALK, BICYCLE, TRANSIT.
    # The tool's docstring uses DRIVING, WALKING, BICYCLING.
    mode_mapping = {
        "DRIVING": "DRIVE",
        "WALKING": "WALK",
        "BICYCLING": "BICYCLE",
        "TRANSIT": "TRANSIT",
    }
    api_mode = mode_mapping.get(mode.upper(), "DRIVE")  # Default to DRIVE if mode is invalid

    def _create_waypoint(location_str: str) -> Dict[str, str]:
        """Creates a Waypoint object, detecting if the input is a Place ID or an address."""
        if location_str.startswith("ChIJ"):
            return {"placeId": location_str}
        return {"address": location_str}

    data = {
        "origin": _create_waypoint(origin),
        "destination": _create_waypoint(destination),
        "travelMode": api_mode,
        "computeAlternativeRoutes": False,
        "units": "METRIC"
    }

    async with httpx.AsyncClient() as client:
        response = await client.post(DIRECTIONS_API_ENDPOINT, headers=headers, json=data)
        response.raise_for_status()
        return response.json()