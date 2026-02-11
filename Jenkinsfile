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
                            -Dsonar.exclusions=node_modules/**,.npm-cache/**,coverage/**,prisma/migrations/** \
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
                        
                        // Build with both specific version tag and 'latest'
                        sh "docker build -t ${IMAGE_TAG}:${BUILD_NUMBER} -t ${IMAGE_TAG}:latest -f Dockerfile ."
                        
                        sh "docker push ${IMAGE_TAG}:${BUILD_NUMBER}"
                        sh "docker push ${IMAGE_TAG}:latest"
                    }
                }
            }
        }

        stage('Update K8s Manifest') {
            steps {
                script {
                    echo 'Updating Kubernetes manifest repository with new image version...'
                    withCredentials([usernamePassword(credentialsId: GIT_CRED_ID, passwordVariable: 'GIT_TOKEN', usernameVariable: 'GIT_USER')]) {
                        
                        sh "git clone https://${GIT_USER}:${GIT_TOKEN}@${K8S_MANIFEST_REPO} k8s-repo"
                        
                        dir("k8s-repo") {
                            sh "git config user.email '${GIT_EMAIL}'"
                            sh "git config user.name '${GIT_NAME}'"
                            sh "git checkout main"
                            
                            sh """
                                sed -i 's|image: ${IMAGE_TAG}:.*|image: ${IMAGE_TAG}:${BUILD_NUMBER}|' deployment.yaml
                            """
                            
                            echo "Verifying changes in deployment.yaml:"
                            sh "grep 'image:' deployment.yaml"
                            
                            try {
                                sh "git add deployment.yaml"
                                sh "git diff-index --quiet HEAD || git commit -m 'chore(ci): update image version to ${BUILD_NUMBER}'"
                                sh "git push origin main"
                                echo "Manifest repository updated successfully."
                            } catch (Exception e) {
                                echo "Failed to push changes or no changes detected: ${e}"
                                currentBuild.result = 'UNSTABLE'
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