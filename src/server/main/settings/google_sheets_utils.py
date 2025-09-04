import os
import logging
from google.oauth2 import service_account
from googleapiclient.discovery import build

logger = logging.getLogger(__name__)

# --- Configuration from Environment Variables ---
GOOGLE_SHEET_ID = os.getenv("GOOGLE_SHEET_ID")
GOOGLE_CLIENT_EMAIL = os.getenv("GOOGLE_CLIENT_EMAIL")
# Private key needs special handling for newline characters when loaded from .env
GOOGLE_PRIVATE_KEY = os.getenv("GOOGLE_PRIVATE_KEY", "").replace('\\n', '\n')

SCOPES = ['https://www.googleapis.com/auth/spreadsheets']
SHEET_NAME = "Sheet2" # Assuming the sheet name is static

def _get_sheets_service():
    """Authenticates and returns a Google Sheets service object."""
    if not all([GOOGLE_SHEET_ID, GOOGLE_CLIENT_EMAIL, GOOGLE_PRIVATE_KEY]):
        logger.warning("Google Sheets credentials are not fully configured. Skipping sheet update.")
        return None

    try:
        creds = service_account.Credentials.from_service_account_info(
            {
                "client_email": GOOGLE_CLIENT_EMAIL,
                "private_key": GOOGLE_PRIVATE_KEY,
                "token_uri": "https://oauth2.googleapis.com/token",
                "project_id": os.getenv("GOOGLE_PROJECT_ID") # Optional but good practice
            },
            scopes=SCOPES
        )
        service = build('sheets', 'v4', credentials=creds)
        return service
    except Exception as e:
        logger.error(f"Failed to create Google Sheets service: {e}", exc_info=True)
        return None

async def update_onboarding_data_in_sheet(user_email: str, onboarding_data: dict, plan: str):
    """Finds a user by email and updates their onboarding information in the sheet."""
    service = _get_sheets_service()
    if not service:
        return

    try:
        # 1. Find user row by email in Column C
        range_to_read = f"{SHEET_NAME}!C:C"
        result = service.spreadsheets().values().get(spreadsheetId=GOOGLE_SHEET_ID, range=range_to_read).execute()
        rows = result.get('values', [])

        row_index = -1
        # Start from row 1 to skip header
        for i, row in enumerate(rows[1:], start=1):
            if row and row[0] == user_email:
                row_index = i
                break

        if row_index == -1:
            logger.warning(f"User with email {user_email} not found in Google Sheet. Cannot update onboarding data.")
            return

        # 2. Prepare data for batch update
        row_number = row_index + 1 # +1 because we skipped header

        # Handle location which can be a string or a dict
        location = onboarding_data.get('location', '')
        if isinstance(location, dict):
            lat = location.get('latitude')
            lon = location.get('longitude')
            if lat is not None and lon is not None:
                location = f"Lat: {lat}, Lon: {lon}"
            else:
                location = str(location)

        # Prepare a list of update requests for different columns
        # New columns: A:Name, B:Contact, C:Email, D:Location, E:Profession, F:Working Hours, G:Key People, H:Personal Context, I:Insider, J:Plan
        data_to_update = [
            # A: Name
            {
                'range': f"{SHEET_NAME}!A{row_number}",
                'values': [[onboarding_data.get('user-name', '')]]
            },
            # B: Contact
            {
                'range': f"{SHEET_NAME}!B{row_number}",
                'values': [[onboarding_data.get('whatsapp_notifications_number', '')]]
            },
            # D: Location, E: Profession, F: Working Hours, G: Key People, H: Personal Context
            {
                'range': f"{SHEET_NAME}!D{row_number}:H{row_number}",
                'values': [[
                    location,
                    onboarding_data.get('professional-context', ''),
                    onboarding_data.get('working-hours', ''),
                    onboarding_data.get('key-people', ''),
                    onboarding_data.get('personal-context', '')
                ]]
            },
            # J: Plan
            {
                'range': f"{SHEET_NAME}!J{row_number}",
                'values': [[plan.capitalize()]]
            }
        ]

        # 3. Update the sheet using batchUpdate to avoid overwriting unrelated columns
        body = {
            'valueInputOption': 'USER_ENTERED',
            'data': data_to_update
        }
        service.spreadsheets().values().batchUpdate(
            spreadsheetId=GOOGLE_SHEET_ID,
            body=body
        ).execute()
        logger.info(f"Successfully updated onboarding data for {user_email} in Google Sheet.")

    except Exception as e:
        logger.error(f"An error occurred while updating Google Sheet for {user_email}: {e}", exc_info=True)
async def update_plan_in_sheet(user_email: str, new_plan: str):
    """Finds a user by email and updates only their plan in the sheet."""
    service = _get_sheets_service()
    if not service:
        return

    try:
        range_to_read = f"{SHEET_NAME}!C:C"
        result = service.spreadsheets().values().get(spreadsheetId=GOOGLE_SHEET_ID, range=range_to_read).execute()
        rows = result.get('values', [])

        row_index = -1
        for i, row in enumerate(rows):
            if row and row[0] == user_email:
                row_index = i
                break

        if row_index != -1:
            range_to_update = f"{SHEET_NAME}!H{row_index + 1}"
            service.spreadsheets().values().update(
                spreadsheetId=GOOGLE_SHEET_ID,
                range=range_to_update,
                valueInputOption='USER_ENTERED',
                body={'values': [[new_plan.capitalize()]]}
            ).execute()
            logger.info(f"Successfully updated plan to '{new_plan}' for {user_email} in Google Sheet.")
        else:
            logger.warning(f"User with email {user_email} not found in Google Sheet. Could not update plan.")
    except Exception as e:
        logger.error(f"An error occurred while updating plan in Google Sheet for {user_email}: {e}", exc_info=True)

async def get_user_properties_from_sheet(user_email: str) -> dict:
    """Finds a user by email and returns their properties from the sheet for analytics."""
    service = _get_sheets_service()
    if not service:
        # Return default properties if sheet service is not available
        return {
            "is_insider": False,
            "plan_type": "free"
        }

    try:
        # Read columns C (Email), I (Insider), J (Plan)
        # Reading C:J is safer to avoid index out of bounds if rows have fewer columns
        range_to_read = f"{SHEET_NAME}!C:J"
        result = service.spreadsheets().values().get(spreadsheetId=GOOGLE_SHEET_ID, range=range_to_read).execute()
        rows = result.get('values', [])

        properties = {
            "is_insider": False,
            "plan_type": "free" # Default to free
        }

        # Column C is index 0 in our `rows` array. I is index 6, J is index 7.
        relative_insider_index = 6
        relative_plan_index = 7

        for row in rows[1:]: # Skip header row
            if not row or len(row) == 0:
                continue

            if row[0] == user_email:
                if len(row) > relative_insider_index and row[relative_insider_index].strip().lower() == 'yes':
                    properties["is_insider"] = True
                if len(row) > relative_plan_index and row[relative_plan_index].strip().lower() == 'pro':
                    properties["plan_type"] = "pro"

                logger.info(f"Found properties for {user_email} in GSheet: {properties}")
                return properties

        logger.warning(f"User with email {user_email} not found in Google Sheet. Returning default properties.")
        return properties

    except Exception as e:
        logger.error(f"An error occurred while reading Google Sheet for {user_email}: {e}", exc_info=True)
        return { "is_insider": False, "plan_type": "free" }