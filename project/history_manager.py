import json
import os

CHAT_HISTORY_FILE = 'chat_history.json'

def initialize_chat_history_file():
    if not os.path.exists(CHAT_HISTORY_FILE):
        with open(CHAT_HISTORY_FILE, 'w') as f:
            json.dump({}, f)
    else:
        try:
            with open(CHAT_HISTORY_FILE, 'r') as f:
                json.load(f)
        except json.JSONDecodeError:
            print(f"Warning: {CHAT_HISTORY_FILE} is corrupted. Resetting it.")
            with open(CHAT_HISTORY_FILE, 'w') as f:
                json.dump({}, f)

def _read_history():
    initialize_chat_history_file()
    try:
        with open(CHAT_HISTORY_FILE, 'r') as f:
            return json.load(f)
    except Exception as e:
        print(f"Error reading history file: {e}")
        return {}

def _write_history(history_data):
    try:
        with open(CHAT_HISTORY_FILE, 'w') as f:
            json.dump(history_data, f, indent=4)
            f.flush()
            os.fsync(f.fileno())
        return True
    except Exception as e:
        print(f"Error writing history file: {e}")
        return False

def load_all_chat_sessions():
    return _read_history()

def save_chat_session(chat_id, session_data, force_save=False):
    history = _read_history()
    # Only save if the chat has messages or we're forcing save (for new chats)
    if force_save or len(session_data.get("messages", [])) > 0:
        history[chat_id] = session_data
        return _write_history(history)
    return False

def add_message_to_session(chat_id, message):
    history = _read_history()
    if chat_id in history:
        if "messages" not in history[chat_id]:
            history[chat_id]["messages"] = []
        history[chat_id]["messages"].append(message)
        return _write_history(history)
    return False

def get_session_messages(chat_id):
    history = _read_history()
    return history.get(chat_id, {}).get("messages", [])

def delete_chat_session(chat_id):
    history = _read_history()
    if chat_id in history:
        del history[chat_id]
        return _write_history(history)
    return False