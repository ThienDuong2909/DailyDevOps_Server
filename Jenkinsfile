pipeline {
    agent any

    tools {
        nodejs 'node-20' 
    }

    options {
        // Auto-abort if pipeline runs longer than 30 minutes
        timeout(time: 30, unit: 'MINUTES')
        // Keep only last 5 builds to save disk space
        buildDiscarder(logRotator(numToKeepStr: '5'))
        // Prevent concurrent builds on the same branch
        disableConcurrentBuilds()
        // Add timestamps to console output for easier debugging
        timestamps()
    }

    environment {
        // Docker Registry Configuration
        DOCKER_HUB_USER = 'thienduong2909' 
        IMAGE_NAME = 'devops-blog-server'
        IMAGE_TAG = "${DOCKER_HUB_USER}/${IMAGE_NAME}"
        DOCKER_CRED_ID = 'docker-hub-credentials'

        // GitOps / Infrastructure Repository Configuration
        K8S_MANIFEST_REPO = 'github.com/ThienDuong2909/Blog_K8S.git'
        GIT_CRED_ID = 'github-access-token' 
        GIT_EMAIL = 'jenkins-bot@thienduong.info'
        GIT_NAME = 'Jenkins Bot'

        // npm cache directory - persists across builds for faster installs
        NPM_CACHE_DIR = "${WORKSPACE}/.npm-cache"

        // Per-workspace Docker config — tránh race condition khi 2 pipeline chạy song song
        // trên cùng 1 agent (mỗi pipeline có ~/.docker riêng, không ghi đè nhau)
        DOCKER_CONFIG = "${WORKSPACE}/.docker"
        BUILD_CONTEXT = '.'
        SERVER_NODE_ENV = "${env.NODE_ENV ?: 'production'}"
        SERVER_PORT = "${env.PORT ?: '3001'}"
        SERVER_API_PREFIX = "${env.API_PREFIX ?: 'api/v1'}"
        SERVER_APP_URL = "${env.APP_URL ?: 'https://blog.thienduong.info'}"
        SERVER_CORS_ORIGIN = "${env.CORS_ORIGIN ?: 'https://blog.thienduong.info,https://www.blog.thienduong.info'}"
        SERVER_RATE_LIMIT_WINDOW_MS = "${env.RATE_LIMIT_WINDOW_MS ?: '60000'}"
        SERVER_RATE_LIMIT_MAX_REQUESTS = "${env.RATE_LIMIT_MAX_REQUESTS ?: '100'}"
        SERVER_SCHEDULED_PUBLISH_INTERVAL_MS = "${env.SCHEDULED_PUBLISH_INTERVAL_MS ?: '30000'}"
        SERVER_SWAGGER_ENABLED = "${env.SWAGGER_ENABLED ?: 'false'}"
        SERVER_JWT_ACCESS_EXPIRES_IN = "${env.JWT_ACCESS_EXPIRES_IN ?: '15m'}"
        SERVER_JWT_REFRESH_EXPIRES_IN = "${env.JWT_REFRESH_EXPIRES_IN ?: '7d'}"
        SERVER_JWT_MFA_CHALLENGE_EXPIRES_IN = "${env.JWT_MFA_CHALLENGE_EXPIRES_IN ?: '10m'}"
        SERVER_SMTP_PORT = "${env.SMTP_PORT ?: '465'}"
        SERVER_SMTP_SECURE = "${env.SMTP_SECURE ?: 'true'}"
        SERVER_S3_REGION = "${env.S3_REGION ?: 'auto'}"
        SERVER_SENTRY_TRACES_SAMPLE_RATE = "${env.SENTRY_TRACES_SAMPLE_RATE ?: '0'}"
        SERVER_LOG_FORMAT = "${env.LOG_FORMAT ?: 'pretty'}"
        SERVER_LOG_SKIP_HEALTH = "${env.LOG_SKIP_HEALTH ?: 'true'}"
        SERVER_LOG_ONLY_API = "${env.LOG_ONLY_API ?: 'true'}"
    }

    stages {
        stage('Checkout Source Code') {
            steps {
                echo 'Checking out application source code...'
                checkout scm
            }
        }

        stage('Install Dependencies') {
            steps {
                echo 'Installing dependencies from lockfile...'
                // npm ci: designed for CI environments
                // - Automatically removes existing node_modules (no manual rm needed)
                // - Installs exact versions from package-lock.json (deterministic)
                // - 2-3x faster than npm install
                // - Fails if package-lock.json is out of sync with package.json
                sh '''
                    mkdir -p "${NPM_CACHE_DIR}" "${DOCKER_CONFIG}"
                    npm ci --cache "${NPM_CACHE_DIR}" --prefer-offline --no-audit
                '''
            }
        }

        stage('Lint Runtime Surface') {
            steps {
                echo 'Checking critical runtime modules syntax...'
                sh 'node --check src/server.js'
                sh 'node --check src/app.js'
            }
        }

        stage('Generate Prisma Client') {
            steps {
                echo 'Generating Prisma Client from schema...'
                sh 'npx prisma generate'
            }
        }

        stage('Run Tests') {
            steps {
                echo 'Running unit tests with coverage...'
                sh 'npm run test:coverage'
            }
        }

        stage('SonarQube Analysis') {
            steps {
                echo 'Starting static code analysis...'
                script {
                    def scannerHome = tool 'sonar-scanner'
                    
                    withSonarQubeEnv('sonar-server') {
                        sh """
                            "${scannerHome}/bin/sonar-scanner" \
                            -Dsonar.projectKey=devops-blog-server \
                            -Dsonar.projectName='DevOps Blog Server' \
                            -Dsonar.sources=src \
                            -Dsonar.exclusions=node_modules/**,.npm-cache/**,coverage/**,prisma/migrations/**,prisma/seed*.js,**/__tests__/** \
                            -Dsonar.coverage.exclusions=src/server.js,src/app.js,src/config/**,src/database/**,src/middlewares/**,src/utils/metrics.js,src/utils/prisma.js,src/common/errors/**,src/common/http/**,src/common/observability/**,src/common/email/**,src/common/middleware/auth.middleware.js,src/common/middleware/error.middleware.js,src/common/middleware/logger.middleware.js,src/modules/**/*.service.js,src/modules/**/*.routes.js,src/modules/**/*.helpers.js,src/modules/**/*.queries.js,src/modules/**/*.repository.js,src/modules/**/*.validation.js,src/modules/**/*.mailer.js,src/modules/**/*.storage.js,src/modules/posts/posts.importer.js,src/modules/posts/posts.scheduler.js,src/modules/seo/**,src/modules/settings/**,prisma/seed*.js \
                            -Dsonar.javascript.lcov.reportPaths=coverage/lcov.info \
                            -Dsonar.tests=src \
                            -Dsonar.test.inclusions=**/__tests__/**/*.test.js,**/*.test.js \
                            -Dsonar.sourceEncoding=UTF-8
                        """
                    }
                }
            }
        }

        stage('Quality Gate') {
            steps {
                echo 'Waiting for SonarQube Quality Gate result...'
                script {
                    timeout(time: 5, unit: 'MINUTES') {
                        def qg = waitForQualityGate()
                        if (qg.status != 'OK') {
                            error "Pipeline aborted due to Quality Gate failure: ${qg.status}"
                        }
                    }
                    echo 'Quality Gate passed successfully.'
                }
            }
        }

        stage('Inject Runtime Environment') {
            steps {
                echo 'Generating backend runtime environment file for smoke test...'
                withCredentials([
                    string(credentialsId: 'DATABASE_URL', variable: 'DATABASE_URL'),
                    string(credentialsId: 'JWT_ACCESS_SECRET', variable: 'JWT_ACCESS_SECRET'),
                    string(credentialsId: 'JWT_REFRESH_SECRET', variable: 'JWT_REFRESH_SECRET'),
                    string(credentialsId: 'JWT_MFA_SECRET', variable: 'JWT_MFA_SECRET'),
                    string(credentialsId: 'SMTP_PASS', variable: 'SMTP_PASS'),
                    string(credentialsId: 'S3_ACCESS_KEY_ID', variable: 'S3_ACCESS_KEY_ID'),
                    string(credentialsId: 'S3_SECRET_ACCESS_KEY', variable: 'S3_SECRET_ACCESS_KEY'),
                    string(credentialsId: 'SENTRY_DSN', variable: 'SENTRY_DSN')
                ]) {
                    sh '''
                        CLEAN_SENTRY_DSN="${SENTRY_DSN}"
                        case "${CLEAN_SENTRY_DSN}" in
                            '<backend-sentry-dsn>'|'YOUR_SENTRY_DSN'|'changeme'|'CHANGE_ME')
                                CLEAN_SENTRY_DSN=""
                                ;;
                        esac

                        cat > .env << EOF
NODE_ENV=${NODE_ENV:-${SERVER_NODE_ENV}}
PORT=${PORT:-${SERVER_PORT}}
API_PREFIX=${API_PREFIX:-${SERVER_API_PREFIX}}
DATABASE_URL=${DATABASE_URL}
JWT_ACCESS_SECRET=${JWT_ACCESS_SECRET}
JWT_REFRESH_SECRET=${JWT_REFRESH_SECRET}
JWT_MFA_SECRET=${JWT_MFA_SECRET}
JWT_ACCESS_EXPIRES_IN=${JWT_ACCESS_EXPIRES_IN:-${SERVER_JWT_ACCESS_EXPIRES_IN}}
JWT_REFRESH_EXPIRES_IN=${JWT_REFRESH_EXPIRES_IN:-${SERVER_JWT_REFRESH_EXPIRES_IN}}
JWT_MFA_CHALLENGE_EXPIRES_IN=${JWT_MFA_CHALLENGE_EXPIRES_IN:-${SERVER_JWT_MFA_CHALLENGE_EXPIRES_IN}}
CORS_ORIGIN=${CORS_ORIGIN:-${SERVER_CORS_ORIGIN}}
RATE_LIMIT_WINDOW_MS=${RATE_LIMIT_WINDOW_MS:-${SERVER_RATE_LIMIT_WINDOW_MS}}
RATE_LIMIT_MAX_REQUESTS=${RATE_LIMIT_MAX_REQUESTS:-${SERVER_RATE_LIMIT_MAX_REQUESTS}}
SCHEDULED_PUBLISH_INTERVAL_MS=${SCHEDULED_PUBLISH_INTERVAL_MS:-${SERVER_SCHEDULED_PUBLISH_INTERVAL_MS}}
SWAGGER_ENABLED=${SWAGGER_ENABLED:-${SERVER_SWAGGER_ENABLED}}
APP_URL=${APP_URL:-${SERVER_APP_URL}}
SMTP_HOST=${SMTP_HOST:-}
SMTP_PORT=${SMTP_PORT:-${SERVER_SMTP_PORT}}
SMTP_SECURE=${SMTP_SECURE:-${SERVER_SMTP_SECURE}}
SMTP_USER=${SMTP_USER:-}
SMTP_PASS=${SMTP_PASS}
CONTACT_INBOX=${CONTACT_INBOX:-${SMTP_USER:-}}
EMAIL_FROM=${EMAIL_FROM:-${SMTP_USER:-no-reply@localhost}}
S3_ENDPOINT=${S3_ENDPOINT:-}
S3_REGION=${S3_REGION:-${SERVER_S3_REGION}}
S3_BUCKET=${S3_BUCKET:-}
S3_ACCESS_KEY_ID=${S3_ACCESS_KEY_ID}
S3_SECRET_ACCESS_KEY=${S3_SECRET_ACCESS_KEY}
SENTRY_DSN=${CLEAN_SENTRY_DSN}
SENTRY_TRACES_SAMPLE_RATE=${SENTRY_TRACES_SAMPLE_RATE:-${SERVER_SENTRY_TRACES_SAMPLE_RATE}}
LOG_FORMAT=${LOG_FORMAT:-${SERVER_LOG_FORMAT}}
LOG_SKIP_HEALTH=${LOG_SKIP_HEALTH:-${SERVER_LOG_SKIP_HEALTH}}
LOG_ONLY_API=${LOG_ONLY_API:-${SERVER_LOG_ONLY_API}}
EOF
                    '''
                    sh 'echo "Backend env file created with $(wc -l < .env) variables"'
                }
            }
        }

        stage('Docker Build & Push') {
            steps {
                script {
                    echo "Building Docker image: ${IMAGE_TAG}:${BUILD_NUMBER}..."
                    withCredentials([usernamePassword(credentialsId: DOCKER_CRED_ID, passwordVariable: 'DOCKER_PASS', usernameVariable: 'DOCKER_USER')]) {
                        
                        sh 'echo $DOCKER_PASS | docker login -u $DOCKER_USER --password-stdin'
                        
                        // Build with specific version tag, then re-tag as latest
                        sh "docker build --pull -t ${IMAGE_TAG}:${BUILD_NUMBER} -f Dockerfile ${BUILD_CONTEXT}"
                        sh "docker tag ${IMAGE_TAG}:${BUILD_NUMBER} ${IMAGE_TAG}:latest"

                        echo 'Running container health smoke check...'
                        sh """
                            docker run -d --name server-smoke-${BUILD_NUMBER} -p 3001:3001 --env-file .env ${IMAGE_TAG}:${BUILD_NUMBER}
                            for i in \$(seq 1 30); do
                                if docker exec server-smoke-${BUILD_NUMBER} node -e "fetch('http://127.0.0.1:3001/health').then((res) => { if (!res.ok) process.exit(1); }).catch(() => process.exit(1))"; then
                                    echo "Smoke check passed on attempt \$i"
                                    break
                                fi

                                if [ "\$i" -eq 30 ]; then
                                    echo "Smoke check failed after 30 attempts"
                                    docker logs server-smoke-${BUILD_NUMBER}
                                    exit 1
                                fi

                                sleep 2
                            done
                            docker rm -f server-smoke-${BUILD_NUMBER}
                        """
                        
                        // Push versioned tag
                        sh "docker push ${IMAGE_TAG}:${BUILD_NUMBER}"
                        
                        // Re-authenticate before pushing latest to prevent token expiry
                        // (long push operations with retries can cause session timeout)
                        sh 'echo $DOCKER_PASS | docker login -u $DOCKER_USER --password-stdin'
                        sh "docker push ${IMAGE_TAG}:latest"
                    }
                }
            }
        }

        stage('Update K8s Manifest') {
            steps {
                script {
                    echo 'Updating Kubernetes manifest repository with new image version...'
                    
                    // Use Jenkins checkout step to clone — credentials are managed internally
                    // and NEVER exposed in console output (unlike raw git clone)
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

                    // Use withCredentials only for push — with shell-level interpolation
                    withCredentials([usernamePassword(credentialsId: GIT_CRED_ID, passwordVariable: 'GIT_TOKEN', usernameVariable: 'GIT_USER')]) {
                        dir('k8s-repo') {
                            sh "git config user.email '${GIT_EMAIL}'"
                            sh "git config user.name '${GIT_NAME}'"
                            
                            sh """
                                sed -i 's|image: ${IMAGE_TAG}:.*|image: ${IMAGE_TAG}:${BUILD_NUMBER}|' deployment.yaml
                            """
                            
                            echo "Verifying changes in deployment.yaml:"
                            sh "grep 'image:' deployment.yaml"
                            
                            // Check if there are actual changes before committing
                            sh "git add deployment.yaml"
                            def hasChanges = sh(script: 'git diff-index --quiet HEAD', returnStatus: true) != 0
                            
                            if (hasChanges) {
                                sh "git commit -m 'chore(ci): update server image to ${BUILD_NUMBER}'"
                                // Set remote URL with credentials for push (shell interpolation — Jenkins will mask the token)
                                sh 'git remote set-url origin https://${GIT_USER}:${GIT_TOKEN}@' + "${K8S_MANIFEST_REPO}"
                                // Fetch + rebase to handle remote having newer commits
                                // (e.g. client pipeline pushed while this build was running)
                                sh "git fetch origin main"
                                sh "git rebase origin/main"
                                // Use HEAD:main because Jenkins GitSCM checkout leaves repo in detached HEAD state
                                sh "git push origin HEAD:main"
                                echo "Manifest repository updated successfully."
                            } else {
                                echo "No changes detected in deployment.yaml — skipping commit."
                            }
                        }
                    }
                }
            }
        }
    }

    post {
        always {
            echo 'Performing post-build cleanup...'
            sh 'rm -f .env'
            sh "docker rm -f server-smoke-${BUILD_NUMBER} || true"
            sh "docker logout || true"
            sh "rm -rf k8s-repo"
            // Remove Docker images from agent to free disk space
            sh "docker rmi ${IMAGE_TAG}:${BUILD_NUMBER} ${IMAGE_TAG}:latest || true"
            // Remove dangling images (<none> tags) created during build
            sh 'docker image prune -f || true'
        }
        success {
            echo "Pipeline executed successfully. Image: ${IMAGE_TAG}:${BUILD_NUMBER}"
        }
        failure {
            echo "Pipeline failed at stage: ${env.STAGE_NAME}. Check logs for details."
        }
        cleanup {
            // Clean workspace AFTER everything else - at the END instead of the START
            // This allows npm cache to persist for the NEXT build
            cleanWs(deleteDirs: true, patterns: [
                // Keep npm cache between builds for faster installs
                [pattern: '.npm-cache/**', type: 'EXCLUDE']
            ])
        }
    }
}
