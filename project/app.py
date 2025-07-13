from flask import Flask, request, jsonify, render_template
import os
import uuid
from datetime import datetime
import requests
from dotenv import load_dotenv
from history_manager import (
    load_all_chat_sessions,
    save_chat_session,
    add_message_to_session,
    get_session_messages,
    delete_chat_session,
    initialize_chat_history_file
)

load_dotenv()

app = Flask(__name__)

# Configuration
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "")
GEMINI_API_URL = "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent"

def get_gemini_response(prompt, chat_context=[]):
    if not GEMINI_API_KEY:
        return "Error: Gemini API key not configured."

    formatted_chat_history = []
    for entry in chat_context:
        if entry['role'] == 'user':
            formatted_chat_history.append({"role": "user", "parts": [{"text": entry['content']}]})
        elif entry['role'] == 'assistant':
            formatted_chat_history.append({"role": "model", "parts": [{"text": entry['content']}]})

    formatted_chat_history.append({"role": "user", "parts": [{"text": prompt}]})

    payload = {"contents": formatted_chat_history}
    headers = {'Content-Type': 'application/json'}

    try:
        response = requests.post(f"{GEMINI_API_URL}?key={GEMINI_API_KEY}", headers=headers, json=payload)
        response.raise_for_status()
        result = response.json()

        if result.get("candidates") and len(result["candidates"]) > 0 and \
           result["candidates"][0].get("content") and \
           result["candidates"][0]["content"].get("parts") and \
           len(result["candidates"][0]["content"]["parts"]) > 0:
            return result["candidates"][0]["content"]["parts"][0]["text"]
        return "Sorry, I couldn't get a response from the AI."
    except Exception as e:
        print(f"Error communicating with Gemini API: {e}")
        return f"Error communicating with AI: {str(e)}"

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/chat', methods=['POST'])
def chat():
    user_message = request.json.get('message')
    chat_id = request.json.get('chat_id')

    if not user_message:
        return jsonify({"response": "Please enter a message."}), 400

    if chat_id not in load_all_chat_sessions():
        chat_id = str(uuid.uuid4())
        save_chat_session(chat_id, {
            "title": f"Chat {datetime.now().strftime('%Y-%m-%d %H:%M')}",
            "messages": []
        })

    add_message_to_session(chat_id, {"role": "user", "content": user_message})
    current_chat_messages = get_session_messages(chat_id)
    bot_response = get_gemini_response(user_message, current_chat_messages[:-1])
    add_message_to_session(chat_id, {"role": "assistant", "content": bot_response})

    return jsonify({"response": bot_response, "chat_id": chat_id})

@app.route('/new_chat', methods=['POST'])
def new_chat():
    current_sessions = load_all_chat_sessions()
    current_chat_id = request.json.get('current_chat_id') if 'current_chat_id' in request.json else None
    
    # Save current chat if it has messages
    if current_chat_id and current_chat_id in current_sessions:
        current_messages = get_session_messages(current_chat_id)
        if len(current_messages) > 0:
            save_chat_session(current_chat_id, {
                "title": f"Chat {datetime.now().strftime('%Y-%m-%d %H:%M')}",
                "messages": current_messages
            })

    # Create new chat
    new_chat_id = str(uuid.uuid4())
    save_chat_session(new_chat_id, {
        "title": f"New Chat {datetime.now().strftime('%Y-%m-%d %H:%M')}",
        "messages": []
    }, force_save=True)

    # Get updated history
    updated_sessions = load_all_chat_sessions()
    sessions = [{"id": cid, "title": data["title"]} 
               for cid, data in updated_sessions.items()
               if len(data.get("messages", [])) > 0 or cid == new_chat_id]
    sessions.sort(key=lambda x: x['title'], reverse=True)

    return jsonify({
        "chat_id": new_chat_id,
        "updated_history": sessions,
        "message": "New chat session started."
    })

@app.route('/get_history', methods=['GET'])
def get_history():
    chat_sessions = load_all_chat_sessions()
    # Only return chats with messages
    sessions = [{"id": chat_id, "title": data["title"]} 
               for chat_id, data in chat_sessions.items()
               if len(data.get("messages", [])) > 0]
    sessions.sort(key=lambda x: x['title'], reverse=True)
    return jsonify({"sessions": sessions})

@app.route('/load_chat/<chat_id>', methods=['GET'])
def load_chat(chat_id):
    messages = get_session_messages(chat_id)
    if messages is not None:
        chat_sessions = load_all_chat_sessions()
        title = chat_sessions.get(chat_id, {}).get("title", "Chat Not Found")
        return jsonify({"messages": messages, "title": title})
    return jsonify({"messages": [], "title": "Chat Not Found"}), 404

@app.route('/delete_chat/<chat_id>', methods=['DELETE'])
def delete_chat_route(chat_id):
    try:
        if delete_chat_session(chat_id):
            # Return the updated history list
            chat_sessions = load_all_chat_sessions()
            sessions = [{"id": cid, "title": data["title"]} 
                       for cid, data in chat_sessions.items()
                       if len(data.get("messages", [])) > 0]
            sessions.sort(key=lambda x: x['title'], reverse=True)
            return jsonify({
                "message": "Chat deleted successfully.",
                "deleted_id": chat_id,
                "updated_history": sessions,
                "success": True
            })
        return jsonify({"message": "Chat not found.", "success": False}), 404
    except Exception as e:
        return jsonify({"message": f"Error deleting chat: {str(e)}", "success": False}), 500

if __name__ == '__main__':
    initialize_chat_history_file()
    app.run(debug=True)