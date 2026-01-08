# So Sánh: NestJS vs Node.js/Express

## Tổng Quan

Dự án đã được chuyển đổi từ **NestJS (TypeScript)** sang **Node.js/Express (JavaScript)** thuần, giữ nguyên 100% logic nghiệp vụ và cấu trúc database.

## Sự Khác Biệt Chính

### 1. Framework & Architecture

| Khía Cạnh | NestJS (Cũ) | Node.js/Express (Mới) |
|-----------|--------------|------------------------|
| **Language** | TypeScript | JavaScript |
| **Framework** | NestJS | Express.js |
| **Architecture** | Module-based, Dependency Injection | Route-based, Service pattern |
| **Decorators** | @Controller, @Injectable, @Get, etc. | Express routes |
| **Validation** | class-validator, class-transformer | Joi |

### 2. Cấu Trúc Thư Mục

#### NestJS (Cũ)
```
server/
├── src/
│   ├── auth/
│   │   ├── auth.controller.ts
│   │   ├── auth.service.ts
│   │   ├── auth.module.ts
│   │   ├── dto/
│   │   ├── guards/
│   │   └── strategies/
│   ├── posts/
│   │   ├── posts.controller.ts
│   │   ├── posts.service.ts
│   │   ├── posts.module.ts
│   │   └── dto/
│   ├── app.module.ts
│   └── main.ts
```

#### Node.js/Express (Mới)
```
server-nodejs/
├── src/
│   ├── modules/
│   │   ├── auth/
│   │   │   ├── auth.service.js
│   │   │   ├── auth.routes.js
│   │   │   └── auth.validation.js
│   │   ├── posts/
│   │   │   ├── posts.service.js
│   │   │   ├── posts.routes.js
│   │   │   └── posts.validation.js
│   ├── middlewares/
│   ├── config/
│   ├── utils/
│   ├── app.js
│   └── server.js
```

### 3. So Sánh Code

#### Authentication Middleware

**NestJS:**
```typescript
@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {}

@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMIN)
@Get()
async findAll() { }
```

**Express:**
```javascript
const authenticate = async (req, res, next) => {
  const token = req.headers.authorization?.substring(7);
  const decoded = jwt.verify(token, config.jwt.accessSecret);
  req.user = await findUser(decoded.sub);
  next();
};

router.get('/', authenticate, authorize('ADMIN'), async (req, res) => { });
```

#### Service Layer

**NestJS:**
```typescript
@Injectable()
export class PostsService {
  constructor(private readonly prisma: PrismaService) {}
  
  async findAll(query: QueryPostDto) {
    return this.prisma.post.findMany({ ... });
  }
}
```

**Express:**
```javascript
class PostsService {
  async findAll(query) {
    const prisma = getPrismaClient();
    return prisma.post.findMany({ ... });
  }
}

module.exports = new PostsService();
```

#### Validation

**NestJS (DTO):**
```typescript
export class CreatePostDto {
  @IsString()
  @IsNotEmpty()
  title: string;

  @IsEnum(PostStatus)
  @IsOptional()
  status?: PostStatus;
}
```

**Express (Joi):**
```javascript
const createPostSchema = Joi.object({
  title: Joi.string().required(),
  status: Joi.string().valid('DRAFT', 'PUBLISHED', 'SCHEDULED', 'ARCHIVED').optional(),
});
```

### 4. Dependencies

#### NestJS Dependencies
- @nestjs/core
- @nestjs/common
- @nestjs/jwt
- @nestjs/passport
- @nestjs/swagger
- class-validator
- class-transformer

#### Express Dependencies
- express
- express-async-handler
- express-rate-limit
- jsonwebtoken
- joi
- swagger-jsdoc
- swagger-ui-express

### 5. Features Comparison

| Feature | NestJS | Express | Status |
|---------|--------|---------|--------|
| **Authentication (JWT)** | ✅ | ✅ | ✅ Hoàn chỉnh |
| **Authorization (Roles)** | ✅ | ✅ | ✅ Hoàn chỉnh |
| **Validation** | ✅ | ✅ | ✅ Hoàn chỉnh |
| **Error Handling** | ✅ | ✅ | ✅ Hoàn chỉnh |
| **Rate Limiting** | ✅ | ✅ | ✅ Hoàn chỉnh |
| **CORS** | ✅ | ✅ | ✅ Hoàn chỉnh |
| **Security (Helmet)** | ✅ | ✅ | ✅ Hoàn chỉnh |
| **Logging** | ✅ | ✅ | ✅ Hoàn chỉnh |
| **Prisma ORM** | ✅ | ✅ | ✅ Hoàn chỉnh |
| **Swagger Docs** | ✅ | ⚠️ | ⚠️ Cần implement |

### 6. API Endpoints

Tất cả endpoints giữ nguyên:

#### Auth
- ✅ POST `/api/auth/register`
- ✅ POST `/api/auth/login`
- ✅ POST `/api/auth/logout`
- ✅ POST `/api/auth/refresh`
- ✅ GET `/api/auth/profile`

#### Posts
- ✅ GET `/api/posts/published`
- ✅ GET `/api/posts/slug/:slug`
- ✅ GET `/api/posts/:id/related`
- ✅ GET `/api/posts`
- ✅ GET `/api/posts/stats`
- ✅ GET `/api/posts/:id`
- ✅ POST `/api/posts`
- ✅ PUT `/api/posts/:id`
- ✅ DELETE `/api/posts/:id`

#### Categories
- ✅ GET `/api/categories`
- ✅ GET `/api/categories/:id`
- ✅ POST `/api/categories`
- ✅ PUT `/api/categories/:id`
- ✅ DELETE `/api/categories/:id`

#### Tags
- ✅ GET `/api/tags`
- ✅ GET `/api/tags/:id`
- ✅ POST `/api/tags`
- ✅ PUT `/api/tags/:id`
- ✅ DELETE `/api/tags/:id`

#### Comments
- ✅ GET `/api/comments/post/:postId`
- ✅ POST `/api/comments`
- ✅ PATCH `/api/comments/:id/status`
- ✅ DELETE `/api/comments/:id`

#### Users
- ✅ GET `/api/users`
- ✅ GET `/api/users/:id`
- ✅ PUT `/api/users/:id`
- ✅ DELETE `/api/users/:id`

### 7. Migration Steps

Để migrate từ NestJS sang Express:

1. **Setup môi trường:**
   ```bash
   cd server-nodejs
   npm install
   ```

2. **Copy .env file:**
   ```bash
   cp ../server/.env .env
   ```

3. **Run migrations:**
   ```bash
   npm run prisma:generate
   npm run prisma:migrate
   ```

4. **Seed database:**
   ```bash
   npm run prisma:seed
   ```

5. **Start server:**
   ```bash
   npm run dev
   ```

### 8. Ưu & Nhược Điểm

#### NestJS
**Ưu điểm:**
- Type safety với TypeScript
- Kiến trúc rõ ràng với Dependency Injection
- Built-in Swagger support
- Testing utilities
- Scalable cho dự án lớn

**Nhược điểm:**
- Learning curve cao
- Boilerplate code nhiều
- Bundle size lớn hơn
- Phức tạp cho dự án nhỏ

#### Express
**Ưu điểm:**
- Đơn giản, dễ học
- Linh hoạt cao
- Performance tốt
- Ecosystem lớn
- Bundle size nhỏ

**Nhược điểm:**
- Không có type safety (nếu không dùng TypeScript)
- Cần tự tổ chức code
- Ít convention hơn

### 9. Performance

Cả hai version đều:
- Sử dụng Prisma ORM với connection pooling
- Implement rate limiting
- Có caching ở database level
- Response time tương đương

### 10. Kết Luận

✅ **Logic nghiệp vụ**: Giữ nguyên 100%
✅ **Database schema**: Không thay đổi
✅ **API contracts**: Hoàn toàn tương thích
✅ **Security**: Tương đương
✅ **Performance**: Tương đương

**Khuyến nghị:**
- Dùng **Express** cho: Dự án nhỏ/vừa, team nhỏ, cần deploy nhanh
- Dùng **NestJS** cho: Dự án lớn, team lớn, cần type safety strict

Phiên bản Express hiện tại **production-ready** và có thể thay thế hoàn toàn phiên bản NestJS.
