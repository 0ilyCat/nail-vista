"""端到端测试: 后端WS + OpenClaw流式模型调用"""
import asyncio, httpx, json, websockets, time

async def test():
    async with httpx.AsyncClient(base_url='http://localhost:8190') as client:
        # 注册获取token（register直接返回token）
        r = await client.post('/api/auth/register', json={
            'username': f'e2e_stream_{int(time.time())}',
            'password': 'Test123456',
            'nickname': 'E2E流式测试'
        })
        data = r.json()
        token = data.get('access_token')
        if not token:
            print(f'Auth failed: {r.text[:300]}')
            return
        print(f'Token OK')

        # 测试WS连接
        ws_url = f'ws://localhost:8190/ws/chat/user?token={token}'
        print(f'Connecting...')
        async with websockets.connect(ws_url) as ws:
            # 发送简单消息（不触发工具调用）
            await ws.send(json.dumps({'type':'user_message','text':'你好'}))
            print('Message sent, waiting for streaming response...')
            start = time.time()

            full_text = ''
            first_token_time = None
            for i in range(60):
                try:
                    msg = await asyncio.wait_for(ws.recv(), timeout=120)
                    data = json.loads(msg)
                    t = data.get('type','?')
                    if t == 'text':
                        if not first_token_time:
                            first_token_time = time.time()
                            print(f'First token in {first_token_time - start:.1f}s')
                        full_text += data.get('content','')
                        print(data.get('content',''), end='', flush=True)
                    elif t == 'thinking':
                        print(f'[THINKING round={data.get("round")} len={len(data.get("content",""))}]', end='', flush=True)
                    elif t == 'done':
                        elapsed = time.time() - start
                        print(f'\n[DONE] total={elapsed:.1f}s text_len={len(full_text)}')
                        break
                    elif t == 'error':
                        print(f'\n[ERROR] {data.get("message")}')
                        break
                    else:
                        print(f'\n[{t}] {json.dumps(data, ensure_ascii=False)[:120]}')
                except asyncio.TimeoutError:
                    print('\nTIMEOUT')
                    break

            # 测试工具调用
            print('\n\n--- Tool call test ---')
            await ws.send(json.dumps({'type':'user_message','text':'帮我找红色猫眼款式'}))
            start = time.time()
            full_text2 = ''
            tool_calls_seen = 0
            for i in range(60):
                try:
                    msg = await asyncio.wait_for(ws.recv(), timeout=120)
                    data = json.loads(msg)
                    t = data.get('type','?')
                    if t == 'text':
                        full_text2 += data.get('content','')
                        print(data.get('content',''), end='', flush=True)
                    elif t == 'tool_call':
                        tool_calls_seen += 1
                        print(f'\n[TOOL_CALL] fn={data.get("name")} args={json.dumps(data.get("arguments",{}), ensure_ascii=False)[:80]}', flush=True)
                    elif t == 'tool_output':
                        output = data.get('output','')
                        print(f'\n[TOOL_OUTPUT] fn={data.get("name")} error={data.get("error")} len={len(output)}', flush=True)
                    elif t == 'thinking':
                        print(f'[THINKING round={data.get("round")}]', flush=True)
                    elif t == 'done':
                        elapsed = time.time() - start
                        print(f'\n[DONE] total={elapsed:.1f}s text_len={len(full_text2)} tools={tool_calls_seen}')
                        break
                    elif t == 'error':
                        print(f'\n[ERROR] {data.get("message")}')
                        break
                    else:
                        print(f'\n[{t}] {json.dumps(data, ensure_ascii=False)[:100]}')
                except asyncio.TimeoutError:
                    print('\nTIMEOUT')
                    break

asyncio.run(test())
