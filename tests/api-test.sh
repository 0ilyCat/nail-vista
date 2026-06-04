#!/bin/bash
# NailVista API 完整测试脚本
API="http://localhost:8190/api"
PYTHON="D:/anaconda3/envs/nail/python.exe"
PASS=0
FAIL=0

ok() { PASS=$((PASS+1)); echo "  ✅ $1"; }
fail() { FAIL=$((FAIL+1)); echo "  ❌ $1 (expected: $2, got: $3)"; }

echo "=========================================="
echo "  NailVista API 测试"
echo "=========================================="

# ---- 健康检查 ----
echo ""
echo "【1】健康检查"
R=$(curl -s $API/health)
if echo "$R" | grep -q '"ok"'; then ok "health"; else fail "health" "ok" "$R"; fi

# ---- 认证 ----
echo ""
echo "【2】认证"
# 登录
R=$(curl -s -X POST $API/auth/login -H "Content-Type: application/json" -d '{"username":"xiaomei","password":"123456"}')
TOKEN=$(echo "$R" | $PYTHON -c "import sys,json; print(json.load(sys.stdin).get('access_token',''))" 2>/dev/null)
if [ -n "$TOKEN" ]; then ok "login"; else fail "login" "token" "$R"; fi

# 获取个人信息
R=$(curl -s $API/auth/me -H "Authorization: Bearer $TOKEN")
if echo "$R" | grep -q '"xiaomei"'; then ok "auth/me"; else fail "auth/me" "xiaomei" "$R"; fi

# 无效token 401
R=$(curl -s -o /dev/null -w "%{http_code}" $API/auth/me -H "Authorization: Bearer invalid")
if [ "$R" = "401" ]; then ok "invalid token -> 401"; else fail "invalid token" "401" "$R"; fi

# 注册
TS=$(date +%s)
R=$(curl -s -X POST $API/auth/register -H "Content-Type: application/json" -d "{\"username\":\"apitest_${TS}\",\"password\":\"123456\",\"nickname\":\"API\"}")
if echo "$R" | grep -q 'access_token'; then ok "register"; else fail "register" "token" "$R"; fi

# ---- 美甲款式 ----
echo ""
echo "【3】美甲款式"
R=$(curl -s "$API/styles?page_size=3")
if echo "$R" | $PYTHON -c "import sys,json; d=json.load(sys.stdin); assert d['total']==25; assert len(d['items'])==3" 2>/dev/null; then
  ok "styles list (25 total, 3 items)"
else fail "styles list" "25 total" "$(echo $R | head -c 100)"; fi

R=$(curl -s $API/styles/26)
if echo "$R" | grep -q '"merchant"'; then ok "styles/26 detail (with merchant)"; else fail "styles/26" "merchant info" "$(echo $R | head -c 100)"; fi

R=$(curl -s $API/styles/99999)
if echo "$R" | grep -q '404\|不存在'; then ok "styles/99999 -> 404"; else fail "styles/99999" "404" "$R"; fi

R=$(curl -s "$API/styles/hot/ranking?limit=5")
C=$(echo "$R" | $PYTHON -c "import sys,json; d=json.load(sys.stdin); print(len(d))" 2>/dev/null)
if [ "$C" -ge 1 ]; then ok "hot ranking ($C items)"; else fail "hot ranking" ">=1" "$C"; fi

R=$(curl -s $API/styles/categories)
C=$(echo "$R" | $PYTHON -c "import sys,json; d=json.load(sys.stdin); print(len(d))" 2>/dev/null)
if [ "$C" -ge 1 ]; then ok "categories ($C)"; else fail "categories" ">=1" "$C"; fi

# ---- 帖子 ----
echo ""
echo "【4】帖子社区"
R=$(curl -s "$API/posts?page_size=3")
if echo "$R" | $PYTHON -c "import sys,json; d=json.load(sys.stdin); assert d['total']==10" 2>/dev/null; then
  ok "posts list (10 total)"
else fail "posts list" "10" "$(echo $R | head -c 100)"; fi

# 帖子点赞 (需登录)
R=$(curl -s -X POST $API/posts/20/like -H "Authorization: Bearer $TOKEN")
if echo "$R" | grep -q 'liked'; then ok "post like toggle"; else fail "post like" "liked" "$R"; fi

# 未登录点赞
R=$(curl -s -o /dev/null -w "%{http_code}" -X POST $API/posts/20/like)
if [ "$R" = "401" ]; then ok "post like without auth -> 401"; else fail "post like noauth" "401" "$R"; fi

# ---- 商家 ----
echo ""
echo "【5】商家"
R=$(curl -s $API/merchants)
if echo "$R" | $PYTHON -c "import sys,json; d=json.load(sys.stdin); assert d['total']==3" 2>/dev/null; then
  ok "merchants list (3 total)"
else fail "merchants" "3" "$(echo $R | head -c 100)"; fi

R=$(curl -s $API/merchants/4)
if echo "$R" | grep -q '"styles"'; then ok "merchant/4 detail (with styles)"; else fail "merchant/4" "styles" "$(echo $R | head -c 100)"; fi

R=$(curl -s $API/merchants/cities)
C=$(echo "$R" | $PYTHON -c "import sys,json; d=json.load(sys.stdin); print(len(d))" 2>/dev/null)
if [ "$C" -ge 1 ]; then ok "merchant cities ($C)"; else fail "cities" ">=1" "$C"; fi

# ---- 收藏 ----
echo ""
echo "【6】收藏"
R=$(curl -s -X POST $API/favorites/merchants/4 -H "Authorization: Bearer $TOKEN")
if echo "$R" | grep -q 'favorited'; then ok "fav merchant toggle"; else fail "fav merchant" "favorited" "$R"; fi

R=$(curl -s -X POST $API/favorites/styles/26 -H "Authorization: Bearer $TOKEN")
if echo "$R" | grep -q 'favorited'; then ok "fav style toggle"; else fail "fav style" "favorited" "$R"; fi

# ---- 预约 ----
echo ""
echo "【7】预约"
R=$(curl -s -X POST $API/appointments -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" -d '{"merchant_id":4,"style_id":26,"notes":"test","price":128}')
if echo "$R" | grep -q '"id"'; then ok "create appointment"; else fail "appointment create" "id" "$R"; fi

R=$(curl -s "$API/appointments?page_size=5" -H "Authorization: Bearer $TOKEN")
if echo "$R" | $PYTHON -c "import sys,json; d=json.load(sys.stdin); assert d['total']>=1" 2>/dev/null; then
  ok "appointments list"
else fail "appointments" ">=1" "$(echo $R | head -c 100)"; fi

# ---- 搜索 ----
echo ""
echo "【8】搜索"
R=$(curl -s --get "$API/search" --data-urlencode "q=猫眼")
if echo "$R" | grep -q '"styles"'; then ok "search (猫眼)"; else fail "search" "styles" "$(echo $R | head -c 100)"; fi

# ---- 仪表盘 (商家) ----
echo ""
echo "【9】商家仪表盘"
# 商家登录
R=$(curl -s -X POST $API/auth/login -H "Content-Type: application/json" -d '{"username":"merchant01","password":"123456"}')
MTOKEN=$(echo "$R" | $PYTHON -c "import sys,json; print(json.load(sys.stdin).get('access_token',''))" 2>/dev/null)

R=$(curl -s $API/dashboard/overview -H "Authorization: Bearer $MTOKEN")
if echo "$R" | grep -q 'total_appointments'; then ok "dashboard overview"; else fail "dashboard" "overview" "$(echo $R | head -c 100)"; fi

R=$(curl -s $API/dashboard/revenue -H "Authorization: Bearer $MTOKEN")
if echo "$R" | grep -q '"today"'; then ok "dashboard revenue"; else fail "dashboard rev" "today" "$(echo $R | head -c 100)"; fi

# ---- 试戴 ----
echo ""
echo "【10】试戴"
R=$(curl -s $API/tryon/hand-images -H "Authorization: Bearer $TOKEN")
if echo "$R" | grep -q '"image_url"'; then ok "hand images"; else fail "hand images" "image_url" "$(echo $R | head -c 100)"; fi

# ---- 结果汇总 ----
echo ""
echo "=========================================="
echo "  结果: $PASS 通过, $FAIL 失败 ($((PASS+FAIL)) 总)"
echo "=========================================="
if [ $FAIL -gt 0 ]; then exit 1; fi
