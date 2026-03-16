#!/bin/bash
# =============================================================
# test-metrics.sh — Test Prometheus metrics trên server-nodejs
#
# Mục đích: Sinh traffic đa dạng để verify metrics trong Grafana
#   - 200 OK (public API)
#   - 201 Created (POST requests)
#   - 400 Bad Request (validation errors)
#   - 401 Unauthorized (protected routes)
#   - 404 Not Found (non-existent routes)
#
# Chạy trên VPS:
#   chmod +x test-metrics.sh
#   ./test-metrics.sh https://api.blog.thienduong.info/api/v1
#
# Hoặc test internal (từ trong cluster):
#   kubectl exec -n default deployment/devops-blog-server -- sh -c "..."
# =============================================================

BASE_URL="${1:-https://api.blog.thienduong.info/api}"

# Derive root URL for /health (not under apiPrefix)
ROOT_URL="${BASE_URL%/api}"
PASS=0
FAIL=0

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

log_pass() { echo -e "${GREEN}✅ PASS${NC} $1"; PASS=$((PASS+1)); }
log_fail() { echo -e "${RED}❌ FAIL${NC} $1 — Expected: $2, Got: $3"; FAIL=$((FAIL+1)); }
log_section() { echo -e "\n${BLUE}━━━ $1 ━━━${NC}"; }

check_status() {
    local name="$1"
    local expected="$2"
    local actual="$3"
    if [ "$actual" = "$expected" ]; then
        log_pass "$name (HTTP $actual)"
    else
        log_fail "$name" "$expected" "$actual"
    fi
}

echo -e "${YELLOW}"
echo "╔══════════════════════════════════════════════════╗"
echo "║   🚀 DevOps Blog API — Metrics Test Suite        ║"
echo "║   Target: $BASE_URL"
echo "╚══════════════════════════════════════════════════╝"
echo -e "${NC}"

# ────────────────────────────────────────────────────
log_section "Health Check"
# ────────────────────────────────────────────────────

STATUS=$(curl -s -o /dev/null -w "%{http_code}" "$ROOT_URL/health")
check_status "GET /health" "200" "$STATUS"

# ────────────────────────────────────────────────────
log_section "200 OK — Public Routes"
# ────────────────────────────────────────────────────

STATUS=$(curl -s -o /dev/null -w "%{http_code}" "$BASE_URL/posts/published")
check_status "GET /api/v1/posts/published" "200" "$STATUS"

STATUS=$(curl -s -o /dev/null -w "%{http_code}" "$BASE_URL/posts/published?limit=5&page=1")
check_status "GET /api/v1/posts/published?limit=5&page=1" "200" "$STATUS"

STATUS=$(curl -s -o /dev/null -w "%{http_code}" "$BASE_URL/categories")
check_status "GET /api/v1/categories" "200" "$STATUS"

STATUS=$(curl -s -o /dev/null -w "%{http_code}" "$BASE_URL/tags")
check_status "GET /api/v1/tags" "200" "$STATUS"

# Lấy 1 slug thật từ posts để test
SLUG=$(curl -s "$BASE_URL/posts/published?limit=1" | python3 -c "
import sys,json
try:
    d=json.load(sys.stdin)
    posts=d.get('data',[])
    print(posts[0]['slug'] if posts else 'non-existent-slug')
except: print('non-existent-slug')
" 2>/dev/null)

if [ "$SLUG" != "non-existent-slug" ]; then
    STATUS=$(curl -s -o /dev/null -w "%{http_code}" "$BASE_URL/posts/slug/$SLUG")
    check_status "GET /api/v1/posts/slug/$SLUG" "200" "$STATUS"
    echo "   📝 Test slug: $SLUG"
fi

# ────────────────────────────────────────────────────
log_section "401 Unauthorized — Protected Routes without Token"
# ────────────────────────────────────────────────────

STATUS=$(curl -s -o /dev/null -w "%{http_code}" "$BASE_URL/auth/profile")
check_status "GET /api/v1/auth/profile (no token)" "401" "$STATUS"

STATUS=$(curl -s -o /dev/null -w "%{http_code}" "$BASE_URL/posts")
check_status "GET /api/v1/posts (no token)" "401" "$STATUS"

STATUS=$(curl -s -o /dev/null -w "%{http_code}" \
    -H "Authorization: Bearer invalid.token.here" \
    "$BASE_URL/auth/profile")
check_status "GET /api/v1/auth/profile (invalid token)" "401" "$STATUS"

# ────────────────────────────────────────────────────
log_section "400 Bad Request — Validation Errors"
# ────────────────────────────────────────────────────

# Login với body rỗng
STATUS=$(curl -s -o /dev/null -w "%{http_code}" \
    -X POST "$BASE_URL/auth/login" \
    -H "Content-Type: application/json" \
    -d '{}')
check_status "POST /api/v1/auth/login (empty body)" "400" "$STATUS"

# Login với email sai format
STATUS=$(curl -s -o /dev/null -w "%{http_code}" \
    -X POST "$BASE_URL/auth/login" \
    -H "Content-Type: application/json" \
    -d '{"email": "not-an-email", "password": "123"}')
check_status "POST /api/v1/auth/login (bad email)" "400" "$STATUS"

# Register với password quá ngắn
STATUS=$(curl -s -o /dev/null -w "%{http_code}" \
    -X POST "$BASE_URL/auth/register" \
    -H "Content-Type: application/json" \
    -d '{"email": "test@test.com", "password": "123", "name": "Test"}')
check_status "POST /api/v1/auth/register (weak password)" "400" "$STATUS"

# ────────────────────────────────────────────────────
log_section "404 Not Found — Non-existent Routes"
# ────────────────────────────────────────────────────

STATUS=$(curl -s -o /dev/null -w "%{http_code}" "$BASE_URL/non-existent-route")
check_status "GET /api/v1/non-existent-route" "404" "$STATUS"

STATUS=$(curl -s -o /dev/null -w "%{http_code}" "$BASE_URL/posts/slug/absolutely-fake-slug-xyz-999")
check_status "GET /api/v1/posts/slug/absolutely-fake-slug-xyz-999" "404" "$STATUS"

# ────────────────────────────────────────────────────
log_section "Auth Flow — Login & Use Token"
# ────────────────────────────────────────────────────

echo "  Testing login with wrong credentials..."
STATUS=$(curl -s -o /dev/null -w "%{http_code}" \
    -X POST "$BASE_URL/auth/login" \
    -H "Content-Type: application/json" \
    -d '{"email": "nonexistent@test.com", "password": "wrongpassword123"}')
check_status "POST /api/v1/auth/login (wrong credentials)" "401" "$STATUS"

# ────────────────────────────────────────────────────
log_section "Load Generation — 10 requests /posts/published"
# ────────────────────────────────────────────────────

echo "  Sending 10 requests để tạo data cho Grafana charts..."
for i in $(seq 1 10); do
    curl -s -o /dev/null "$BASE_URL/posts/published?page=$i" &
done
wait
log_pass "10x GET /posts/published (background requests)"

# ────────────────────────────────────────────────────
log_section "Check /metrics Endpoint (Internal)"
# ────────────────────────────────────────────────────

echo "  Checking metrics endpoint từ trong cluster..."
METRICS=$(kubectl exec -n default deployment/devops-blog-server -- \
    wget -qO- http://localhost:3001/metrics 2>/dev/null)

if echo "$METRICS" | grep -q "http_requests_total"; then
    log_pass "/metrics có http_requests_total counter"
else
    log_fail "/metrics" "http_requests_total" "not found"
fi

if echo "$METRICS" | grep -q "http_request_duration_ms_bucket"; then
    log_pass "/metrics có http_request_duration_ms_bucket histogram"
else
    log_fail "/metrics" "http_request_duration_ms histogram" "not found"
fi

if echo "$METRICS" | grep -q "nodejs_heap_size_used_bytes"; then
    log_pass "/metrics có nodejs_heap_size_used_bytes"
else
    log_fail "/metrics" "nodejs_heap runtime metrics" "not found"
fi

# Đếm số route đã được track
ROUTE_COUNT=$(echo "$METRICS" | grep 'http_requests_total{' | wc -l)
echo "  📊 Số route/method/status combinations đã track: $ROUTE_COUNT"

# Show sample metrics giá trị
echo ""
echo "  📈 Sample http_requests_total values:"
echo "$METRICS" | grep 'http_requests_total{' | head -8 | while read line; do
    echo "     $line"
done

# ────────────────────────────────────────────────────
echo ""
echo -e "${YELLOW}━━━ TEST RESULTS ━━━${NC}"
echo -e "  ${GREEN}PASSED: $PASS${NC}"
echo -e "  ${RED}FAILED: $FAIL${NC}"
echo ""

if [ $FAIL -eq 0 ]; then
    echo -e "${GREEN}🎉 Tất cả tests PASSED! Metrics đang hoạt động đúng.${NC}"
    echo ""
    echo "  ➡️  Kiểm tra Grafana dashboard 'API Performance' để xem:"
    echo "     - Request rate per route"
    echo "     - Error rate (401s, 400s, 404s)"
    echo "     - Latency P95/P99"
else
    echo -e "${RED}⚠️  Có $FAIL test FAILED. Kiểm tra lại server logs.${NC}"
fi
echo ""
