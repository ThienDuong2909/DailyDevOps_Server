# 🚀 Quick Start Guide

## Chạy Server Trong 5 Phút

### Bước 1: Cài Dependencies
```bash
cd server-nodejs
npm install
```

### Bước 2: Tạo File .env
```bash
# Copy từ file example
cp .env.example .env

# Hoặc tạo mới với nội dung:
NODE_ENV=development
PORT=3001
API_PREFIX=api

# Thay đổi database connection string
DATABASE_URL="mysql://root:password@localhost:3306/devopsblog"

# Tạo JWT secrets (random strings)
JWT_ACCESS_SECRET=your-super-secret-access-key-change-this
JWT_REFRESH_SECRET=your-super-secret-refresh-key-change-this
JWT_ACCESS_EXPIRES_IN=15m
JWT_REFRESH_EXPIRES_IN=7d

CORS_ORIGIN=http://localhost:3000
```

### Bước 3: Setup Database
```bash
# Tạo database (nếu chưa có)
# Chạy trong MySQL:
# CREATE DATABASE devopsblog;

# Generate Prisma Client
npm run prisma:generate

# Run migrations
npm run prisma:migrate

# Seed initial data (admin user, categories, tags)
npm run prisma:seed
```

### Bước 4: Start Server
```bash
# Development mode (with auto-reload)
npm run dev

# Production mode
npm start
```

Server sẽ chạy tại: **http://localhost:3001**

---

## 📝 Test API

### 1. Đăng Ký User Mới
```bash
curl -X POST http://localhost:3001/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "Test@123",
    "firstName": "Test",
    "lastName": "User"
  }'
```

### 2. Đăng Nhập
```bash
curl -X POST http://localhost:3001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin@devopsblog.com",
    "password": "Admin@123"
  }'
```

Response:
```json
{
  "success": true,
  "data": {
    "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "accessTokenExpires": 1234567890
  }
}
```

### 3. Lấy Profile (cần token)
```bash
curl -X GET http://localhost:3001/api/auth/profile \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN"
```

### 4. Lấy Danh Sách Posts Public
```bash
curl -X GET "http://localhost:3001/api/posts/published?page=1&limit=10"
```

### 5. Tạo Post Mới (Admin)
```bash
curl -X POST http://localhost:3001/api/posts \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN" \
  -d '{
    "title": "My First Post",
    "content": "This is the content of my first post...",
    "excerpt": "A brief summary",
    "status": "PUBLISHED",
    "categoryId": "CATEGORY_ID_HERE"
  }'
```

---

## 🔑 Default Credentials

Sau khi chạy seed, bạn có tài khoản admin mặc định:

```
Email: admin@devopsblog.com
Password: Admin@123
```

**⚠️ QUAN TRỌNG: Đổi password ngay sau khi đăng nhập lần đầu!**

---

## 📊 Database Management

### Prisma Studio (GUI)
```bash
npm run prisma:studio
```
Mở trình duyệt: **http://localhost:5555**

### Reset Database (⚠️ Xóa tất cả data)
```bash
npm run prisma:reset
```

### Tạo Migration Mới
```bash
npm run prisma:migrate
```

---

## 🛠️ Development Tools

### Auto-reload
Server tự động restart khi code thay đổi (dùng nodemon):
```bash
npm run dev
```

### View Logs
Logs được hiển thị ngay trên console với format:
- **Development**: Chi tiết với morgan 'dev'
- **Production**: Format 'combined'

---

## 📁 Project Structure

```
server-nodejs/
├── src/
│   ├── modules/          # Feature modules
│   │   ├── auth/         # Authentication
│   │   ├── posts/        # Posts management
│   │   ├── categories/   # Categories
│   │   ├── tags/         # Tags
│   │   ├── comments/     # Comments
│   │   └── users/        # Users management
│   ├── middlewares/      # Express middlewares
│   │   ├── auth.middleware.js       # JWT authentication
│   │   ├── error.middleware.js      # Error handling
│   │   └── validation.middleware.js # Request validation
│   ├── config/           # Configuration
│   ├── utils/            # Utilities (Prisma client, etc.)
│   ├── app.js            # Express app setup
│   └── server.js         # Entry point
├── prisma/
│   ├── schema.prisma     # Database schema
│   └── seed.js           # Seed script
├── .env                  # Environment variables
└── package.json
```

---

## 🔍 Troubleshooting

### Port đã được sử dụng
```bash
# Đổi port trong .env
PORT=3002
```

### Database connection error
```bash
# Kiểm tra MySQL đang chạy
# Kiểm tra DATABASE_URL trong .env
# Đảm bảo database đã được tạo
```

### JWT errors
```bash
# Đảm bảo JWT_ACCESS_SECRET và JWT_REFRESH_SECRET đã được set trong .env
# Đảm bảo không có khoảng trắng thừa
```

### Prisma errors
```bash
# Regenerate Prisma Client
npm run prisma:generate

# Reset database
npm run prisma:reset
```

---

## 📚 Next Steps

1. ✅ Test tất cả các API endpoints
2. ✅ Tùy chỉnh CORS settings cho frontend
3. ✅ Setup rate limiting theo nhu cầu
4. ✅ Cấu hình logging
5. ✅ Deploy lên production
6. ⚠️ Implement Swagger documentation (optional)
7. ⚠️ Setup monitoring & error tracking

---

## 🤝 Support

Nếu gặp vấn đề:
1. Kiểm tra logs trong console
2. Đọc MIGRATION_GUIDE.md để hiểu rõ hơn về architecture
3. Kiểm tra README.md cho documentation đầy đủ

Happy coding! 🎉
