"""
Telegram MTProto Session Authenticator for SocialPulse AI.
Run this script to authenticate your Telegram account with your API ID & Hash.
It generates a persistent session file and exports a TELEGRAM_SESSION_STRING for Render cloud deployment.

Usage:
    python utils/telegram_login.py
"""
import os
import sys
from pathlib import Path
from dotenv import load_dotenv

# Load backend environment
BASE_DIR = Path(__file__).resolve().parent.parent
load_dotenv(BASE_DIR / ".env")

from telethon.sync import TelegramClient
from telethon.sessions import StringSession

api_id_str = os.getenv("TELEGRAM_API_ID") or os.getenv("TELEGRAM_API_KEY")
api_hash = os.getenv("TELEGRAM_API_HASH")

if not api_id_str or not api_hash:
    print("❌ Error: TELEGRAM_API_ID or TELEGRAM_API_HASH not found in backend/.env")
    sys.exit(1)

api_id = int(api_id_str)
session_file = str(BASE_DIR / "data" / "telegram_session")

print("=" * 60)
print("🚀 TELEGRAM MTPROTO SESSION AUTHENTICATOR (SocialPulse AI)")
print("=" * 60)
print(f"API ID:   {api_id}")
print(f"API Hash: {api_hash[:6]}...****")
print("\nConnecting to Telegram MTProto server...")

client = TelegramClient(StringSession(), api_id, api_hash)
client.connect()

if not client.is_user_authorized():
    phone = input("\nEnter your Telegram phone number with country code (e.g. +91XXXXXXXXXX): ").strip()
    client.send_code_request(phone)
    code = input("Enter the 5-digit verification code sent to your Telegram app: ").strip()
    try:
        client.sign_in(phone, code)
    except Exception as e:
        if "Two-steps verification" in str(e) or "SessionPasswordNeededError" in str(e):
            pwd = input("Two-Step Verification Password required. Enter password: ")
            client.sign_in(password=pwd)
        else:
            raise e

me = client.get_me()
session_string = client.session.save()

print("\n" + "=" * 60)
print("✅ TELEGRAM MTPROTO SESSION SUCCESSFULLY CREATED!")
print("=" * 60)
print(f"User:     {me.first_name} (@{me.username or 'No Username'})")
print(f"User ID:  {me.id}")
print(f"Phone:    {me.phone}")
print("\n🔑 Your TELEGRAM_SESSION_STRING (Copy this for Render Deployment):")
print("-" * 60)
print(session_string)
print("-" * 60)

# Also save session file to data directory
file_client = TelegramClient(session_file, api_id, api_hash)
file_client.connect()
print(f"\n📁 Local session saved to: {session_file}.session")
print("SocialPulse AI can now fetch messages from all your authorized groups & channels!")
print("=" * 60)
