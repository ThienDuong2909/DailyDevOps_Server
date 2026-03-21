# API Documentation - DevOps Blog Server

Tài liệu này tổng hợp toàn bộ các API endpoints hiện có của hệ thống Backend (NodeJS/Express), giúp bạn dễ dàng import vào Postman để kiểm thử.

## 🌍 Base URLs
- **Local Environment:** `http://localhost:3001`
- **Production Environment:** `https://api.blog.thienduong.info`

*(Lưu ý: Tiền tố chung cho tất cả các API route là `/api/v1`)*

---

## 🛡️ 1. Authentication (`/api/v1/auth`)

| Method | Endpoint | Description | Access |
|---|---|---|---|
| `POST` | `/api/v1/auth/register` | Đăng ký tài khoản mới | Public |
| `POST` | `/api/v1/auth/login` | Đăng nhập và nhận Tokens | Public |
| `POST` | `/api/v1/auth/refresh` | Lấy Access Token mới (dùng HTTP-only cookie) | Public |
| `POST` | `/api/v1/auth/logout` | Đăng xuất (xóa Cookie) | Private |
| `GET`  | `/api/v1/auth/profile` | Lấy thông tin user (profile) hiện tại | Private |

---

## ✍️ 2. Posts (`/api/v1/posts`)

| Method | Endpoint | Description | Access |
|---|---|---|---|
| `GET` | `/api/v1/posts/published` | Lấy danh sách bài viết đã phê duyệt | Public |
| `GET` | `/api/v1/posts/slug/:slug` | Lấy bài viết chi tiết qua URL slug | Public |
| `GET` | `/api/v1/posts/:id/related` | Lấy các bài viết gợi ý/liên quan | Public |
| `GET` | `/api/v1/posts` | Lấy toàn bộ bài viết (Quản lý) | Admin, Editor |
| `GET` | `/api/v1/posts/stats` | Thống kê số lượng bài viết | Admin, Moderator |
| `GET` | `/api/v1/posts/:id` | Lấy chi tiết bài viết (qua ID) | Admin, Editor |
| `POST` | `/api/v1/posts` | Tạo bài viết mới | Admin, Editor |
| `PUT` | `/api/v1/posts/:id` | Cập nhật nội dung bài viết | Admin, Editor |
| `DELETE` | `/api/v1/posts/:id` | Xóa bài viết | Admin, Editor |

---

## 📂 3. Categories (`/api/v1/categories`)

| Method | Endpoint | Description | Access |
|---|---|---|---|
| `GET` | `/api/v1/categories` | Lấy danh sách danh mục (Categories) | Public |
| `GET` | `/api/v1/categories/:id` | Lấy chi tiết một danh mục | Public |
| `POST` | `/api/v1/categories` | Tạo danh mục mới | Admin |
| `PUT` | `/api/v1/categories/:id` | Chỉnh sửa danh mục | Admin |
| `DELETE` | `/api/v1/categories/:id` | Xóa danh mục | Admin |

---

## 🏷️ 4. Tags (`/api/v1/tags`)

| Method | Endpoint | Description | Access |
|---|---|---|---|
| `GET` | `/api/v1/tags` | Lấy danh sách thẻ (Tags) | Public |
| `GET` | `/api/v1/tags/:id` | Lấy chi tiết một Tag | Public |
| `POST` | `/api/v1/tags` | Tạo Tag mới | Admin |
| `PUT` | `/api/v1/tags/:id` | Chỉnh sửa Tag | Admin |
| `DELETE` | `/api/v1/tags/:id` | Xóa Tag | Admin |

---

## 💬 5. Comments (`/api/v1/comments`)

| Method | Endpoint | Description | Access |
|---|---|---|---|
| `GET` | `/api/v1/comments/post/:postId` | Lấy danh sách bình luận của bài viết | Public |
| `POST` | `/api/v1/comments` | Đăng bình luận mới vào bài viết | Public |
| `PATCH` | `/api/v1/comments/:id/status`| Đổi trạng thái bình luận (Chờ/Duyệt/Ẩn) | Admin |
| `DELETE` | `/api/v1/comments/:id` | Xóa bình luận | Admin |

---

## 👥 6. Users (`/api/v1/users`)

| Method | Endpoint | Description | Access |
|---|---|---|---|
| `GET` | `/api/v1/users` | Lấy danh sách User trong hệ thống | Admin |
| `GET` | `/api/v1/users/:id` | Lấy chi tiết một User | Admin |
| `PUT` | `/api/v1/users/:id` | Phân quyền/Khóa User (Sửa Role, Trạng thái) | Admin |
| `DELETE` | `/api/v1/users/:id` | Xóa/Cấm User | Admin |

---

## 📧 7. Subscribers (`/api/v1/subscribers`)

| Method | Endpoint | Description | Access |
|---|---|---|---|
| `POST` | `/api/v1/subscribers` | Người dùng đăng ký theo dõi (Nhận Email) | Public |
| `POST` | `/api/v1/subscribers/unsubscribe` | Hủy theo dõi Email (Cần truyền Token) | Public |
| `GET` | `/api/v1/subscribers` | Lấy danh sách Emails đang theo dõi | Admin |
| `GET` | `/api/v1/subscribers/stats` | Thống kê số lượng người đăng ký | Admin |
| `DELETE` | `/api/v1/subscribers/:id` | Trục xuất 1 subscriber khỏi danh sách | Admin |

---

## ⚠️ Thông tin quan trọng khi Test trên Postman / Client

1. **Quyền truy cập (Authentication)** 
   - Token làm mới (Refresh Token) được trả về trong Header `Set-Cookie` tự động dưới dạng **HTTP-Only**. Khi test Local hay Postman, hãy bật cookie.
   - Access Token được Server phản hồi trong Body Json lúc gọi API `/login`. Để thực thi các API `Private/Admin`, gắn nó vào Request Header như sau:
     `Authorization: Bearer <your_access_token>_here`

2. **Dữ liệu truyền lên (Payload)** 
   - Tất cả dữ liệu gửi POST/PUT đều dùng định dạng chuẩn **JSON**.
   - Header mẫu: `Content-Type: application/json`.

3. **Bảo mật giới hạn Rate Limit**
   - API được giới hạn **100 requests / 1 phút**. Nếu bạn test spam (VD: Load test) bị báo lỗi thì hãy xem lại thiết lập `RATE_LIMIT_MAX_REQUESTS` ở `.env`.

4. **Kiểm tra sức khỏe Backend (Health Check)**
   - API kiểm tra Service có đang chạy không: `GET /health` (Sẽ trả về ram, trạng thái, thời gian chạy). Không nằm trong `/api/v1`.
