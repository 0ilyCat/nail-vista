"""
E2E Test: Verify WebSocket "New Chat" creates a new session instead of reusing old one.
"""
import asyncio
import json
import websockets

BACKEND = "http://localhost:8190"
WS_URL = "ws://localhost:8190/ws/chat/user"


async def register_user():
    import httpx
    async with httpx.AsyncClient() as client:
        r = await client.post(f"{BACKEND}/api/auth/register", json={
            "username": "test_newchat",
            "password": "Test123456",
            "nickname": "TestNewChat",
        })
        print(f"[REGISTER] status={r.status_code}")
        if r.status_code in (200, 201):
            data = r.json()
            return data.get("token") or data.get("access_token")

        r2 = await client.post(f"{BACKEND}/api/auth/login", json={
            "username": "test_newchat",
            "password": "Test123456",
        })
        print(f"[LOGIN] status={r2.status_code}")
        data = r2.json()
        return data.get("token") or data.get("access_token")


async def run_test():
    token = await register_user()
    if not token:
        print("FAIL: no token")
        return False
    print(f"OK: token={token[:20]}...")

    url = f"{WS_URL}?token={token}"
    print(f"[WS] connecting to {url}")

    async with websockets.connect(url) as ws:
        print("[WS] connected\n")

        # Round 1: send message without session_key
        msg1 = "recommend red nails"
        print(f"-- Round 1: '{msg1}' --")
        await ws.send(json.dumps({"type": "user_message", "text": msg1}))

        session_key_1 = None
        done_1 = False
        while not done_1:
            raw = await ws.recv()
            data = json.loads(raw)
            t = data.get("type")
            if t == "session":
                session_key_1 = data["session_key"]
                print(f"  [session] key={session_key_1}")
            elif t == "text":
                safe = data['content'][:60].encode('ascii', errors='replace').decode('ascii')
                print(f"  [text] {safe}...")
            elif t == "tool_call":
                print(f"  [tool_call] {data['name']}")
            elif t == "tool_output":
                print(f"  [tool_output] {data['name']}")
            elif t == "done":
                done_1 = True
                print(f"  [done] round 1 complete")
            elif t == "error":
                print(f"  [error] {data['message']}")
                return False

        print(f"  Round 1 session_key = {session_key_1}")
        assert session_key_1, "FAIL: round 1 did not return session_key"
        print("  OK: round 1 created new session\n")

        # Round 2: send message WITHOUT session_key (simulates "New Chat")
        msg2 = "recommend blue nails"
        print(f"-- Round 2 (no session_key): '{msg2}' --")
        await ws.send(json.dumps({"type": "user_message", "text": msg2}))

        session_key_2 = None
        done_2 = False
        while not done_2:
            raw = await ws.recv()
            data = json.loads(raw)
            t = data.get("type")
            if t == "session":
                session_key_2 = data["session_key"]
                print(f"  [session] key={session_key_2}")
            elif t == "text":
                safe = data['content'][:60].encode('ascii', errors='replace').decode('ascii')
                print(f"  [text] {safe}...")
            elif t == "tool_call":
                print(f"  [tool_call] {data['name']}")
            elif t == "tool_output":
                print(f"  [tool_output] {data['name']}")
            elif t == "done":
                done_2 = True
                print(f"  [done] round 2 complete")
            elif t == "error":
                print(f"  [error] {data['message']}")
                return False

        print(f"  Round 2 session_key = {session_key_2}")
        assert session_key_2, "FAIL: round 2 did not return session_key"

        # Verification
        if session_key_1 == session_key_2:
            print(f"\nFAIL: Both rounds used same session_key: {session_key_1}")
            print("The backend reused the old session instead of creating a new one.")
            return False
        else:
            print(f"\nPASS: Two different sessions created")
            print(f"  session_1 = {session_key_1}")
            print(f"  session_2 = {session_key_2}")
            return True


if __name__ == "__main__":
    result = asyncio.run(run_test())
    exit(0 if result else 1)
