from pydantic import BaseModel, Field
from typing import Optional, Dict, Any, List

class WhatsAppNumberRequest(BaseModel):
    whatsapp_number: Optional[str] = ""

class WhatsAppMcpRequest(BaseModel):
    whatsapp_mcp_number: Optional[str] = ""

class WhatsAppNotificationNumberRequest(BaseModel):
    whatsapp_notifications_number: Optional[str] = ""

class WhatsAppNotificationRequest(BaseModel):
    enabled: bool

class ProfileUpdateRequest(BaseModel):
    onboardingAnswers: Dict[str, Any]
    personalInfo: Dict[str, Any]
    preferences: Dict[str, Any]

class WhatsAppVerifyRequest(BaseModel):
    phone_number: str