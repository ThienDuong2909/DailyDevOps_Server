# 📋 Jenkinsfile Review — Server Node.js

> **Ngày review:** 2026-02-23  
> **File:** `server-nodejs/Jenkinsfile`  
> **Đánh giá tổng thể:** 6.5/10  
> **Pipeline hoạt động được**, nhưng có rủi ro bảo mật và performance cần khắc phục.

---

---

## ✅ Những điểm đã làm tốt

| #   | Điểm tốt                    | Chi tiết                                                                                   |
| --- | --------------------------- | ------------------------------------------------------------------------------------------ |
| 1   | **Pipeline options đầy đủ** | `timeout`, `buildDiscarder`, `disableConcurrentBuilds`, `timestamps` — chuẩn best practice |
| 2   | **Sử dụng `npm ci`**        | Phù hợp cho CI/CD, nhanh hơn `npm install` 2-3x, deterministic                             |
| 3   | **npm cache persist**       | `cleanWs` exclude `.npm-cache/**` — tăng tốc build lần sau                                 |
| 4   | **Quality Gate**            | Có `waitForQualityGate()` với timeout riêng 5 phút — đảm bảo code quality                  |
| 5   | **Post-build cleanup**      | Dọn Docker images, logout, xóa `k8s-repo` — tránh leak tài nguyên                          |
| 6   | **GitOps pattern**          | Cập nhật K8s manifest qua Git, không apply trực tiếp vào cluster — đúng chuẩn              |

---

## 🔴 Vấn đề nghiêm trọng (Critical)

### 1. Thiếu `.dockerignore` — Docker build context quá lớn

**📍 Vị trí:** Line 107

```groovy
sh "docker build -t ${IMAGE_TAG}:${BUILD_NUMBER} -t ${IMAGE_TAG}:latest -f Dockerfile ."
```

**❌ Vấn đề:**

Khi chạy `docker build .`, Docker sẽ **gửi toàn bộ workspace** (bao gồm `node_modules`, `.npm-cache`, `.git`, v.v.) vào Docker daemon làm build context. Vì không có file `.dockerignore`, tất cả đều bị gửi đi.

Hậu quả:

- `node_modules` có thể nặng **hàng trăm MB → vài GB**
- Build **cực chậm** do phải transfer data
- Tốn **RAM/disk** trên Jenkins agent
- Có thể gây **OOM crash** (Jenkins server bị restart)

**✅ Cách khắc phục:**

Tạo file `.dockerignore` tại thư mục gốc `server-nodejs/`:

```dockerignore
# Dependencies - sẽ được install lại trong Docker
node_modules

# npm cache từ Jenkins
.npm-cache

# Git history không cần thiết trong image
.git
.gitignore

# Documentation
*.md

# Test & Coverage
coverage
__tests__
*.test.js
*.spec.js

# IDE & Editor
.vscode
.idea
*.swp

# CI/CD files
Jenkinsfile
.dockerignore
Dockerfile

# Env files (KHÔNG được bake vào image)
.env
.env.*
```

**💡 Giải thích:**

- Docker sẽ chỉ gửi những file **cần thiết** vào build context
- Giảm transfer size từ vài GB → vài MB
- Build nhanh hơn đáng kể

---

### 2. Leak credentials trong Git URL

**📍 Vị trí:** Line 122

```groovy
sh "git clone https://${GIT_USER}:${GIT_TOKEN}@${K8S_MANIFEST_REPO} k8s-repo"
```

**❌ Vấn đề:**

Token được **nội suy (interpolate) bởi Groovy** trước khi chạy shell command, nghĩa là:

- Token **hiển thị dạng plain text** trong **Console Output** của Jenkins
- Bất kỳ ai có quyền xem build log đều thấy token
- Token nằm trong **process list** (`ps aux`)

> ⚠️ Đây là lỗi bảo mật nghiêm trọng. Nếu token bị lộ, attacker có thể push code tùy ý vào K8s manifest repo.

**✅ Cách khắc phục — Option A: Dùng single quotes**

Thay đổi cách interpolation để Jenkins **mask** credential:

```groovy
// ❌ SAI — Groovy interpolation, token hiện rõ trong log
sh "git clone https://${GIT_USER}:${GIT_TOKEN}@${K8S_MANIFEST_REPO} k8s-repo"

// ✅ ĐÚNG — Shell interpolation, Jenkins sẽ mask credential
sh 'git clone https://${GIT_USER}:${GIT_TOKEN}@' + "${K8S_MANIFEST_REPO}" + ' k8s-repo'
```

**✅ Cách khắc phục — Option B (Tốt nhất): Dùng Jenkins Git checkout step**

```groovy
dir('k8s-repo') {
    checkout([
        $class: 'GitSCM',
        branches: [[name: 'main']],
        extensions: [[$class: 'CloneOption', depth: 1, shallow: true]],
        userRemoteConfigs: [[
            url: "https://${K8S_MANIFEST_REPO}",
            credentialsId: GIT_CRED_ID
        ]]
    ])
}
```

**💡 Giải thích:**

- Jenkins `checkout` step quản lý credential **nội bộ**, không bao giờ hiện trong log
- Có sẵn `shallow clone` để tăng tốc

---

### 3. Node.js version không khớp giữa Jenkins và Docker

**📍 Vị trí:** Jenkinsfile line 5 vs Dockerfile line 2

```groovy
// Jenkinsfile — Node 20
tools {
    nodejs 'node-20'
}
```

```dockerfile
# Dockerfile — Node 18
FROM node:18-alpine AS builder
```

**❌ Vấn đề:**

- **CI chạy test/lint/build** trên Node **20**
- **Production chạy app** trên Node **18**
- Một số package hoạt động trên Node 20 nhưng **fail trên Node 18** (ví dụ: sử dụng API mới, native module khác binary)
- Bug có thể **chỉ xuất hiện trên production** mà CI không bắt được

**✅ Cách khắc phục:**

Đồng nhất version ở cả hai nơi. Ưu tiên dùng **Node 20** (LTS mới hơn, được support lâu hơn):

```dockerfile
# Dockerfile — cập nhật lên Node 20
FROM node:20-alpine AS builder
# ...
FROM node:20-alpine AS runner
```

Hoặc nếu có lý do phải dùng Node 18, thì đổi Jenkins:

```groovy
tools {
    nodejs 'node-18'
}
```

**💡 Nguyên tắc:** Môi trường CI và Production phải dùng **cùng Node.js major version**.

---

## 🟡 Vấn đề quan trọng (Major)

### 4. `sed` command cho K8s manifest quá fragile

**📍 Vị trí:** Line 129-131

```groovy
sh """
    sed -i 's|image: ${IMAGE_TAG}:.*|image: ${IMAGE_TAG}:${BUILD_NUMBER}|' deployment.yaml
"""
```

**❌ Vấn đề:**

- Pattern `.*` có thể **match sai** nếu `deployment.yaml` có nhiều container
- Hardcode tên file `deployment.yaml` — nếu đổi tên hoặc có nhiều environment thì hỏng
- `sed` **không hiểu YAML** — có thể phá hỏng cấu trúc file
- Nếu `sed` không tìm thấy pattern → **im lặng, không báo lỗi** (silent failure)

**✅ Cách khắc phục — Option A: Dùng `yq` (YAML-aware)**

```groovy
sh """
    yq -i '.spec.template.spec.containers[0].image = "${IMAGE_TAG}:${BUILD_NUMBER}"' deployment.yaml
"""
```

> Cần cài `yq` trên Jenkins agent: `apt-get install yq` hoặc dùng binary.

**✅ Cách khắc phục — Option B: Thêm validation cho `sed`**

Nếu không muốn cài thêm tool, ít nhất thêm kiểm tra:

```groovy
sh """
    # Kiểm tra pattern tồn tại trước khi replace
    grep -q 'image: ${IMAGE_TAG}:' deployment.yaml || (echo 'ERROR: Image pattern not found!' && exit 1)

    sed -i 's|image: ${IMAGE_TAG}:.*|image: ${IMAGE_TAG}:${BUILD_NUMBER}|' deployment.yaml

    # Verify kết quả
    grep 'image: ${IMAGE_TAG}:${BUILD_NUMBER}' deployment.yaml || (echo 'ERROR: sed replacement failed!' && exit 1)
"""
```

---

### 5. Stage "Checkout Source Code" bị thừa

**📍 Vị trí:** Line 37-42

```groovy
stage('Checkout Source Code') {
    steps {
        echo 'Checking out application source code...'
        checkout scm
    }
}
```

**❌ Vấn đề:**

Jenkins Declarative Pipeline **tự động checkout** source code ở đầu pipeline (implicit `checkout scm`). Stage này khiến checkout chạy **2 lần** → lãng phí thời gian.

**✅ Cách khắc phục — Option A: Xóa stage (đơn giản nhất)**

Xóa toàn bộ stage `Checkout Source Code`. Pipeline bắt đầu từ `Install Dependencies`.

**✅ Cách khắc phục — Option B: Tắt auto-checkout (explicit hơn)**

Nếu muốn giữ stage để rõ ràng, thêm `skipDefaultCheckout()` vào `options`:

```groovy
options {
    timeout(time: 30, unit: 'MINUTES')
    buildDiscarder(logRotator(numToKeepStr: '5'))
    disableConcurrentBuilds()
    timestamps()
    skipDefaultCheckout()  // ← Tắt auto-checkout
}
```

---

### 6. Thiếu Docker BuildKit và `--pull` flag

**📍 Vị trí:** Line 107

```groovy
sh "docker build -t ${IMAGE_TAG}:${BUILD_NUMBER} -t ${IMAGE_TAG}:latest -f Dockerfile ."
```

**❌ Vấn đề:**

- **Không có `--pull`** → Docker dùng base image đã cache → có thể chứa **security vulnerabilities** đã được fix ở upstream
- **Không dùng BuildKit** → miss nhiều tối ưu performance (parallel builds, better caching, v.v.)

**✅ Cách khắc phục:**

```groovy
sh "DOCKER_BUILDKIT=1 docker build --pull -t ${IMAGE_TAG}:${BUILD_NUMBER} -t ${IMAGE_TAG}:latest -f Dockerfile ."
```

| Flag                | Tác dụng                                                                     |
| ------------------- | ---------------------------------------------------------------------------- |
| `DOCKER_BUILDKIT=1` | Bật BuildKit — build nhanh hơn, parallel layer execution                     |
| `--pull`            | Luôn pull base image mới nhất → đảm bảo không dùng image cũ chứa lỗi bảo mật |

---

### 7. `latest` tag có thể gây race condition

**📍 Vị trí:** Line 107, 110

```groovy
sh "docker build -t ${IMAGE_TAG}:${BUILD_NUMBER} -t ${IMAGE_TAG}:latest -f Dockerfile ."
sh "docker push ${IMAGE_TAG}:latest"
```

**❌ Vấn đề:**

- Nếu pipeline chạy từ **nhiều branch** (ví dụ: `main`, `develop`, `feature/xxx`), tất cả đều push `:latest`
- `disableConcurrentBuilds()` chỉ ngăn concurrent builds trên **cùng một branch**, không ngăn giữa các branch
- Kết quả: `latest` có thể trỏ đến **feature branch** thay vì `main`

**✅ Cách khắc phục:**

Chỉ push `latest` từ branch `main`:

```groovy
sh "docker push ${IMAGE_TAG}:${BUILD_NUMBER}"

// Chỉ cập nhật latest từ main branch
if (env.BRANCH_NAME == 'main') {
    sh "docker push ${IMAGE_TAG}:latest"
}
```

---

## 🟠 Vấn đề nhỏ (Minor)

### 8. Thiếu retry cho Docker push

**📍 Vị trí:** Line 109-110

**❌ Vấn đề:** Docker push phụ thuộc vào **network** → dễ bị flaky failure (timeout, connection reset).

**✅ Cách khắc phục:**

```groovy
retry(3) {
    sh "docker push ${IMAGE_TAG}:${BUILD_NUMBER}"
    sh "docker push ${IMAGE_TAG}:latest"
}
```

---

### 9. K8s manifest clone toàn bộ repo mỗi lần build

**📍 Vị trí:** Line 122

**❌ Vấn đề:** `git clone` full repository history → chậm nếu repo có nhiều commits.

**✅ Cách khắc phục:**

```groovy
// Shallow clone — chỉ lấy commit mới nhất
sh "git clone --depth 1 --branch main https://..."
```

---

### 10. Thiếu notification thực tế

**📍 Vị trí:** Line 160-165

**❌ Vấn đề:** Chỉ có `echo` trong `post.success` và `post.failure` — không ai biết build fail trừ khi vào Jenkins kiểm tra.

**✅ Cách khắc phục — Slack:**

```groovy
post {
    success {
        slackSend(
            channel: '#ci-cd-alerts',
            color: 'good',
            message: "✅ *${env.JOB_NAME}* #${BUILD_NUMBER} — Build thành công!\nImage: `${IMAGE_TAG}:${BUILD_NUMBER}`"
        )
    }
    failure {
        slackSend(
            channel: '#ci-cd-alerts',
            color: 'danger',
            message: "❌ *${env.JOB_NAME}* #${BUILD_NUMBER} — Build thất bại!\nStage: `${env.STAGE_NAME}`\n<${BUILD_URL}|Xem log>"
        )
    }
}
```

> Cần cài plugin: **Slack Notification Plugin** trên Jenkins.

**✅ Cách khắc phục — Email (built-in):**

```groovy
failure {
    mail(
        to: 'team@example.com',
        subject: "❌ Jenkins Build Failed: ${env.JOB_NAME} #${BUILD_NUMBER}",
        body: "Check: ${BUILD_URL}"
    )
}
```

---

### 11. SonarQube config nằm inline trong Jenkinsfile

**📍 Vị trí:** Line 70-77

**❌ Vấn đề:**

- Config SonarQube hardcode trong Jenkinsfile → khó maintain
- Developer không thể chạy sonar scan trên local
- Nếu có nhiều project dùng chung config → phải copy/paste

**✅ Cách khắc phục:**

Tạo file `sonar-project.properties` ở thư mục gốc project:

```properties
# sonar-project.properties
sonar.projectKey=devops-blog-server
sonar.projectName=DevOps Blog Server
sonar.sources=.
sonar.exclusions=node_modules/**,.npm-cache/**,coverage/**,prisma/migrations/**
sonar.sourceEncoding=UTF-8
```

Sau đó simplify Jenkinsfile:

```groovy
stage('SonarQube Analysis') {
    steps {
        script {
            def scannerHome = tool 'sonar-scanner'
            withSonarQubeEnv('sonar-server') {
                // Tự động đọc config từ sonar-project.properties
                sh "${scannerHome}/bin/sonar-scanner"
            }
        }
    }
}
```

---

### 12. Error handling trong "Update K8s Manifest" quá lỏng

**📍 Vị trí:** Line 136-144

```groovy
try {
    // ...
    sh "git push origin main"
} catch (Exception e) {
    echo "Failed to push changes or no changes detected: ${e}"
    currentBuild.result = 'UNSTABLE'
}
```

**❌ Vấn đề:**

Bất kỳ lỗi nào đều được xử lý giống nhau — đều mark `UNSTABLE`:

- **Authentication failure** → nên là `FAILURE`
- **Network error** → nên là `FAILURE`
- **No changes to commit** → đây mới nên là `UNSTABLE` hoặc `SUCCESS`

**✅ Cách khắc phục:**

Phân biệt rõ "không có thay đổi" vs "lỗi thật":

```groovy
sh "git add deployment.yaml"

// Kiểm tra xem có thay đổi không
def hasChanges = sh(script: 'git diff-index --quiet HEAD', returnStatus: true) != 0

if (hasChanges) {
    sh "git commit -m 'chore(ci): update image version to ${BUILD_NUMBER}'"
    sh "git push origin main"  // Nếu lỗi ở đây → pipeline FAIL (đúng behavior)
    echo "Manifest repository updated successfully."
} else {
    echo "No changes detected in deployment.yaml — skipping commit."
}
```

---

## 📊 Bảng tổng kết

| #   | Mức độ      | Vấn đề                  | Ảnh hưởng                   | Khắc phục                              |
| --- | ----------- | ----------------------- | --------------------------- | -------------------------------------- |
| 1   | 🔴 Critical | Thiếu `.dockerignore`   | Build chậm, OOM crash       | Tạo file `.dockerignore`               |
| 2   | 🔴 Critical | Leak Git credentials    | Lộ token trong log          | Dùng Jenkins `checkout` step           |
| 3   | 🔴 Critical | Node version mismatch   | Bug ẩn trên production      | Đồng nhất version cả 2 nơi             |
| 4   | 🟡 Major    | `sed` fragile           | Silent failure, replace sai | Dùng `yq` hoặc thêm validation         |
| 5   | 🟡 Major    | Duplicate checkout      | Tốn thời gian               | Xóa stage hoặc `skipDefaultCheckout`   |
| 6   | 🟡 Major    | Thiếu BuildKit/`--pull` | Security risk, build chậm   | Thêm flags vào `docker build`          |
| 7   | 🟡 Major    | `latest` race condition | Deploy sai version          | Chỉ push `latest` từ `main`            |
| 8   | 🟠 Minor    | Thiếu retry             | Flaky failure               | Wrap `docker push` trong `retry(3)`    |
| 9   | 🟠 Minor    | Full clone K8s repo     | Chậm                        | Dùng `--depth 1`                       |
| 10  | 🟠 Minor    | Thiếu notification      | Không ai biết build fail    | Thêm Slack/Email                       |
| 11  | 🟠 Minor    | SonarQube inline config | Khó maintain                | Tách ra `sonar-project.properties`     |
| 12  | 🟠 Minor    | Error handling lỏng     | Mask lỗi thật               | Phân biệt "no changes" vs "real error" |

---

## 📌 Thứ tự ưu tiên khắc phục

1. **Tạo `.dockerignore`** — Fix nhanh nhất, impact lớn nhất
2. **Fix credential leak** — Rủi ro bảo mật cao
3. **Đồng nhất Node version** — Tránh bug ẩn
4. **Thêm BuildKit + `--pull`** — Đơn giản, hiệu quả
5. **Fix error handling K8s manifest** — Tránh mask lỗi thật
6. **Các vấn đề còn lại** — Cải thiện dần theo thời gian
