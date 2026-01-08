# DevOps Blog API - Node.js/Express

Backend API cho DevOps Blog Platform được xây dựng bằng Node.js, Express và Prisma ORM.

## 🚀 Tech Stack

- **Node.js** - Runtime environment
- **Express.js** - Web framework
- **Prisma** - ORM cho database
- **MySQL** - Database
- **JWT** - Authentication  
- **Argon2** - Password hashing
- **Joi** - Validation
- **Swagger** - API documentation

## 📋 Prerequisites

- Node.js >= 16.x
- MySQL >= 8.0
- npm hoặc yarn

## 🛠️ Installation

1. Clone repository:
```bash
git clone <repository-url>
cd server-nodejs
```

2. Install dependencies:
```bash
npm install
```

3. Tạo file `.env`:
```bash
cp .env.example .env
```

4. Cập nhật các biến môi trường trong `.env`:
```env
DATABASE_URL="mysql://user:password@localhost:3306/devopsblog"
JWT_ACCESS_SECRET=your-secret-key
JWT_REFRESH_SECRET=your-refresh-secret
```

5. Generate Prisma Client:
```bash
npm run prisma:generate
```

6. Run database migrations:
```bash
npm run prisma:migrate
```

7. Seed database (optional):
```bash
npm run prisma:seed
```

## 🏃‍♂️ Running the Application

### Development
```bash
npm run dev
```

### Production
```bash
npm start
```

Server sẽ chạy tại: `http://localhost:3001`

## 📁 Project Structure

```
server-nodejs/
├── prisma/
│   ├── schema.prisma      # Prisma schema
│   └── seed.js            # Database seeding
├── src/
│   ├── config/            # Configuration
│   ├── middlewares/       # Express middlewares
│   ├── modules/           # Feature modules
│   │   ├── auth/          # Authentication
│   │   ├── posts/         # Blog posts
│   │   ├── categories/    # Categories
│   │   ├── tags/          # Tags
│   │   ├── comments/      # Comments
│   │   └── users/         # Users
│   ├── utils/             # Utilities
│   ├── app.js             # Express app
│   └── server.js          # Entry point
├── .env.example           # Environment variables example
├── package.json
└── README.md
```

## 🔑 API Endpoints

### Authentication
- `POST /api/auth/register` - Đăng ký user mới
- `POST /api/auth/login` - Đăng nhập
- `POST /api/auth/logout` - Đăng xuất
- `POST /api/auth/refresh` - Refresh access token
- `GET /api/auth/profile` - Lấy thông tin user hiện tại

### Posts
- `GET /api/posts/published` - Lấy danh sách bài viết đã publish (public)
- `GET /api/posts/slug/:slug` - Lấy bài viết theo slug (public)
- `GET /api/posts/:id/related` - Lấy bài viết liên quan (public)
- `GET /api/posts` - Lấy tất cả bài viết (admin)
- `GET /api/posts/stats` - Lấy thống kê bài viết (admin)
- `GET /api/posts/:id` - Lấy bài viết theo ID (admin)
- `POST /api/posts` - Tạo bài viết mới (admin)
- `PUT /api/posts/:id` - Cập nhật bài viết (admin)
- `DELETE /api/posts/:id` - Xóa bài viết (admin)

## 🔒 Authentication

API sử dụng JWT Bearer tokens cho authentication:
- **Access Token**: Short-lived (15 phút), gửi trong Authorization header
- **Refresh Token**: Long-lived (7 ngày), lưu trong HTTP-only cookie

### Sử dụng:
```javascript
// Gửi request với access token
fetch('/api/posts', {
  headers: {
    'Authorization': 'Bearer <access-token>'
  }
})
```

## 🔐 Roles & Permissions

- **ADMIN**: Full access
- **MODERATOR**: Quản lý content
- **EDITOR**: Tạo và edit posts
- **VIEWER**: Chỉ xem

## 🗃️ Database

Sử dụng Prisma ORM với MySQL. Prisma Client được auto-generated từ schema.

### Các lệnh Prisma:
```bash
npm run prisma:generate    # Generate Prisma Client
npm run prisma:migrate     # Run migrations (dev)
npm run prisma:migrate:prod # Run migrations (production)
npm run prisma:studio      # Open Prisma Studio
npm run prisma:seed        # Seed database
npm run prisma:reset       # Reset database
```

## 🔧 Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `NODE_ENV` | Environment mode | development |
| `PORT` | Server port | 3001 |
| `DATABASE_URL` | MySQL connection string | - |
| `JWT_ACCESS_SECRET` | JWT access token secret | - |
| `JWT_REFRESH_SECRET` | JWT refresh token secret | - |
| `JWT_ACCESS_EXPIRES_IN` | Access token expiry | 15m |
| `JWT_REFRESH_EXPIRES_IN` | Refresh token expiry | 7d |
| `CORS_ORIGIN` | CORS allowed origin | http://localhost:3000 |

## 📝 License

MIT
