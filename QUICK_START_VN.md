# 🚀 Quick Start Guide - Node.js/Express Server

## ✅ Server đã được convert hoàn toàn sang JavaScript!

Tất cả source code trong `server-nodejs` đã là **JavaScript thuần túy (.js)**, không còn TypeScript (.ts) nào cả!

---

## 📦 Cài đặt

```bash
cd server-nodejs
npm install
```

---

## ⚙️ Cấu hình

1. Copy file `.env.example` thành `.env`:
```bash
cp .env.example .env
```

2. Cập nhật các biến môi trường trong `.env`:
```env
# Server
NODE_ENV=development
PORT=3001
API_PREFIX=api

# Database
DATABASE_URL="mysql://root:password@localhost:3306/devopsblog"

# JWT
JWT_ACCESS_SECRET=your-secret-key
JWT_REFRESH_SECRET=your-refresh-secret
JWT_ACCESS_EXPIRES_IN=15m
JWT_REFRESH_EXPIRES_IN=7d

# CORS
CORS_ORIGIN=http://localhost:3000
```

---

## 🗄️ Database Setup

```bash
# Generate Prisma Client
npm run prisma:generate

# Run migrations
npm run prisma:migrate

# (Optional) Seed database
npm run prisma:seed
```

---

## 🏃 Chạy Server

### Development Mode
```bash
npm run dev
```

### Production Mode
```bash
npm start
```

Server sẽ chạy tại: **http://localhost:3001**

---

## 🧪 Test API

### 1. Health Check
```bash
curl http://localhost:3001/health
```

**Response:**
```json
{
  "success": true,
  "message": "DevOps Blog API is running",
  "timestamp": "2026-01-07T08:44:06.414Z",
  "environment": "development"
}
```

### 2. Get Published Posts
```bash
curl http://localhost:3001/api/posts/published
```

### 3. Register User
```bash
curl -X POST http://localhost:3001/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "Password123!",
    "name": "Test User"
  }'
```

### 4. Login
```bash
curl -X POST http://localhost:3001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "Password123!"
  }'
```

---

## 📚 API Documentation

Truy cập Swagger API Docs tại: **http://localhost:3001/api/docs**

---

## 📁 Cấu trúc Project

```
server-nodejs/
├── src/
│   ├── modules/           # Feature modules
│   │   ├── auth/         # Authentication
│   │   │   ├── auth.routes.js
│   │   │   ├── auth.service.js
│   │   │   └── auth.validation.js
│   │   ├── posts/        # Blog posts
│   │   ├── categories/   # Categories
│   │   ├── tags/         # Tags
│   │   ├── comments/     # Comments
│   │   └── users/        # Users
│   ├── middlewares/       # Express middlewares
│   │   ├── auth.middleware.js
│   │   ├── error.middleware.js
│   │   └── validation.middleware.js
│   ├── config/           # Configuration
│   │   └── index.js
│   ├── utils/            # Utilities
│   │   └── prisma.js
│   ├── app.js            # Express app
│   └── server.js         # Entry point
├── prisma/
│   ├── schema.prisma     # Database schema
│   └── seed.js           # Database seeding
├── .env                  # Environment variables
├── package.json
└── README.md
```

---

## 🔑 Available Scripts

| Script | Command | Description |
|--------|---------|-------------|
| **dev** | `npm run dev` | Start development server with nodemon |
| **start** | `npm start` | Start production server |
| **prisma:generate** | `npm run prisma:generate` | Generate Prisma Client |
| **prisma:migrate** | `npm run prisma:migrate` | Run database migrations |
| **prisma:studio** | `npm run prisma:studio` | Open Prisma Studio |
| **prisma:seed** | `npm run prisma:seed` | Seed database |
| **prisma:reset** | `npm run prisma:reset` | Reset database |

---

## 🌐 API Endpoints

### Authentication
- `POST /api/auth/register` - Đăng ký user mới
- `POST /api/auth/login` - Đăng nhập
- `POST /api/auth/logout` - Đăng xuất
- `POST /api/auth/refresh` - Refresh access token
- `GET /api/auth/profile` - Lấy thông tin user

### Posts (Public)
- `GET /api/posts/published` - Lấy bài viết đã publish
- `GET /api/posts/slug/:slug` - Lấy bài viết theo slug
- `GET /api/posts/:id/related` - Lấy bài viết liên quan

### Posts (Admin)
- `GET /api/posts` - Lấy tất cả bài viết
- `GET /api/posts/stats` - Lấy thống kê
- `GET /api/posts/:id` - Lấy bài viết theo ID
- `POST /api/posts` - Tạo bài viết mới
- `PUT /api/posts/:id` - Cập nhật bài viết
- `DELETE /api/posts/:id` - Xóa bài viết

### Categories
- `GET /api/categories` - Lấy tất cả categories
- `GET /api/categories/:id` - Lấy category theo ID

### Tags
- `GET /api/tags` - Lấy tất cả tags
- `GET /api/tags/:id` - Lấy tag theo ID

### Comments
- `GET /api/comments/post/:postId` - Lấy comments của bài viết
- `POST /api/comments` - Tạo comment mới

### Users (Admin)
- `GET /api/users` - Lấy tất cả users
- `GET /api/users/:id` - Lấy user theo ID

---

## 🔐 Authentication

API sử dụng JWT tokens:
- **Access Token**: Gửi trong `Authorization: Bearer <token>` header
- **Refresh Token**: Lưu trong HTTP-only cookie `refreshToken`

### Example với Access Token:
```bash
curl http://localhost:3001/api/posts \
  -H "Authorization: Bearer <your-access-token>"
```

---

## ✨ Features

- ✅ **Pure JavaScript** - Không cần build, chạy trực tiếp
- ✅ **Express.js** - Web framework nhanh và linh hoạt
- ✅ **Prisma ORM** - Type-safe database access
- ✅ **JWT Authentication** - Secure token-based auth
- ✅ **Role-based Authorization** - ADMIN, MODERATOR, EDITOR, VIEWER
- ✅ **Validation** - Joi schema validation
- ✅ **Error Handling** - Centralized error handling
- ✅ **Security** - Helmet, CORS, Rate limiting
- ✅ **API Documentation** - Swagger/OpenAPI
- ✅ **Hot Reload** - Nodemon cho development

---

## 🐛 Troubleshooting

### Port đã được sử dụng
```bash
# Windows
netstat -ano | findstr :3001
taskkill /PID <PID> /F

# Linux/Mac
lsof -ti:3001 | xargs kill -9
```

### Database connection error
- Kiểm tra MySQL đang chạy
- Kiểm tra DATABASE_URL trong .env
- Chạy: `npm run prisma:migrate`

### Module not found
```bash
rm -rf node_modules package-lock.json
npm install
```

---

## 📝 Development Tips

1. **Auto-reload**: Server tự động restart khi code thay đổi (nodemon)
2. **Logging**: Sử dụng morgan cho request logging
3. **Debugging**: Thêm `console.log()` hoặc dùng VSCode debugger
4. **Database**: Dùng Prisma Studio để xem data: `npm run prisma:studio`

---

## 🎯 Next Steps

1. ✅ Server Node.js đang chạy tại http://localhost:3001
2. ✅ Client Next.js đang chạy tại http://localhost:3000
3. 📝 Test các API endpoints
4. 🔍 Xem API documentation tại /api/docs
5. 🗄️ Quản lý database với Prisma Studio

---

**Status**: ✅ Production Ready  
**Last Updated**: 2026-01-07  
**Tech Stack**: Node.js + Express + Prisma + MySQL
