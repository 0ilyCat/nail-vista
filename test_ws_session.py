import asyncio
import json
import websockets

TOKEN = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI5IiwiZXhwIjoxNzgwNzQzNTg3fQ.xYTl6NM2fJw9HxpwizcuGTc5CwjHSlDKjTRa4lTyhAY"

async def drain_until_done(ws, label, timeout=90):
    """从WS中读取所有事件直到收到done或error，返回session_key"""
    session_key = None
    text_chunks = []
    tool_calls = []
    tool_outputs = []
    thinking_chunks = []
    event_count = 0
    
    try:
        while True:
            response = await asyncio.wait_for(ws.recv(), timeout=timeout)
            data = json.loads(response)
            msg_type = data.get("type", "")
            event_count += 1

            if msg_type == "session":
                session_key = data.get("session_key")
                print(f"  [{label}] session: {session_key}")
            elif msg_type == "text":
                content = data.get("content", "")
                text_chunks.append(content)
            elif msg_type == "tool_call":
                tool_calls.append(data.get("name", ""))
                print(f"  [{label}] tool_call: {data.get('name', '')}")
            elif msg_type == "tool_output":
                tool_outputs.append(data.get("name", ""))
                print(f"  [{label}] tool_output: {data.get('name', '')}")
            elif msg_type == "thinking":
                thinking_chunks.append(data.get("content", ""))
            elif msg_type == "done":
                print(f"  [{label}] done (events={event_count}, text_len={sum(len(c) for c in text_chunks)}, tools={len(tool_calls)})")
                break
            elif msg_type == "error":
                print(f"  [{label}] ERROR: {data.get('message', '')}")
                break
            else:
                print(f"  [{label}] unknown event: {msg_type}")
    except asyncio.TimeoutError:
        print(f"  [{label}] TIMEOUT after {event_count} events")
    
    return session_key, "".join(text_chunks), tool_calls

async def test():
    uri = f"ws://localhost:8190/ws/chat/user?token={TOKEN}"
    print("Connecting to WS...")

    async with websockets.connect(uri) as ws:
        # Message 1 - no session_key, should create new session
        msg1 = {"type": "user_message", "text": "你好，帮我推荐一个粉色美甲"}
        print(f"\n=== 发送消息1: {msg1['text']} ===")
        await ws.send(json.dumps(msg1))
        sk1, text1, tools1 = await drain_until_done(ws, "MSG1")
        print(f"  Msg1 session_key: {sk1}")

        # Message 2 - with session_key, should reuse same session
        msg2 = {"type": "user_message", "text": "还有什么其他推荐的吗", "session_key": sk1}
        print(f"\n=== 发送消息2 (session_key={sk1}): {msg2['text']} ===")
        await ws.send(json.dumps(msg2))
        sk2, text2, tools2 = await drain_until_done(ws, "MSG2")
        print(f"  Msg2 session_key: {sk2}")

        # Verify
        print("\n" + "="*60)
        if sk1 and sk2 and sk1 == sk2:
            print(f"PASS: Session reuse verified!")
            print(f"  session_key: {sk1}")
            print(f"  msg1 text length: {len(text1)}")
            print(f"  msg2 text length: {len(text2)}")
        elif sk1 and not sk2:
            print(f"FAIL: Msg2 did not return session_key")
            print(f"  sk1={sk1}, sk2={sk2}")
            print(f"  msg2 text: {text2[:200]}...")
        else:
            print(f"FAIL: session1={sk1}, session2={sk2}")
        
        # Also verify in DB
        TOKEN2 = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI5IiwiZXhwIjoxNzgwNzQzNTg3fQ.xYTl6NM2fJw9HxpwizcuGTc5CwjHSlDKjTRa4lTyhAY"
        import httpx
        async with httpx.AsyncClient() as client:
            r = await client.get("http://localhost:8190/api/chat/sessions", headers={"Authorization": f"Bearer {TOKEN2}"})
            sessions = r.json()
            matching = [s for s in sessions if s["session_key"] == sk1]
            if matching:
                s = matching[0]
                print(f"\nDB verification: session found in DB")
                print(f"  key={s['session_key']}, title={s['title']}, msg_count={s['message_count']}")
                if s["message_count"] >= 4:  # 2 user + 2 assistant
                    print(f"  PASS: message_count={s['message_count']} (>=4, both messages in same session)")
                else:
                    print(f"  WARN: message_count={s['message_count']} (expected >=4)")
            else:
                print(f"\nDB verification: session NOT found (sk={sk1})")

asyncio.run(test())
