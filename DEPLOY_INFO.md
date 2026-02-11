# 📋 THÔNG TIN DEPLOY - SERVER-NODEJS (Backend API)

> Tài liệu này tổng hợp toàn bộ thông tin cần thiết để deploy service `server-nodejs`,
> được tham chiếu từ service `client` (đã deploy thành công).

---

## PHẦN 1: THÔNG TIN CƠ BẢN (Tech Stack)

| Mục | Thông tin |
|---|---|
| **Tên Project (Jenkins/SonarQube)** | `devops-blog-server` |
| **Link GitHub Repo** | https://github.com/ThienDuong2909/DailyDevOps_Server.git |
| **Ngôn ngữ & Framework** | **Node.js / Express.js** (converted từ NestJS) |
| **ORM** | **Prisma** (v5.8.0) với `@prisma/client` |
| **Version ngôn ngữ** | **Node 18** (Alpine - theo Dockerfile) / Tool Jenkins: **Node 20** |
| **Package Manager** | **npm** (sử dụng `package-lock.json`, lệnh `npm ci`) |

### So sánh với Client (đã deploy thành công):

| Mục | Client ✅ | Server-NodeJS 🔧 |
|---|---|---|
| Framework | Next.js 14 (TypeScript) | Express.js (JavaScript) |
| Node Version | 18-alpine (Docker) / 20 (Jenkins) | 18-alpine (Docker) / 20 (Jenkins) |
| Package Manager | npm | npm |
| GitHub Repo | `ThienDuong2909/DailyDevOps` | `ThienDuong2909/DailyDevOps_Server` |
| Docker Image Name | `devops-blog-client` | `devops-blog-server` ⚠️ *(cần sửa trong Jenkinsfile, hiện vẫn là `devops-blog-client`)* |

---

## PHẦN 2: DOCKER & BUILD

### 2.1. Dockerfile hiện tại ✅ (Đã có - Multi-stage Build)

```dockerfile
# Stage 1: Install dependencies and Build
FROM node:18-alpine AS builder
WORKDIR /app

# Install all dependencies (including dev)
COPY package*.json ./
RUN npm ci

# Copy prisma schema and generate client
COPY prisma ./prisma/
RUN npx prisma generate

# Copy source code
COPY . .

# Stage 2: Production Runner
FROM node:18-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production

# Install only production dependencies
COPY package*.json ./
RUN npm ci --omit=dev && npm cache clean --force

# Create non-root user
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 expressjs

# Copy source code
COPY ./src ./src
COPY ./prisma ./prisma

# Copy the generated Prisma Client from the builder stage
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder /app/node_modules/@prisma ./node_modules/@prisma

USER expressjs

EXPOSE 3001

CMD ["npm", "start"]
```

### 2.2. Lệnh Build

| Mục | Chi tiết |
|---|---|
| **Lệnh Build** | Không cần build step riêng (pure JavaScript, không transpile). Chỉ cần `npx prisma generate` để tạo Prisma Client. |
| **Lệnh Start (Production)** | `npm start` → `node src/server.js` |
| **Lệnh Start (Development)** | `npm run dev` → `nodemon src/server.js` |
| **Port ứng dụng** | **3001** |

### 2.3. .dockerignore

```
node_modules
.git
.env
.env.local
dist
coverage
npm-debug.log
Dockerfile
.dockerignore
.gitignore
README.md
```

---

## PHẦN 3: BIẾN MÔI TRƯỜNG (.ENV) - QUAN TRỌNG 🔐

### 3.1. Danh sách các biến cần thiết

```env
# === Server Configuration ===
NODE_ENV=                          # production / development
PORT=                              # 3001
API_PREFIX=                        # api

# === Database (MySQL - Prisma) ===
DATABASE_URL=                      # mysql://user:password@host:3306/dbname

# === JWT Secrets ===
JWT_ACCESS_SECRET=                 # Secret key cho Access Token
JWT_REFRESH_SECRET=                # Secret key cho Refresh Token
JWT_ACCESS_EXPIRES_IN=             # 15m (thời gian hết hạn access token)
JWT_REFRESH_EXPIRES_IN=            # 7d (thời gian hết hạn refresh token)

# === CORS ===
CORS_ORIGIN=                       # URL Frontend (vd: https://blog.thienduong.info)

# === Rate Limiting ===
RATE_LIMIT_WINDOW_MS=              # 60000 (1 phút)
RATE_LIMIT_MAX_REQUESTS=           # 100

# === Swagger ===
SWAGGER_ENABLED=                   # true / false
```

### 3.2. Build-time vs Run-time

| Loại | Biến | Giải thích |
|---|---|---|
| **Build-time** (cần lúc Docker build) | `DATABASE_URL` | Cần cho `npx prisma generate` trong Dockerfile stage builder. Tuy nhiên, Prisma generate chỉ cần schema, **không cần kết nối DB thật** → Có thể dùng dummy URL lúc build. |
| **Run-time** (cần lúc container chạy) | **TẤT CẢ các biến** | Tất cả đều được đọc lúc runtime qua `dotenv` và `process.env` |

> 💡 **Lưu ý quan trọng**: Khác với Client (cần `NEXT_PUBLIC_*` lúc build vì Next.js inline vào bundle), Server **KHÔNG CẦN** biến môi trường thật lúc build. Tất cả biến được đọc lúc runtime.

### 3.3. So sánh cách inject env với Client

| | Client ✅ | Server-NodeJS 🔧 |
|---|---|---|
| **Thời điểm inject** | Lúc Build (Jenkins tạo `.env.production` trước `docker build`) | Lúc Run (inject vào K8s Pod qua `ConfigMap` / `Secret`) |
| **Cách inject** | `withCredentials` → write `.env.production` → COPY vào image | K8s `env` hoặc `envFrom` trong `deployment.yaml` |
| **Biến quan trọng** | `NEXT_PUBLIC_API_URL`, `NEXT_PUBLIC_APP_URL` | `DATABASE_URL`, `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`, `CORS_ORIGIN` |

### 3.4. Credentials cần tạo trên Jenkins (nếu muốn inject giống Client)

| Jenkins Credential ID (gợi ý) | Biến tương ứng | Loại |
|---|---|---|
| `SERVER_DATABASE_URL` | `DATABASE_URL` | Secret text |
| `SERVER_JWT_ACCESS_SECRET` | `JWT_ACCESS_SECRET` | Secret text |
| `SERVER_JWT_REFRESH_SECRET` | `JWT_REFRESH_SECRET` | Secret text |
| `SERVER_CORS_ORIGIN` | `CORS_ORIGIN` | Secret text |

---

## PHẦN 4: DATABASE & MIGRATION

### 4.1. Thông tin Database

| Mục | Chi tiết |
|---|---|
| **Loại Database** | **MySQL** |
| **ORM** | Prisma v5.8.0 |
| **Connection String Format** | `mysql://user:password@host:3306/dbname` |
| **Hiện trạng** | ✅ **Đã có sẵn** (bên ngoài K8s - Remote MySQL server tại `45.252.248.106:3306`) |

### 4.2. Lệnh Migration

| Lệnh | Mục đích | Khi nào chạy |
|---|---|---|
| `npx prisma generate` | Tạo Prisma Client từ schema | Lúc **Docker build** (đã có trong Dockerfile) |
| `npx prisma migrate deploy` | Chạy migration trên production DB | **Trước khi app chạy** (lần đầu deploy hoặc khi có thay đổi schema) |
| `npx prisma migrate dev` | Tạo & chạy migration (dev only) | Chỉ dùng trong development |
| `npx prisma db seed` → `node prisma/seed.js` | Seed data mẫu | Tùy chọn, khi cần data ban đầu |

### 4.3. Prisma Schema - Các bảng chính

| Model | Bảng MySQL | Mô tả |
|---|---|---|
| `User` | `users` | Quản lý người dùng (ADMIN, MODERATOR, EDITOR, VIEWER) |
| `Category` | `categories` | Danh mục bài viết (hỗ trợ sub-category) |
| `Tag` | `tags` | Tag/nhãn cho bài viết |
| `Post` | `posts` | Bài viết blog (DRAFT, PUBLISHED, SCHEDULED, ARCHIVED) |
| `Comment` | `comments` | Bình luận (hỗ trợ reply, trạng thái duyệt) |
| `SeoSetting` | `seo_settings` | Cấu hình SEO cho bài viết |
| `Subscriber` | `subscribers` | Người đăng ký nhận tin |
| `SystemSetting` | `system_settings` | Cài đặt hệ thống |
| `ActivityLog` | `activity_logs` | Nhật ký hoạt động |

### 4.4. Khuyến nghị cho K8s Deployment

```yaml
# Có thể thêm initContainer để chạy migration trước khi app khởi động
initContainers:
  - name: run-migrations
    image: thienduong2909/devops-blog-server:<tag>
    command: ["npx", "prisma", "migrate", "deploy"]
    env:
      - name: DATABASE_URL
        valueFrom:
          secretKeyRef:
            name: server-secrets
            key: DATABASE_URL
```

---

## PHẦN 5: TÍCH HỢP CI/CD (Theo quy trình mới)

### 5.1. SonarQube

| Mục | Cấu hình đề xuất |
|---|---|
| **Project Key** | `devops-blog-server` |
| **Project Name** | `DevOps Blog Server` |
| **Quality Gate** | ✅ **Block** (chặn pipeline nếu code bị lỗi) - Giống Client |
| **Exclusions** | `node_modules/**,coverage/**,prisma/migrations/**` |

### 5.2. Nexus (Backup)

| Mục | Chi tiết |
|---|---|
| **Áp dụng Nexus** | ✅ Có thể áp dụng quy trình backup file nén `.tar.gz` lên Nexus |
| **Nội dung backup** | `src/`, `prisma/`, `package.json`, `package-lock.json` (không bao gồm `node_modules`) |

### 5.3. Domain

| Mục | Chi tiết |
|---|---|
| **Domain đề xuất** | `api.blog.thienduong.info` (hoặc `api.thienduong.info`) |
| **Tham chiếu** | Client đang trỏ `NEXT_PUBLIC_API_URL` tới `https://api.blog.thienduong.info` |

### 5.4. Jenkinsfile - Những thứ CẦN SỬA ⚠️

Hiện tại `server-nodejs/Jenkinsfile` **chưa được cập nhật đúng** - nó vẫn đang là bản copy từ Client. Cần sửa các mục sau:

| Dòng | Hiện tại (SAI ❌) | Cần sửa thành (ĐÚNG ✅) |
|---|---|---|
| L14 | `IMAGE_NAME = 'devops-blog-client'` | `IMAGE_NAME = 'devops-blog-server'` |
| L19 | `K8S_MANIFEST_REPO = '...Blog_K8S.git'` | `K8S_MANIFEST_REPO = '...Blog_K8S_Server.git'` *(hoặc dùng chung repo, khác folder)* |
| L51-53 | `withCredentials` cho `NEXT_PUBLIC_*` | Cần thay bằng credentials cho `DATABASE_URL`, `JWT_*`, `CORS_ORIGIN` |
| L55-60 | Tạo `.env.production` cho Next.js | Cần tạo `.env` cho Express server |
| L73-74 | `sonar.projectKey=devops-blog-client` | `sonar.projectKey=devops-blog-server` |
| L74 | `sonar.projectName='DevOps Blog Client'` | `sonar.projectName='DevOps Blog Server'` |
| L77 | `sonar.exclusions=...,.next/**,...` | `sonar.exclusions=node_modules/**,coverage/**,prisma/migrations/**` |

### 5.5. Pipeline Flow đề xuất cho Server

```
┌──────────────┐   ┌──────────────────┐   ┌─────────────────────┐
│ Clean        │──▶│ Checkout Source   │──▶│ Install             │
│ Workspace    │   │ Code             │   │ Dependencies        │
└──────────────┘   └──────────────────┘   └─────────────────────┘
                                                     │
                                                     ▼
┌──────────────┐   ┌──────────────────┐   ┌─────────────────────┐
│ Quality      │◀──│ SonarQube        │◀──│ Inject Env Secrets  │
│ Gate         │   │ Analysis         │   │ (cho Prisma nếu cần)│
└──────────────┘   └──────────────────┘   └─────────────────────┘
       │
       ▼
┌──────────────┐   ┌──────────────────┐
│ Docker Build │──▶│ Update K8s       │
│ & Push       │   │ Manifest         │
└──────────────┘   └──────────────────┘
```

---

## 📌 TỔNG KẾT - CHECKLIST TRƯỚC KHI DEPLOY

- [ ] **Sửa Jenkinsfile**: Cập nhật `IMAGE_NAME`, `sonar.projectKey`, credentials, K8S_MANIFEST_REPO
- [ ] **Tạo Jenkins Credentials**: `SERVER_DATABASE_URL`, `SERVER_JWT_ACCESS_SECRET`, `SERVER_JWT_REFRESH_SECRET`, `SERVER_CORS_ORIGIN`
- [ ] **Tạo SonarQube Project**: `devops-blog-server` trên SonarQube server
- [ ] **Tạo K8s Manifest Repo**: Repo chứa `deployment.yaml` cho server (hoặc thêm file trong repo hiện tại)
- [ ] **K8s Secret/ConfigMap**: Tạo secret chứa `DATABASE_URL`, `JWT_*` cho Pod
- [ ] **Migration**: Chạy `npx prisma migrate deploy` trước lần deploy đầu tiên
- [ ] **Domain/Ingress**: Cấu hình `api.blog.thienduong.info` trỏ vào service K8s port `3001`
- [ ] **Test connectivity**: Đảm bảo Pod trong K8s có thể kết nối tới MySQL server (`45.252.248.106:3306`)
