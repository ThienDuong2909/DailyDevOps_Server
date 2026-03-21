/**
 * Seed Blog Posts from Blog_Post directory
 * Reads markdown files, converts to HTML, and inserts into DB
 * 
 * Usage: node prisma/seed-posts.js
 */
const { getPrismaClient } = require('../src/utils/prisma');
const { marked } = require('marked');
const fs = require('fs');
const path = require('path');

const prisma = getPrismaClient();

// ============================================
// Blog post definitions — matched to markdown files
// ============================================
const BLOG_POSTS_DIR = path.resolve(__dirname, '../../Blog_Post');

const postDefinitions = [
    {
        file: '00-gioi-thieu-tong-quan.md',
        title: 'DevOps Journey — Xây dựng CI/CD Pipeline và Kubernetes Monitoring từ Zero đến Production',
        slug: 'devops-journey-tong-quan',
        excerpt: 'Khi bắt đầu học DevOps, câu hỏi lớn nhất không phải "dùng tool gì" mà là "tại sao cần làm việc này". Series này tập trung vào việc giải thích tại sao mỗi quyết định được đưa ra và cách xử lý vấn đề thực tế.',
        thumbnail: 'thumb-00-overview.png',
        category: 'devops',
        tags: ['ci-cd', 'kubernetes', 'docker', 'monitoring'],
        order: 0,
    },
    {
        file: '01-local-to-github.md',
        title: 'Từ Local lên GitHub — Setup dự án và quản lý source code',
        slug: 'tu-local-len-github',
        excerpt: 'Setup project full-stack với Docker Compose, tổ chức repo structure, và quản lý source code trên GitHub. Bài đầu tiên trong series DevOps Journey.',
        thumbnail: 'thumb-01-local-github.png',
        category: 'devops',
        tags: ['git', 'docker', 'nodejs'],
        order: 1,
    },
    {
        file: '02-dockerize-application.md',
        title: 'Docker hóa ứng dụng — Multi-stage Dockerfile và bảo mật container',
        slug: 'dockerize-application',
        excerpt: 'Multi-stage Dockerfile giảm image size 75%, từ 800MB xuống 200MB. Best practices cho security và production-ready containers.',
        thumbnail: 'thumb-02-dockerize.png',
        category: 'docker',
        tags: ['docker', 'security', 'nodejs'],
        order: 2,
    },
    {
        file: '03-jenkins-ci-pipeline.md',
        title: 'Jenkins CI Pipeline — Tự động hóa từ Code đến Container',
        slug: 'jenkins-ci-pipeline',
        excerpt: 'Pipeline tự động hóa toàn bộ quy trình: checkout, install, build, push image, update K8s manifest. Xử lý npm cache, Docker token race condition, và git rebase conflict.',
        thumbnail: 'thumb-03-jenkins-ci.png',
        category: 'devops',
        tags: ['jenkins', 'ci-cd', 'docker'],
        order: 3,
    },
    {
        file: '04-sonarqube-quality-gate.md',
        title: 'SonarQube Quality Gate — Chặn code xấu trước Production',
        slug: 'sonarqube-quality-gate',
        excerpt: 'Tích hợp SonarQube vào Jenkins pipeline để phân tích code tĩnh, phát hiện bugs, vulnerabilities, và code smells trước khi build Docker image.',
        thumbnail: 'thumb-04-sonarqube.png',
        category: 'devops',
        tags: ['sonarqube', 'ci-cd', 'quality'],
        order: 4,
    },
    {
        file: '05-deploy-k3s.md',
        title: 'Triển khai lên K3s — Deployment, Service, Ingress và TLS',
        slug: 'deploy-k3s-kubernetes',
        excerpt: 'Deploy ứng dụng lên K3s với zero-downtime rolling updates, Traefik Ingress, cert-manager tự động HTTPS, health probes, và resource limits.',
        thumbnail: 'thumb-05-k3s-deploy.png',
        category: 'devops',
        tags: ['kubernetes', 'k3s', 'traefik'],
        order: 5,
    },
    {
        file: '06-argocd-gitops.md',
        title: 'ArgoCD — GitOps: Auto-sync, Self-heal và Rollback',
        slug: 'argocd-gitops',
        excerpt: 'Git làm nguồn sự thật duy nhất. ArgoCD tự động deploy khi manifest thay đổi, self-heal khi có thay đổi thủ công trên cluster, và hỗ trợ rollback bằng git revert.',
        thumbnail: 'thumb-06-argocd.png',
        category: 'devops',
        tags: ['argocd', 'gitops', 'kubernetes'],
        order: 6,
    },
    {
        file: '07-prometheus-grafana.md',
        title: 'Prometheus và Grafana — Monitoring Stack và Dashboard',
        slug: 'prometheus-grafana-monitoring',
        excerpt: 'Triển khai kube-prometheus-stack trên K3s, tạo custom Grafana dashboard cho CPU, RAM, API latency, và request rate. PromQL queries thực tế.',
        thumbnail: 'thumb-07-prometheus.png',
        category: 'devops',
        tags: ['prometheus', 'grafana', 'monitoring'],
        order: 7,
    },
    {
        file: '08-application-metrics.md',
        title: 'Application Metrics — Custom Metrics với prom-client và PodMonitor',
        slug: 'application-metrics-prom-client',
        excerpt: 'Expose application-level metrics (HTTP request duration, active connections, business metrics) bằng prom-client và thu thập qua Kubernetes PodMonitor.',
        thumbnail: 'thumb-08-app-metrics.png',
        category: 'devops',
        tags: ['prometheus', 'monitoring', 'nodejs'],
        order: 8,
    },
    {
        file: '09-loki-log-aggregation.md',
        title: 'Loki — Log Aggregation: Thu thập và phân tích logs',
        slug: 'loki-log-aggregation',
        excerpt: 'Triển khai Loki + Promtail trên K3s, thu thập pod logs và Traefik access logs. Sử dụng LogQL để phân tích traffic patterns, top IPs, và error rates.',
        thumbnail: 'thumb-09-loki.png',
        category: 'devops',
        tags: ['loki', 'monitoring', 'logging'],
        order: 9,
    },
    {
        file: '10-alertmanager-notifications.md',
        title: 'AlertManager — Notifications: Slack, Telegram và External Monitoring',
        slug: 'alertmanager-notifications',
        excerpt: 'Cấu hình AlertManager gửi cảnh báo qua Slack, GitHub Actions monitoring từ bên ngoài VPS gửi Telegram. Xử lý alert fatigue và inhibit rules.',
        thumbnail: 'thumb-10-alertmanager.png',
        category: 'devops',
        tags: ['alertmanager', 'monitoring', 'slack'],
        order: 10,
    },
    {
        file: '11-tong-ket-huong-phat-trien.md',
        title: 'Tổng kết và Hướng Phát Triển Tương Lai',
        slug: 'tong-ket-huong-phat-trien',
        excerpt: 'Nhìn lại hành trình từ Docker Compose trên local đến production-grade Kubernetes với monitoring hoàn chỉnh. Bài học kinh nghiệm và roadmap tương lai.',
        thumbnail: 'thumb-11-summary.png',
        category: 'devops',
        tags: ['devops', 'kubernetes', 'summary'],
        order: 11,
    },
];

// ============================================
// Additional categories & tags
// ============================================
const additionalCategories = [
    { name: 'CI/CD', slug: 'ci-cd', description: 'Continuous Integration & Deployment', color: '#FF6B6B', icon: '🔄' },
    { name: 'Monitoring', slug: 'monitoring', description: 'Observability, metrics, and alerting', color: '#4ECDC4', icon: '📊' },
    { name: 'Kubernetes', slug: 'kubernetes', description: 'Container orchestration with Kubernetes', color: '#326CE5', icon: '☸️' },
];

const allTags = [
    { name: 'CI/CD', slug: 'ci-cd' },
    { name: 'Docker', slug: 'docker' },
    { name: 'Jenkins', slug: 'jenkins' },
    { name: 'SonarQube', slug: 'sonarqube' },
    { name: 'ArgoCD', slug: 'argocd' },
    { name: 'GitOps', slug: 'gitops' },
    { name: 'Prometheus', slug: 'prometheus' },
    { name: 'Grafana', slug: 'grafana' },
    { name: 'Loki', slug: 'loki' },
    { name: 'AlertManager', slug: 'alertmanager' },
    { name: 'Monitoring', slug: 'monitoring' },
    { name: 'Logging', slug: 'logging' },
    { name: 'Git', slug: 'git' },
    { name: 'Node.js', slug: 'nodejs' },
    { name: 'Security', slug: 'security' },
    { name: 'K3s', slug: 'k3s' },
    { name: 'Traefik', slug: 'traefik' },
    { name: 'Quality', slug: 'quality' },
    { name: 'Slack', slug: 'slack' },
    { name: 'Summary', slug: 'summary' },
];

// ============================================
// Main seed function
// ============================================
async function seedPosts() {
    console.log('🌱 Starting blog posts seed...\n');

    // 1. Create admin user (upsert)
    const argon2 = require('argon2');
    const admin = await prisma.user.upsert({
        where: { email: 'admin@devopsblog.com' },
        update: {},
        create: {
            email: 'admin@devopsblog.com',
            password: await argon2.hash('Admin@123'),
            firstName: 'Thiện',
            lastName: 'Dương',
            role: 'ADMIN',
            isActive: true,
            bio: 'DevOps Engineer & Cloud Enthusiast. Sharing knowledge about CI/CD, Kubernetes, and monitoring.',
        },
    });
    console.log(`✅ Admin user ready: ${admin.email}`);

    // 2. Create/find categories
    const categoryMap = {};

    // First, load all existing categories
    const existingCategories = await prisma.category.findMany();
    for (const cat of existingCategories) {
        categoryMap[cat.slug] = cat.id;
        // Also map by name (lowercase) for fallback matching
        categoryMap[cat.name.toLowerCase()] = cat.id;
    }
    console.log(`📂 Found ${existingCategories.length} existing categories`);

    // Only create categories that don't exist yet (by slug OR name)
    const newCategories = [
        { name: 'DevOps', slug: 'devops', description: 'DevOps practices and tools', color: '#FF6B6B', icon: '🚀' },
        { name: 'Docker', slug: 'docker', description: 'Containerization with Docker', color: '#2D6CDF', icon: '🐳' },
        { name: 'Monitoring', slug: 'monitoring', description: 'Observability, metrics, and alerting', color: '#4ECDC4', icon: '📊' },
    ];

    for (const cat of newCategories) {
        // Skip if slug OR name already exists
        if (categoryMap[cat.slug] || categoryMap[cat.name.toLowerCase()]) {
            continue;
        }
        const created = await prisma.category.create({ data: cat });
        categoryMap[cat.slug] = created.id;
        categoryMap[cat.name.toLowerCase()] = created.id;
    }
    console.log(`✅ Category map ready (${Object.keys(categoryMap).length} entries)`);

    // 3. Create tags
    const tagMap = {};
    for (const tag of allTags) {
        const created = await prisma.tag.upsert({
            where: { slug: tag.slug },
            update: {},
            create: tag,
        });
        tagMap[tag.slug] = created.id;
    }
    console.log(`✅ Created ${Object.keys(tagMap).length} tags`);

    // 4. Configure marked for rendering
    marked.setOptions({
        gfm: true,
        breaks: false,
    });

    // 5. Import blog posts
    let imported = 0;
    let skipped = 0;

    for (const def of postDefinitions) {
        // Check if post already exists
        const existing = await prisma.post.findUnique({
            where: { slug: def.slug },
        });

        if (existing) {
            console.log(`⏭️  Skipping "${def.title}" (already exists)`);
            skipped++;
            continue;
        }

        // Read markdown file
        const mdPath = path.join(BLOG_POSTS_DIR, def.file);
        if (!fs.existsSync(mdPath)) {
            console.log(`⚠️  File not found: ${def.file}`);
            continue;
        }

        const markdown = fs.readFileSync(mdPath, 'utf-8');

        // Convert markdown to HTML
        const htmlContent = marked.parse(markdown);

        // Calculate reading time (approx 200 words/min)
        const wordCount = markdown.split(/\s+/).length;
        const readingTime = Math.ceil(wordCount / 200);

        // Thumbnail path — will be served from /uploads/thumbnails/
        const featuredImage = def.thumbnail ? `/uploads/thumbnails/${def.thumbnail}` : null;

        // Resolve tags
        const tagConnections = def.tags
            .filter(t => tagMap[t])
            .map(t => ({ id: tagMap[t] }));

        // Create post
        const publishDate = new Date('2026-03-20');
        publishDate.setDate(publishDate.getDate() - (11 - def.order)); // Spread dates

        await prisma.post.create({
            data: {
                title: def.title,
                slug: def.slug,
                excerpt: def.excerpt,
                content: htmlContent,
                featuredImage,
                status: 'PUBLISHED',
                readingTime,
                publishedAt: publishDate,
                authorId: admin.id,
                categoryId: categoryMap[def.category] || categoryMap['devops'],
                tags: { connect: tagConnections },
            },
        });

        imported++;
        console.log(`📝 Imported: "${def.title}" (${readingTime} min read)`);
    }

    console.log(`\n🎉 Done! Imported: ${imported}, Skipped: ${skipped}`);
}

// ============================================
// Copy thumbnails to server public directory
// ============================================
async function copyThumbnails() {
    const srcDir = BLOG_POSTS_DIR;
    const destDir = path.resolve(__dirname, '../public/uploads/thumbnails');

    // Create destination directory
    fs.mkdirSync(destDir, { recursive: true });

    const thumbFiles = fs.readdirSync(srcDir).filter(f => f.startsWith('thumb-'));
    
    // Also copy the architecture diagram
    const allFiles = [...thumbFiles];
    const archFile = 'devops-architecture-flow.png';
    if (fs.existsSync(path.join(srcDir, archFile))) {
        allFiles.push(archFile);
    }

    for (const file of allFiles) {
        const src = path.join(srcDir, file);
        const dest = path.join(destDir, file);
        fs.copyFileSync(src, dest);
    }

    console.log(`📸 Copied ${allFiles.length} thumbnail images to ${destDir}`);
}

// ============================================
// Run
// ============================================
async function main() {
    await copyThumbnails();
    await seedPosts();
}

main()
    .catch((e) => {
        console.error('❌ Seed error:', e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
