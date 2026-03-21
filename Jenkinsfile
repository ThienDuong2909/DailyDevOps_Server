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
                sh 'npm ci --cache ${NPM_CACHE_DIR}'
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
                            -Dsonar.sources=. \
                            -Dsonar.exclusions=node_modules/**,.npm-cache/**,coverage/**,prisma/migrations/**,prisma/seed*.js,**/__tests__/** \
                            -Dsonar.coverage.exclusions=src/utils/metrics.js,src/utils/prisma.js,src/config/**,src/server.js,src/app.js,prisma/seed*.js \
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

        stage('Docker Build & Push') {
            steps {
                script {
                    echo "Building Docker image: ${IMAGE_TAG}:${BUILD_NUMBER}..."
                    withCredentials([usernamePassword(credentialsId: DOCKER_CRED_ID, passwordVariable: 'DOCKER_PASS', usernameVariable: 'DOCKER_USER')]) {
                        
                        sh 'echo $DOCKER_PASS | docker login -u $DOCKER_USER --password-stdin'
                        
                        // Build with specific version tag, then re-tag as latest
                        sh "docker build -t ${IMAGE_TAG}:${BUILD_NUMBER} -f Dockerfile ."
                        sh "docker tag ${IMAGE_TAG}:${BUILD_NUMBER} ${IMAGE_TAG}:latest"
                        
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